import { z } from 'zod';
import { logger } from '@bharat-agents/shared';

// =============================================================================
// Browser Client Types and Schemas
// =============================================================================

// Response schemas for zod validation
const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  timestamp: z.string().transform(str => new Date(str)),
});

const SessionResponseSchema = ApiResponseSchema.extend({
  data: z
    .object({
      sessionId: z.string(),
    })
    .optional(),
});

const SessionsListResponseSchema = ApiResponseSchema.extend({
  data: z
    .array(
      z.object({
        sessionId: z.string(),
        createdAt: z.string().transform(str => new Date(str)),
        lastUsed: z.string().transform(str => new Date(str)),
        isActive: z.boolean(),
      })
    )
    .optional(),
});

const BrowserActionSchema = z.object({
  id: z.string(),
  type: z.enum(['navigate', 'click', 'type', 'screenshot', 'extract', 'wait']),
  url: z.string(),
  selector: z.string().optional(),
  action: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  screenshot: z.boolean().optional(),
  createdAt: z.string().transform(str => new Date(str)),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  result: z
    .object({
      success: z.boolean(),
      data: z.unknown().optional(),
      error: z.string().optional(),
      screenshot: z.string().optional(),
      timestamp: z.string().transform(str => new Date(str)),
    })
    .optional(),
});

const ActionResponseSchema = ApiResponseSchema.extend({
  data: BrowserActionSchema.optional(),
});

