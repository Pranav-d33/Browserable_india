import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BrowserClient, createBrowserClient, ConsoleAuditLogger } from './browserClient';
import type { BrowserAction, BrowserSession, ExecuteActionRequest } from './browserClient';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock logger
vi.mock('@bharat-agents/shared', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('BrowserClient', () => {
  let client: BrowserClient;
  const baseUrl = 'http://localhost:3002';

  beforeEach(() => {
    client = new BrowserClient({ baseUrl });
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Management', () => {
    it('should create a session successfully', async () => {
      const mockResponse = {
        success: true,
        data: { sessionId: 'test-session-123' },
        message: 'Browser session launched successfully',
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const sessionId = await client.createSession();

      expect(sessionId).toBe('test-session-123');
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/launch`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        })
      );
    });

    it('should close a session successfully', async () => {
      const mockResponse = {
        success: true,
        data: { sessionId: 'test-session-123' },
        message: 'Browser session closed successfully',
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await client.closeSession('test-session-123');

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/close/test-session-123`,
        expect.objectContaining({
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        })
      );
    });

    it('should list sessions successfully', async () => {
      const mockSessions: BrowserSession[] = [
        {
          sessionId: 'session-1',
          createdAt: new Date(),
          lastUsed: new Date(),
          isActive: true,
        },
        {
          sessionId: 'session-2',
          createdAt: new Date(),
          lastUsed: new Date(),
          isActive: false,
        },
      ];

      const mockResponse = {
        success: true,
        data: mockSessions.map(session => ({
          ...session,
          createdAt: session.createdAt.toISOString(),
          lastUsed: session.lastUsed.toISOString(),
        })),
        message: 'Browser sessions retrieved successfully',
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const sessions = await client.listSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions[0].sessionId).toBe('session-1');
      expect(sessions[1].sessionId).toBe('session-2');
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/sessions`,
        expect.objectContaining({
          method: 'GET',
        })
      );
    });
  });

  describe('Browser Actions', () => {
    const sessionId = 'test-session-123';

    it('should execute goto action', async () => {
      const mockAction: BrowserAction = {
        id: 'action-123',
        type: 'navigate',
        url: 'https://example.com',
        createdAt: new Date(),
        status: 'pending',
      };

      const mockResponse = {
        success: true,
        data: {
          ...mockAction,
          createdAt: mockAction.createdAt.toISOString(),
        },
        message: 'Browser action executed successfully',
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const action = await client.goto(sessionId, 'https://example.com');

      expect(action.type).toBe('navigate');
      expect(action.url).toBe('https://example.com');
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/actions`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            sessionId,
            type: 'navigate',
            url: 'https://example.com',
            screenshot: false,
          }),
        })
      );
    });

    it('should execute click action', async () => {
      const mockAction: BrowserAction = {
        id: 'action-123',
        type: 'click',
        url: 'https://example.com',
        selector: '#submit-button',
        createdAt: new Date(),
        status: 'pending',
      };

      const mockResponse = {
        success: true,
        data: {
          ...mockAction,
          createdAt: mockAction.createdAt.toISOString(),
        },
        message: 'Browser action executed successfully',
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const action = await client.click(sessionId, 'https://example.com', '#submit-button');

      expect(action.type).toBe('click');
      expect(action.selector).toBe('#submit-button');
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/actions`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            sessionId,
            type: 'click',
            url: 'https://example.com',
            selector: '#submit-button',
            screenshot: false,
          }),
        })
      );
    });

    it('should execute type action', async () => {
      const mockAction: BrowserAction = {
        id: 'action-123',
        type: 'type',
        url: 'https://example.com',
        selector: '#search-input',
        data: { text: 'search term' },
        createdAt: new Date(),
        status: 'pending',
      };

      const mockResponse = {
        success: true,
        data: {
          ...mockAction,
          createdAt: mockAction.createdAt.toISOString(),
        },
        message: 'Browser action executed successfully',
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const action = await client.type(sessionId, 'https://example.com', '#search-input', 'search term');

      expect(action.type).toBe('type');
      expect(action.selector).toBe('#search-input');
      expect(action.data).toEqual({ text: 'search term' });
    });

    it('should execute wait action', async () => {
      const mockAction: BrowserAction = {
        id: 'action-123',
        type: 'wait',
        url: 'https://example.com',
        selector: '#loading-spinner',
        data: { timeout: 5000 },
        createdAt: new Date(),
        status: 'pending',
      };

      const mockResponse = {
        success: true,
        data: {
          ...mockAction,
          createdAt: mockAction.createdAt.toISOString(),
        },
        message: 'Browser action executed successfully',
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const action = await client.waitFor(sessionId, 'https://example.com', '#loading-spinner', 5000);

      expect(action.type).toBe('wait');
      expect(action.selector).toBe('#loading-spinner');
      expect(action.data).toEqual({ timeout: 5000 });
    });

    it('should execute screenshot action', async () => {
      const mockAction: BrowserAction = {
        id: 'action-123',
        type: 'screenshot',
        url: 'https://example.com',
        screenshot: true,
        createdAt: new Date(),
        status: 'pending',
      };

      const mockResponse = {
        success: true,
        data: {
          ...mockAction,
          createdAt: mockAction.createdAt.toISOString(),
        },
        message: 'Browser action executed successfully',
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const action = await client.screenshot(sessionId, 'https://example.com');

      expect(action.type).toBe('screenshot');
      expect(action.screenshot).toBe(true);
    });

    it('should execute extract action', async () => {
      const mockAction: BrowserAction = {
        id: 'action-123',
        type: 'extract',
        url: 'https://example.com',
        selector: '.content',
        createdAt: new Date(),
        status: 'pending',
      };

      const mockResponse = {
        success: true,
        data: {
          ...mockAction,
          createdAt: mockAction.createdAt.toISOString(),
        },
        message: 'Browser action executed successfully',
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const action = await client.extract(sessionId, 'https://example.com', '.content');

      expect(action.type).toBe('extract');
      expect(action.selector).toBe('.content');
    });
  });

  describe('Action Management', () => {
    it('should get action by ID', async () => {
      const mockAction: BrowserAction = {
        id: 'action-123',
        type: 'navigate',
        url: 'https://example.com',
        createdAt: new Date(),
        status: 'completed',
        result: {
          success: true,
          data: { url: 'https://example.com' },
          timestamp: new Date(),
        },
      };

      const mockResponse = {
        success: true,
        data: {
          ...mockAction,
          createdAt: mockAction.createdAt.toISOString(),
          result: {
            ...mockAction.result!,
            timestamp: mockAction.result!.timestamp.toISOString(),
          },
        },
        message: 'Browser action retrieved successfully',
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const action = await client.getAction('action-123');

      expect(action.id).toBe('action-123');
      expect(action.status).toBe('completed');
      expect(action.result?.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/actions/action-123`,
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should get actions with filters', async () => {
      const mockActions: BrowserAction[] = [
        {
          id: 'action-1',
          type: 'navigate',
          url: 'https://example.com',
          createdAt: new Date(),
          status: 'completed',
        },
        {
          id: 'action-2',
          type: 'click',
          url: 'https://example.com',
          selector: '#button',
          createdAt: new Date(),
          status: 'completed',
        },
      ];

      const mockResponse = {
        success: true,
        data: mockActions.map(action => ({
          ...action,
          createdAt: action.createdAt.toISOString(),
        })),
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        },
        message: 'Browser actions retrieved successfully',
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getActions({
        page: 1,
        limit: 10,
        status: 'completed',
        type: 'navigate',
      });

      expect(result.actions).toBeDefined();
      expect(result.actions?.length).toBe(2);
      expect(result.pagination?.total).toBe(2);
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/actions?page=1&limit=10&status=completed&type=navigate`,
        expect.objectContaining({
          method: 'GET',
        })
      );
    });
  });

  describe('Utility Methods', () => {
    it('should wait for action completion', async () => {
      const pendingAction: BrowserAction = {
        id: 'action-123',
        type: 'navigate',
        url: 'https://example.com',
        createdAt: new Date(),
        status: 'pending',
      };

      const completedAction: BrowserAction = {
        id: 'action-123',
        type: 'navigate',
        url: 'https://example.com',
        createdAt: new Date(),
        status: 'completed',
        result: {
          success: true,
          data: { url: 'https://example.com' },
          timestamp: new Date(),
        },
      };

      // First call returns pending, second call returns completed
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              ...pendingAction,
              createdAt: pendingAction.createdAt.toISOString(),
            },
            timestamp: new Date().toISOString(),
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              ...completedAction,
              createdAt: completedAction.createdAt.toISOString(),
              result: {
                ...completedAction.result!,
                timestamp: completedAction.result!.timestamp.toISOString(),
              },
            },
            timestamp: new Date().toISOString(),
          }),
        });

      const action = await client.waitForAction('action-123', 10000, 100);

      expect(action.status).toBe('completed');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should timeout waiting for action', async () => {
      const pendingAction: BrowserAction = {
        id: 'action-123',
        type: 'navigate',
        url: 'https://example.com',
        createdAt: new Date(),
        status: 'pending',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            ...pendingAction,
            createdAt: pendingAction.createdAt.toISOString(),
          },
          timestamp: new Date().toISOString(),
        }),
      });

      await expect(client.waitForAction('action-123', 100)).rejects.toThrow('Timeout waiting for action completion');
    });
  });

  describe('Error Handling', () => {
    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.createSession()).rejects.toThrow('HTTP 500: Internal Server Error');
    }, 10000);

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.createSession()).rejects.toThrow('Network error');
    }, 10000);

    it('should retry on transient errors', async () => {
      const successResponse = {
        ok: true,
        json: async () => ({
          success: true,
          data: { sessionId: 'test-session-123' },
          timestamp: new Date().toISOString(),
        }),
      };

      // First call fails, second call succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockResolvedValueOnce(successResponse);

      const sessionId = await client.createSession();

      expect(sessionId).toBe('test-session-123');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on client errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      await expect(client.createSession()).rejects.toThrow('HTTP 400: Bad Request');
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retry
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration', () => {
      const customClient = new BrowserClient({
        baseUrl: 'https://custom-browser.example.com',
        timeout: 60000,
        retries: 5,
        retryDelay: 2000,
        enableAuditLog: false,
      });

      expect(customClient).toBeInstanceOf(BrowserClient);
    });

    it('should update configuration', () => {
      client.setConfig({ timeout: 45000 });
      client.setRetryConfig({ maxRetries: 4 });
    });

    it('should set audit logger', () => {
      const auditLogger = new ConsoleAuditLogger();
      client.setAuditLogger(auditLogger);
    });
  });

  describe('Factory Function', () => {
    it('should create client with factory function', () => {
      const client = createBrowserClient('https://browser.example.com', {
        timeout: 30000,
        retries: 3,
      });

      expect(client).toBeInstanceOf(BrowserClient);
    });

    it('should create client with audit logger', () => {
      const auditLogger = new ConsoleAuditLogger();
      const client = createBrowserClient('https://browser.example.com', {}, auditLogger);

      expect(client).toBeInstanceOf(BrowserClient);
    });
  });

  describe('Request Validation', () => {
    it('should validate execute action request', async () => {
      const invalidRequest = {
        sessionId: 'test-session',
        type: 'invalid-type',
        url: 'not-a-url',
      } as ExecuteActionRequest;

      await expect(client.executeAction(invalidRequest)).rejects.toThrow();
    });

    it('should validate URL format', async () => {
      await expect(client.goto('session-123', 'not-a-url')).rejects.toThrow();
    });
  });
});
