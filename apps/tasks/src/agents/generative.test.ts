import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GenerativeAgent } from './generative.js';

// Mock dependencies
vi.mock('../services/llm/index.js');
vi.mock('../services/audit.js');
vi.mock('@bharat-agents/shared', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  trackLLMCost: vi.fn().mockReturnValue(0.001),
}));

describe('GenerativeAgent', () => {
  let agent: GenerativeAgent;
  let mockLLM: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock LLM
    mockLLM = {
      name: 'openai',
      complete: vi.fn(),
      getDefaultModel: vi.fn().mockReturnValue('gpt-3.5-turbo'),
    };
    
    const { getLLM } = require('../services/llm/index.js');
    getLLM.mockReturnValue(mockLLM);
    
    agent = new GenerativeAgent();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('runNode', () => {
    it('should generate text content successfully', async () => {
      const runArgs = {
        runId: 'run-123',
        nodeId: 'node-456',
        input: JSON.stringify({
          instructions: 'Write a short story about a robot',
          format: 'text',
        }),
      };

      // Mock LLM response
      mockLLM.complete.mockResolvedValue({
        text: 'Once upon a time, there was a robot named R2D2...',
        inputTokens: 10,
        outputTokens: 50,
      });

      const result = await agent.runNode(runArgs);

      expect(result.output).toBeDefined();
      expect(result.meta).toBeDefined();
      expect(result.meta?.success).toBe(true);
      expect(result.meta?.format).toBe('text');
      expect(result.meta?.inputTokens).toBe(10);
      expect(result.meta?.outputTokens).toBe(50);
      expect(result.meta?.cost).toBe(0.001);

      // Verify LLM was called correctly
      expect(mockLLM.complete).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        prompt: 'Write a short story about a robot',
        temperature: 0.7,
        maxTokens: 1000,
      });
    });

    it('should generate JSON content successfully', async () => {
      const runArgs = {
        runId: 'run-123',
        nodeId: 'node-456',
        input: JSON.stringify({
          instructions: 'Create a user profile',
          format: 'json',
          schema: 'z.object({ name: z.string(), age: z.number() })',
        }),
      };

      // Mock LLM response
      mockLLM.complete.mockResolvedValue({
        text: '{"name": "John Doe", "age": 30}',
        inputTokens: 15,
        outputTokens: 25,
      });

      const result = await agent.runNode(runArgs);

      expect(result.output).toBeDefined();
      expect(result.meta?.success).toBe(true);
      expect(result.meta?.format).toBe('json');

      // Verify LLM was called with JSON mode
      expect(mockLLM.complete).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        system: expect.stringContaining('valid JSON only'),
        prompt: 'Create a user profile',
        temperature: 0.1,
        maxTokens: 1000,
        json: true,
      });
    });

    it('should handle JSON generation with schema validation retry', async () => {
      const runArgs = {
        runId: 'run-123',
        nodeId: 'node-456',
        input: JSON.stringify({
          instructions: 'Create a user profile',
          format: 'json',
          schema: 'z.object({ name: z.string(), age: z.number() })',
        }),
      };

      // Mock first attempt with invalid JSON
      mockLLM.complete
        .mockResolvedValueOnce({
          text: '{"name": "John Doe"}', // Missing age field
          inputTokens: 15,
          outputTokens: 20,
        })
        .mockResolvedValueOnce({
          text: '{"name": "John Doe", "age": 30}', // Valid JSON
          inputTokens: 15,
          outputTokens: 25,
        });

      const result = await agent.runNode(runArgs);

      expect(result.output).toBeDefined();
      expect(result.meta?.success).toBe(true);

      // Verify LLM was called twice (initial + retry)
      expect(mockLLM.complete).toHaveBeenCalledTimes(2);
    });

    it('should handle JSON generation failure after retries', async () => {
      const runArgs = {
        runId: 'run-123',
        nodeId: 'node-456',
        input: JSON.stringify({
          instructions: 'Create a user profile',
          format: 'json',
          schema: 'z.object({ name: z.string(), age: z.number() })',
        }),
      };

      // Mock both attempts to fail
      mockLLM.complete
        .mockResolvedValueOnce({
          text: 'Invalid JSON response',
          inputTokens: 15,
          outputTokens: 20,
        })
        .mockResolvedValueOnce({
          text: 'Still invalid JSON',
          inputTokens: 15,
          outputTokens: 20,
        });

      const result = await agent.runNode(runArgs);

      expect(result.meta?.success).toBe(false);
      expect(JSON.parse(result.output).error).toContain('No valid JSON found');

      // Verify LLM was called twice
      expect(mockLLM.complete).toHaveBeenCalledTimes(2);
    });

    it('should handle invalid schema definition', async () => {
      const runArgs = {
        runId: 'run-123',
        nodeId: 'node-456',
        input: JSON.stringify({
          instructions: 'Create a user profile',
          format: 'json',
          schema: 'invalid schema syntax',
        }),
      };

      const result = await agent.runNode(runArgs);

      expect(result.meta?.success).toBe(false);
      expect(JSON.parse(result.output).error).toContain('Invalid schema definition');
    });

    it('should handle LLM service errors gracefully', async () => {
      const runArgs = {
        runId: 'run-123',
        nodeId: 'node-456',
        input: JSON.stringify({
          instructions: 'Write a story',
          format: 'text',
        }),
      };

      // Mock LLM to throw an error
      mockLLM.complete.mockRejectedValue(new Error('LLM service unavailable'));

      const result = await agent.runNode(runArgs);

      expect(result.meta?.success).toBe(false);
      expect(JSON.parse(result.output).error).toContain('LLM service unavailable');
    });

    it('should track costs correctly', async () => {
      const runArgs = {
        runId: 'run-123',
        nodeId: 'node-456',
        input: JSON.stringify({
          instructions: 'Write a story',
          format: 'text',
        }),
      };

      mockLLM.complete.mockResolvedValue({
        text: 'A great story...',
        inputTokens: 10,
        outputTokens: 50,
      });

      const { trackLLMCost } = require('@bharat-agents/shared');

      const result = await agent.runNode(runArgs);

      expect(result.meta?.cost).toBe(0.001);
      expect(trackLLMCost).toHaveBeenCalledWith({
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        inputTokens: 10,
        outputTokens: 50,
      });
    });

    it('should use default format when not specified', async () => {
      const runArgs = {
        runId: 'run-123',
        nodeId: 'node-456',
        input: JSON.stringify({
          instructions: 'Write a story',
          // format not specified, should default to 'text'
        }),
      };

      mockLLM.complete.mockResolvedValue({
        text: 'A great story...',
        inputTokens: 10,
        outputTokens: 50,
      });

      const result = await agent.runNode(runArgs);

      expect(result.meta?.format).toBe('text');
      expect(mockLLM.complete).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        prompt: 'Write a story',
        temperature: 0.7,
        maxTokens: 1000,
      });
    });

    it('should handle JSON extraction from markdown-wrapped responses', async () => {
      const runArgs = {
        runId: 'run-123',
        nodeId: 'node-456',
        input: JSON.stringify({
          instructions: 'Create a user profile',
          format: 'json',
        }),
      };

      // Mock LLM response with JSON wrapped in markdown
      mockLLM.complete.mockResolvedValue({
        text: 'Here is the user profile:\n\n```json\n{"name": "John Doe", "age": 30}\n```',
        inputTokens: 15,
        outputTokens: 40,
      });

      const result = await agent.runNode(runArgs);

      expect(result.meta?.success).toBe(true);
      expect(JSON.parse(result.output).text).toContain('{"name": "John Doe", "age": 30}');
    });

    it('should record audit logs for all actions', async () => {
      const runArgs = {
        runId: 'run-123',
        nodeId: 'node-456',
        input: JSON.stringify({
          instructions: 'Write a story',
          format: 'text',
        }),
      };

      mockLLM.complete.mockResolvedValue({
        text: 'A great story...',
        inputTokens: 10,
        outputTokens: 50,
      });

      const { record } = require('../services/audit.js');

      await agent.runNode(runArgs);

      // Verify audit logs were recorded
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run-123',
          nodeId: 'node-456',
          action: 'generative_start',
          status: 'OK',
        })
      );

      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run-123',
          nodeId: 'node-456',
          action: 'generative_text_generated',
          status: 'OK',
        })
      );

      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run-123',
          nodeId: 'node-456',
          action: 'generative_complete',
          status: 'OK',
        })
      );
    });
  });
});
