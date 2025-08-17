import { SessionId, BrowserAction, BrowserActionType } from './types.js';

export interface BrowserClientConfig {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface LaunchSessionResponse {
  sessionId: SessionId;
}

export interface BrowserActionRequest {
  sessionId: SessionId;
  type: BrowserActionType;
  url: string;
  selector?: string;
  action?: string;
  data?: Record<string, unknown>;
  screenshot?: boolean;
}

export class BrowserClient {
  private config: BrowserClientConfig;

  constructor(config: BrowserClientConfig) {
    this.config = {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      ...config,
    };
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        headers: this.config.headers,
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          typeof errorData === 'object' &&
          errorData !== null &&
          'error' in errorData
            ? String(errorData.error)
            : `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return typeof data === 'object' && data !== null && 'data' in data
        ? (data.data as T)
        : (data as T);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred');
    }
  }

  /**
   * Launch a new browser session
   */
  async launchSession(): Promise<LaunchSessionResponse> {
    return this.makeRequest<LaunchSessionResponse>('/v1/browser/launch', {
      method: 'POST',
    });
  }

  /**
   * Close a browser session
   */
  async closeSession(sessionId: SessionId): Promise<void> {
    await this.makeRequest(`/v1/browser/close/${sessionId}`, {
      method: 'DELETE',
    });
  }

  /**
   * List all active browser sessions
   */
  async listSessions(): Promise<
    Array<{
      sessionId: SessionId;
      createdAt: Date;
      lastUsed: Date;
      isActive: boolean;
    }>
  > {
    return this.makeRequest('/v1/browser/sessions', {
      method: 'GET',
    });
  }

  /**
   * Execute a browser action
   */
  async executeAction(action: BrowserActionRequest): Promise<BrowserAction> {
    return this.makeRequest<BrowserAction>('/v1/browser/actions', {
      method: 'POST',
      body: JSON.stringify(action),
    });
  }

  /**
   * Get a specific browser action by ID
   */
  async getAction(actionId: string): Promise<BrowserAction> {
    return this.makeRequest<BrowserAction>(`/v1/browser/actions/${actionId}`, {
      method: 'GET',
    });
  }

  /**
   * List browser actions with optional filtering
   */
  async getActions(
    options: {
      page?: number;
      limit?: number;
      status?: string;
      type?: string;
    } = {}
  ): Promise<{
    actions: BrowserAction[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const params = new URLSearchParams();
    if (options.page) params.append('page', options.page.toString());
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.status) params.append('status', options.status);
    if (options.type) params.append('type', options.type);

    const queryString = params.toString();
    const endpoint = `/v1/browser/actions${queryString ? `?${queryString}` : ''}`;

    return this.makeRequest(endpoint, {
      method: 'GET',
    });
  }

  /**
   * Check if the browser service is healthy
   */
  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    service: string;
  }> {
    return this.makeRequest('/health', {
      method: 'GET',
    });
  }

  /**
   * Convenience method to navigate to a URL
   */
  async navigate(sessionId: SessionId, url: string): Promise<BrowserAction> {
    return this.executeAction({
      sessionId,
      type: BrowserActionType.NAVIGATE,
      url,
    });
  }

  /**
   * Convenience method to take a screenshot
   */
  async screenshot(sessionId: SessionId, url: string): Promise<BrowserAction> {
    return this.executeAction({
      sessionId,
      type: BrowserActionType.SCREENSHOT,
      url,
      screenshot: true,
    });
  }

  /**
   * Convenience method to click an element
   */
  async click(
    sessionId: SessionId,
    url: string,
    selector: string
  ): Promise<BrowserAction> {
    return this.executeAction({
      sessionId,
      type: BrowserActionType.CLICK,
      url,
      selector,
    });
  }

  /**
   * Convenience method to type text into an element
   */
  async type(
    sessionId: SessionId,
    url: string,
    selector: string,
    text: string
  ): Promise<BrowserAction> {
    return this.executeAction({
      sessionId,
      type: BrowserActionType.TYPE,
      url,
      selector,
      data: { text },
    });
  }

  /**
   * Convenience method to extract text from an element
   */
  async extract(
    sessionId: SessionId,
    url: string,
    selector?: string
  ): Promise<BrowserAction> {
    return this.executeAction({
      sessionId,
      type: BrowserActionType.EXTRACT,
      url,
      selector,
    });
  }

  /**
   * Convenience method to wait for an element
   */
  async wait(
    sessionId: SessionId,
    url: string,
    selector?: string,
    timeout?: number
  ): Promise<BrowserAction> {
    return this.executeAction({
      sessionId,
      type: BrowserActionType.WAIT,
      url,
      selector,
      data: timeout ? { timeout } : undefined,
    });
  }
}

// Export a factory function for easy client creation
export function createBrowserClient(
  config: BrowserClientConfig
): BrowserClient {
  return new BrowserClient(config);
}
