import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserAgent } from './browser.js';
import { BrowserClient } from '../services/browserClient.js';

// Mock dependencies
vi.mock('../services/browserClient.js');
vi.mock('../services/llm/index.js');
vi.mock('../services/audit.js');
vi.mock('@bharat-agents/shared', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('BrowserAgent', () => {
  let agent: BrowserAgent;
  let mockBrowserClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock BrowserClient
    mockBrowserClient = {
      createSession: vi.fn(),
      closeSession: vi.fn(),
      goto: vi.fn(),
      click: vi.fn(),
      type: vi.fn(),
      waitFor: vi.fn(),
      screenshot: vi.fn(),
      extract: vi.fn(),
    };

    (BrowserClient as any).mockImplementation(() => mockBrowserClient);

    agent = new BrowserAgent();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('runNode', () => {
    it('should execute browser automation with provided steps', async () => {
      const runArgs = {
        runId: 'run-123',
        nodeId: 'node-456',
        input: JSON.stringify({
          instructions: 'Go to example.com and click the login button',
          steps: [
            { action: 'goto', url: 'https://example.com' },
            { action: 'click', selector: 'button[data-testid="login"]' },
          ],
        }),
      };

      // Mock browser client responses
      mockBrowserClient.createSession.mockResolvedValue({ id: 'session-123' });
      mockBrowserClient.goto.mockResolvedValue({
        id: 'action-1',
        status: 'completed',
        result: { success: true },
      });
      mockBrowserClient.click.mockResolvedValue({
        id: 'action-2',
        status: 'completed',
        result: { success: true },
      });
      mockBrowserClient.screenshot.mockResolvedValue({
        id: 'action-3',
        status: 'completed',
        result: {
          success: true,
          screenshot: 'https://example.com/screenshot.png',
        },
      });
      mockBrowserClient.closeSession.mockResolvedValue(undefined);

      const result = await agent.runNode(runArgs);

      expect(result.output).toBeDefined();
      expect(result.meta).toBeDefined();
      expect(result.meta?.success).toBe(true);
      expect(result.meta?.steps).toBe(2);

      // Verify browser client was called correctly
      expect(mockBrowserClient.createSession).toHaveBeenCalled();
      expect(mockBrowserClient.goto).toHaveBeenCalledWith(
        'session-123',
        'https://example.com'
      );
      expect(mockBrowserClient.click).toHaveBeenCalledWith(
        'session-123',
        'current',
        'button[data-testid="login"]'
      );
      expect(mockBrowserClient.closeSession).toHaveBeenCalledWith(
        'session-123'
      );
    });

    it('should generate steps from instructions when not provided', async () => {
      const runArgs = {
        runId: 'run-123',
        nodeId: 'node-456',
        input: JSON.stringify({
          instructions: 'Go to example.com and click the login button',
        }),
      };

      // Mock LLM response for step generation
      const mockLLM = {
        complete: vi.fn().mockResolvedValue({
          text: JSON.stringify([
            { action: 'goto', url: 'https://example.com' },
            { action: 'click', selector: 'button[data-testid="login"]' },
          ]),
        }),
        getDefaultModel: vi.fn().mockReturnValue('gpt-3.5-turbo'),
      };

      const { getLLM } = await import('../services/llm/index.js');
      (getLLM as any).mockReturnValue(mockLLM);

      // Mock browser client responses
      mockBrowserClient.createSession.mockResolvedValue({ id: 'session-123' });
      mockBrowserClient.goto.mockResolvedValue({
        id: 'action-1',
        status: 'completed',
        result: { success: true },
      });
      mockBrowserClient.click.mockResolvedValue({
        id: 'action-2',
        status: 'completed',
        result: { success: true },
      });
      mockBrowserClient.screenshot.mockResolvedValue({
        id: 'action-3',
        status: 'completed',
        result: {
          success: true,
          screenshot: 'https://example.com/screenshot.png',
        },
      });
      mockBrowserClient.closeSession.mockResolvedValue(undefined);

      const result = await agent.runNode(runArgs);

      expect(result.output).toBeDefined();
      expect(result.meta?.success).toBe(true);

      // Verify LLM was called for step generation
      expect(mockLLM.complete).toHaveBeenCalled();
    });

    it('should respect step limits from environment', async () => {
      const originalMaxSteps = process.env.BROWSER_MAX_STEPS;
      process.env.BROWSER_MAX_STEPS = '2';

      const runArgs = {
        runId: 'run-123',
        nodeId: 'node-456',
        input: JSON.stringify({
          instructions: 'Test instructions',
          steps: [
            { action: 'goto', url: 'https://example.com' },
            { action: 'click', selector: 'button1' },
            { action: 'click', selector: 'button2' }, // This should exceed the limit
          ],
        }),
      };

      const result = await agent.runNode(runArgs);

      expect(result.meta?.success).toBe(false);
      expect(JSON.parse(result.output).error).toContain('Too many steps');

      // Restore environment
      if (originalMaxSteps) {
        process.env.BROWSER_MAX_STEPS = originalMaxSteps;
      } else {
        delete process.env.BROWSER_MAX_STEPS;
      }
    });

    it('should respect duration limits from environment', async () => {
      const originalMaxDuration = process.env.BROWSER_MAX_DURATION_MS;
      process.env.BROWSER_MAX_DURATION_MS = '100'; // Very short duration

      const runArgs = {
        runId: 'run-123',
        nodeId: 'node-456',
        input: JSON.stringify({
          instructions: 'Test instructions',
          steps: [
            { action: 'goto', url: 'https://example.com' },
            { action: 'wait', wait: 200 }, // This should exceed the duration limit
          ],
        }),
      };

      // Mock browser client to simulate slow operations
      mockBrowserClient.createSession.mockResolvedValue({ id: 'session-123' });
      mockBrowserClient.goto.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 150))
      );
      mockBrowserClient.closeSession.mockResolvedValue(undefined);

      const result = await agent.runNode(runArgs);

      expect(result.meta?.success).toBe(false);
      expect(JSON.parse(result.output).error).toContain(
        'Exceeded maximum duration'
      );

      // Restore environment
      if (originalMaxDuration) {
        process.env.BROWSER_MAX_DURATION_MS = originalMaxDuration;
      } else {
        delete process.env.BROWSER_MAX_DURATION_MS;
      }
    });

    it('should handle browser client errors gracefully', async () => {
      const runArgs = {
        runId: 'run-123',
        nodeId: 'node-456',
        input: JSON.stringify({
          instructions: 'Test instructions',
          steps: [{ action: 'goto', url: 'https://example.com' }],
        }),
      };

      // Mock browser client to throw an error
      mockBrowserClient.createSession.mockRejectedValue(
        new Error('Browser service unavailable')
      );

      const result = await agent.runNode(runArgs);

      expect(result.meta?.success).toBe(false);
      expect(JSON.parse(result.output).error).toContain(
        'Browser service unavailable'
      );
    });

    it('should extract data when extract flag is set', async () => {
      const runArgs = {
        runId: 'run-123',
        nodeId: 'node-456',
        input: JSON.stringify({
          instructions: 'Extract data from example.com',
          steps: [
            { action: 'goto', url: 'https://example.com' },
            { action: 'extract', selector: '.user-profile', extract: true },
          ],
        }),
      };

      // Mock browser client responses
      mockBrowserClient.createSession.mockResolvedValue({ id: 'session-123' });
      mockBrowserClient.goto.mockResolvedValue({
        id: 'action-1',
        status: 'completed',
        result: { success: true },
      });
      mockBrowserClient.extract.mockResolvedValue({
        id: 'action-2',
        status: 'completed',
        result: {
          success: true,
          data: { name: 'John Doe', email: 'john@example.com' },
        },
      });
      mockBrowserClient.screenshot.mockResolvedValue({
        id: 'action-3',
        status: 'completed',
        result: {
          success: true,
          screenshot: 'https://example.com/screenshot.png',
        },
      });
      mockBrowserClient.closeSession.mockResolvedValue(undefined);

      const result = await agent.runNode(runArgs);

      expect(result.output).toBeDefined();
      const output = JSON.parse(result.output);
      expect(output.success).toBe(true);
      expect(output.extractedData).toBeDefined();
      expect(output.extractedData['.user-profile']).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
      });

      // Verify extract was called
      expect(mockBrowserClient.extract).toHaveBeenCalledWith(
        'session-123',
        'current',
        '.user-profile'
      );
    });

    it('should keep session alive when keepAlive is true', async () => {
      const runArgs = {
        runId: 'run-123',
        nodeId: 'node-456',
        input: JSON.stringify({
          instructions: 'Test instructions',
          steps: [{ action: 'goto', url: 'https://example.com' }],
          keepAlive: true,
        }),
      };

      // Mock browser client responses
      mockBrowserClient.createSession.mockResolvedValue({ id: 'session-123' });
      mockBrowserClient.goto.mockResolvedValue({
        id: 'action-1',
        status: 'completed',
        result: { success: true },
      });
      mockBrowserClient.screenshot.mockResolvedValue({
        id: 'action-2',
        status: 'completed',
        result: {
          success: true,
          screenshot: 'https://example.com/screenshot.png',
        },
      });
      // Note: closeSession should not be called when keepAlive is true

      const result = await agent.runNode(runArgs);

      expect(result.output).toBeDefined();
      expect(result.meta?.success).toBe(true);

      // Verify session was created but not closed
      expect(mockBrowserClient.createSession).toHaveBeenCalled();
      expect(mockBrowserClient.closeSession).not.toHaveBeenCalled();
    });
  });
});
