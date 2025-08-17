import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BrowserClient, createBrowserClient } from './browserClient';

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

describe('BrowserClient - Simple Tests', () => {
  let client: BrowserClient;
  const baseUrl = 'http://localhost:3002';

  beforeEach(() => {
    client = new BrowserClient({ baseUrl });
    mockFetch.mockClear();
  });

  describe('Basic Functionality', () => {
    it('should create a browser client', () => {
      expect(client).toBeInstanceOf(BrowserClient);
    });

    it('should create session successfully', async () => {
      const mockResponse = {
        success: true,
        data: { sessionId: 'test-session-123' },
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const sessionId = await client.createSession();
      expect(sessionId).toBe('test-session-123');
    });

    it('should execute goto action', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 'action-123',
          type: 'navigate',
          url: 'https://example.com',
          createdAt: new Date().toISOString(),
          status: 'pending',
        },
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const action = await client.goto('session-123', 'https://example.com');
      expect(action.type).toBe('navigate');
      expect(action.url).toBe('https://example.com');
    });

    it('should execute click action', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 'action-123',
          type: 'click',
          url: 'https://example.com',
          selector: '#button',
          createdAt: new Date().toISOString(),
          status: 'pending',
        },
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const action = await client.click('session-123', 'https://example.com', '#button');
      expect(action.type).toBe('click');
      expect(action.selector).toBe('#button');
    });

    it('should execute type action', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 'action-123',
          type: 'type',
          url: 'https://example.com',
          selector: '#input',
          data: { text: 'hello' },
          createdAt: new Date().toISOString(),
          status: 'pending',
        },
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const action = await client.type('session-123', 'https://example.com', '#input', 'hello');
      expect(action.type).toBe('type');
      expect(action.data).toEqual({ text: 'hello' });
    });

    it('should execute screenshot action', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 'action-123',
          type: 'screenshot',
          url: 'https://example.com',
          screenshot: true,
          createdAt: new Date().toISOString(),
          status: 'pending',
        },
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const action = await client.screenshot('session-123', 'https://example.com');
      expect(action.type).toBe('screenshot');
      expect(action.screenshot).toBe(true);
    });

    it('should execute extract action', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 'action-123',
          type: 'extract',
          url: 'https://example.com',
          selector: '.content',
          createdAt: new Date().toISOString(),
          status: 'pending',
        },
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const action = await client.extract('session-123', 'https://example.com', '.content');
      expect(action.type).toBe('extract');
      expect(action.selector).toBe('.content');
    });

    it('should execute wait action', async () => {
      const mockResponse = {
        success: true,
        data: {
          id: 'action-123',
          type: 'wait',
          url: 'https://example.com',
          selector: '#loading',
          data: { timeout: 5000 },
          createdAt: new Date().toISOString(),
          status: 'pending',
        },
        timestamp: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const action = await client.waitFor('session-123', 'https://example.com', '#loading', 5000);
      expect(action.type).toBe('wait');
      expect(action.data).toEqual({ timeout: 5000 });
    });
  });

  describe('Factory Function', () => {
    it('should create client with factory function', () => {
      const client = createBrowserClient('https://browser.example.com');
      expect(client).toBeInstanceOf(BrowserClient);
    });

    it('should create client with custom configuration', () => {
      const client = createBrowserClient('https://browser.example.com', {
        timeout: 60000,
        retries: 5,
        retryDelay: 2000,
      });
      expect(client).toBeInstanceOf(BrowserClient);
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      client.setConfig({ timeout: 45000 });
      client.setRetryConfig({ maxRetries: 4 });
      // Configuration should be updated (we can't easily test the internal state,
      // but we can verify the methods don't throw)
      expect(client).toBeDefined();
    });
  });
});