const ActionsListResponseSchema = ApiResponseSchema.extend({
  data: z.array(BrowserActionSchema).optional(),
  pagination: z
    .object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    })
    .optional(),
}).transform(data => ({
  actions: data.data || [],
  pagination: data.pagination || {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
}));

// Request schemas
const ExecuteActionRequestSchema = z.object({
  sessionId: z.string(),
  type: z.enum(['navigate', 'click', 'type', 'screenshot', 'extract', 'wait']),
  url: z.string().url(),
  selector: z.string().optional(),
  action: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  screenshot: z.boolean().optional(),
});

// Type exports
export type SessionId = string;
export type BrowserActionType =
  | 'navigate'
  | 'click'
  | 'type'
  | 'screenshot'
  | 'extract'
  | 'wait';
export type BrowserActionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed';

export interface BrowserSession {
  sessionId: SessionId;
  createdAt: Date;
  lastUsed: Date;
  isActive: boolean;
}

export interface BrowserAction {
  id: string;
  type: BrowserActionType;
  url: string;
  selector?: string;
  action?: string;
  data?: Record<string, unknown>;
  screenshot?: boolean;
  createdAt: Date;
  status: BrowserActionStatus;
  result?: {
    success: boolean;
    data?: unknown;
    error?: string;
    screenshot?: string;
    timestamp: Date;
  };
}

export interface ExecuteActionRequest {
  sessionId: SessionId;
  type: BrowserActionType;
  url: string;
  selector?: string;
  action?: string;
  data?: Record<string, unknown>;
  screenshot?: boolean;
}

export interface ActionFilters {
  page?: number;
  limit?: number;
  status?: BrowserActionStatus;
  type?: BrowserActionType;
}

export interface ActionsListResult {
  actions: BrowserAction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// =============================================================================
// Browser Client Configuration
// =============================================================================

export interface BrowserClientConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  enableAuditLog?: boolean;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
}

// =============================================================================
// Audit Log Interface
// =============================================================================

export interface AuditLogEntry {
  timestamp: Date;
  operation: string;
  sessionId?: SessionId;
  actionId?: string;
  url?: string;
  status: 'success' | 'error';
  duration: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogger {
  log(entry: AuditLogEntry): void | Promise<void>;
}

// =============================================================================
// Browser Client Implementation
// =============================================================================

export class BrowserClient {
  private config: Required<BrowserClientConfig>;
  private retryConfig: RetryConfig;
  private auditLogger?: AuditLogger;

  constructor(config: BrowserClientConfig, auditLogger?: AuditLogger) {
    this.config = {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      enableAuditLog: true,
      ...config,
    };

    this.retryConfig = {
      maxRetries: this.config.retries,
      baseDelay: this.config.retryDelay,
      maxDelay: 10000,
      jitter: true,
    };

    this.auditLogger = auditLogger;
  }

  // =============================================================================
  // Session Management
  // =============================================================================

  async createSession(): Promise<SessionId> {
    const startTime = Date.now();
    const operation = 'createSession';

    try {
      const response = await this.makeRequest<{ sessionId: SessionId }>(
        'POST',
        '/launch',
        undefined,
        SessionResponseSchema
      );

      const duration = Date.now() - startTime;
      this.logAudit({
        timestamp: new Date(),
        operation,
        sessionId: response.sessionId,
        status: 'success',
        duration,
        metadata: { sessionId: response.sessionId },
      });

      return response.sessionId;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logAudit({
        timestamp: new Date(),
        operation,
        status: 'error',
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async closeSession(sessionId: SessionId): Promise<void> {
    const startTime = Date.now();
    const operation = 'closeSession';

    try {
      await this.makeRequest(
        'DELETE',
        `/close/${sessionId}`,
        undefined,
        ApiResponseSchema
      );

      const duration = Date.now() - startTime;
      this.logAudit({
        timestamp: new Date(),
        operation,
        sessionId,
        status: 'success',
        duration,
        metadata: { sessionId },
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logAudit({
        timestamp: new Date(),
        operation,
        sessionId,
        status: 'error',
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async listSessions(): Promise<BrowserSession[]> {
    const startTime = Date.now();
    const operation = 'listSessions';

    try {
      const response = await this.makeRequest<BrowserSession[]>(
        'GET',
        '/sessions',
        undefined,
        SessionsListResponseSchema
      );

      const duration = Date.now() - startTime;
      this.logAudit({
        timestamp: new Date(),
        operation,
        status: 'success',
        duration,
        metadata: { sessionCount: response.length },
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logAudit({
        timestamp: new Date(),
        operation,
        status: 'error',
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // =============================================================================
  // Browser Actions
  // =============================================================================

  async goto(
    sessionId: SessionId,
    url: string,
    screenshot = false
  ): Promise<BrowserAction> {
    return this.executeAction({
      sessionId,
      type: 'navigate',
      url,
      screenshot,
    });
  }

  async click(
    sessionId: SessionId,
    url: string,
    selector: string,
    screenshot = false
  ): Promise<BrowserAction> {
    return this.executeAction({
      sessionId,
      type: 'click',
      url,
      selector,
      screenshot,
    });
  }

  async type(
    sessionId: SessionId,
    url: string,
    selector: string,
    text: string,
    screenshot = false
  ): Promise<BrowserAction> {
    return this.executeAction({
      sessionId,
      type: 'type',
      url,
      selector,
      data: { text },
      screenshot,
    });
  }

  async waitFor(
    sessionId: SessionId,
    url: string,
    selector?: string,
    timeout?: number,
    screenshot = false
  ): Promise<BrowserAction> {
    return this.executeAction({
      sessionId,
      type: 'wait',
      url,
      selector,
      data: { timeout },
      screenshot,
    });
  }

  async screenshot(sessionId: SessionId, url: string): Promise<BrowserAction> {
    return this.executeAction({
      sessionId,
      type: 'screenshot',
      url,
      screenshot: true,
    });
  }

  async extract(
    sessionId: SessionId,
    url: string,
    selector?: string
  ): Promise<BrowserAction> {
    return this.executeAction({
      sessionId,
      type: 'extract',
      url,
      selector,
    });
  }

  async executeAction(request: ExecuteActionRequest): Promise<BrowserAction> {
    const startTime = Date.now();
    const operation = 'executeAction';

    try {
      // Validate request
      const validatedRequest = ExecuteActionRequestSchema.parse(request);

      const response = await this.makeRequest<BrowserAction>(
        'POST',
        '/actions',
        validatedRequest,
        ActionResponseSchema
      );

      const duration = Date.now() - startTime;
      this.logAudit({
        timestamp: new Date(),
        operation,
        sessionId: request.sessionId,
        actionId: response.id,
        url: request.url,
        status: 'success',
        duration,
        metadata: {
          actionType: request.type,
          selector: request.selector,
          screenshot: request.screenshot,
        },
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logAudit({
        timestamp: new Date(),
        operation,
        sessionId: request.sessionId,
        url: request.url,
        status: 'error',
        duration,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          actionType: request.type,
          selector: request.selector,
        },
      });
      throw error;
    }
  }

  async getAction(actionId: string): Promise<BrowserAction> {
    const startTime = Date.now();
    const operation = 'getAction';

    try {
      const response = await this.makeRequest<BrowserAction>(
        'GET',
        `/actions/${actionId}`,
        undefined,
        ActionResponseSchema
      );

      const duration = Date.now() - startTime;
      this.logAudit({
        timestamp: new Date(),
        operation,
        actionId,
        status: 'success',
        duration,
        metadata: { actionId },
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logAudit({
        timestamp: new Date(),
        operation,
        actionId,
        status: 'error',
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getActions(filters: ActionFilters = {}): Promise<ActionsListResult> {
    const startTime = Date.now();
    const operation = 'getActions';

    try {
      const params = new URLSearchParams();
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.status) params.append('status', filters.status);
      if (filters.type) params.append('type', filters.type);

      const response = await this.makeRequest<ActionsListResult>(
        'GET',
        `/actions?${params.toString()}`,
        undefined,
        ActionsListResponseSchema
      );

      const duration = Date.now() - startTime;
      this.logAudit({
        timestamp: new Date(),
        operation,
        status: 'success',
        duration,
        metadata: {
          filters,
          actionCount: response.actions.length,
          total: response.pagination.total,
        },
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logAudit({
        timestamp: new Date(),
        operation,
        status: 'error',
        duration,
        error: error instanceof Error ? error.message : String(error),
        metadata: { filters },
      });
      throw error;
    }
  }

  // =============================================================================
  // Utility Methods
  // =============================================================================

  async waitForAction(
    actionId: string,
    timeout = 60000,
    pollInterval = 1000
  ): Promise<BrowserAction> {
    const startTime = Date.now();
    const operation = 'waitForAction';

    try {
      while (Date.now() - startTime < timeout) {
        const action = await this.getAction(actionId);

        if (action.status === 'completed') {
          const duration = Date.now() - startTime;
          this.logAudit({
            timestamp: new Date(),
            operation,
            actionId,
            status: 'success',
            duration,
            metadata: { actionId, finalStatus: action.status },
          });
          return action;
        }

        if (action.status === 'failed') {
          const duration = Date.now() - startTime;
          this.logAudit({
            timestamp: new Date(),
            operation,
            actionId,
            status: 'error',
            duration,
            error: action.result?.error || 'Action failed',
            metadata: { actionId, finalStatus: action.status },
          });
          throw new Error(
            `Action failed: ${action.result?.error || 'Unknown error'}`
          );
        }

        await this.sleep(pollInterval);
      }

      const duration = Date.now() - startTime;
      this.logAudit({
        timestamp: new Date(),
        operation,
        actionId,
        status: 'error',
        duration,
        error: 'Timeout waiting for action completion',
        metadata: { actionId, timeout },
      });
      throw new Error(`Timeout waiting for action completion: ${actionId}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Timeout')) {
        throw error;
      }
      const duration = Date.now() - startTime;
      this.logAudit({
        timestamp: new Date(),
        operation,
        actionId,
        status: 'error',
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // =============================================================================
  // Internal Methods
  // =============================================================================

  private async makeRequest<T>(
    method: string,
    path: string,
    body?: unknown,
    responseSchema?: z.ZodSchema<T>
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await this.executeWithRetries(async () => {
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        const responseStatus = response.status;
        const responseStatusText = response.statusText;

        if (!response.ok) {
          throw new Error(`HTTP ${responseStatus}: ${responseStatusText}`);
        }

        const data = await response.json();

        if (responseSchema) {
          const validated = responseSchema.parse(data);
          const v = validated as unknown as { data?: T };
          return (v.data as T) ?? (data as T);
        }

        return data as T;
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async executeWithRetries<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on certain errors
        if (this.isNonRetryableError(lastError)) {
          throw lastError;
        }

        // If this is the last attempt, throw the error
        if (attempt === this.retryConfig.maxRetries) {
          throw lastError;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt);

        logger.warn(
          {
            attempt: attempt + 1,
            maxRetries: this.retryConfig.maxRetries,
            delay,
            error: lastError.message,
          },
          'Browser client request failed, retrying'
        );

        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  private isNonRetryableError(error: Error): boolean {
    const nonRetryableErrors = [
      'HTTP 400',
      'HTTP 401',
      'HTTP 403',
      'HTTP 404',
      'HTTP 422',
    ];

    return nonRetryableErrors.some(errType => error.message.includes(errType));
  }

  private calculateDelay(attempt: number): number {
    const delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(2, attempt),
      this.retryConfig.maxDelay
    );

    if (this.retryConfig.jitter) {
      // Add jitter (±25% of the delay)
      const jitter = delay * 0.25 * (Math.random() - 0.5);
      return Math.max(0, delay + jitter);
    }

    return delay;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private logAudit(entry: AuditLogEntry): void {
    if (this.config.enableAuditLog && this.auditLogger) {
      try {
        this.auditLogger.log(entry);
      } catch (error) {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          'Failed to log audit entry'
        );
      }
    }
  }

  // =============================================================================
  // Configuration Methods
  // =============================================================================

  setAuditLogger(auditLogger: AuditLogger): void {
    this.auditLogger = auditLogger;
  }

  setRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  setConfig(config: Partial<BrowserClientConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// =============================================================================
// Default Audit Logger Implementation
// =============================================================================

export class ConsoleAuditLogger implements AuditLogger {
  log(entry: AuditLogEntry): void {
    const logLevel = entry.status === 'success' ? 'info' : 'error';
    logger[logLevel](
      {
        operation: entry.operation,
        sessionId: entry.sessionId,
        actionId: entry.actionId,
        url: entry.url,
        duration: entry.duration,
        error: entry.error,
        metadata: entry.metadata,
      },
      `Browser client ${entry.operation}`
    );
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createBrowserClient(
  baseUrl: string,
  config?: Partial<BrowserClientConfig>,
  auditLogger?: AuditLogger
): BrowserClient {
  return new BrowserClient({ baseUrl, ...config }, auditLogger);
}
