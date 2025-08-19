import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockLLM } from './mock';
import { LLMProvider } from './types';

// Mock the shared logger to avoid console output during tests
vi.mock('@bharat-agents/shared', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  recordLLMTokens: vi.fn(),
  trackLLMCost: vi.fn(() => 0.001),
}));

describe('LLM Provider Adapters', () => {
  describe('MockLLM', () => {
    let mockLLM: MockLLM;

    beforeEach(() => {
      mockLLM = new MockLLM();
    });

    it('should complete requests with mock responses', async () => {
      const response = await mockLLM.complete({
        model: 'test-model',
        prompt: 'Hello, world!',
        temperature: 0.7,
        maxTokens: 100,
      });

      expect(response.text).toContain('Mock response to: "Hello, world!"');
      expect(response.inputTokens).toBeGreaterThan(0);
      expect(response.outputTokens).toBeGreaterThan(0);
    });

    it('should handle JSON mode', async () => {
      const response = await mockLLM.complete({
        model: 'test-model',
        prompt: 'Generate a JSON response',
        json: true,
      });

      expect(() => JSON.parse(response.text)).not.toThrow();
      const parsed = JSON.parse(response.text);
      expect(parsed).toHaveProperty('message');
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('model');
      expect(parsed).toHaveProperty('temperature');
    });

    it('should handle system prompts', async () => {
      const response = await mockLLM.complete({
        model: 'test-model',
        system: 'You are a helpful assistant.',
        prompt: 'What is 2+2?',
      });

      expect(response.text).toContain(
        'System context: You are a helpful assistant.'
      );
    });

    it('should handle tools parameter', async () => {
      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'test_function',
            description: 'A test function',
            parameters: { type: 'object', properties: {} },
          },
        },
      ];

      const response = await mockLLM.complete({
        model: 'test-model',
        prompt: 'Use the tool',
        tools,
      });

      expect(response.text).toContain('Mock response');
      expect(response.inputTokens).toBeGreaterThan(0);
      expect(response.outputTokens).toBeGreaterThan(0);
    });

    it('should estimate tokens correctly', async () => {
      const shortPrompt = 'Hello';
      const longPrompt =
        'This is a much longer prompt that should have more tokens estimated';

      const shortResponse = await mockLLM.complete({
        model: 'test-model',
        prompt: shortPrompt,
      });

      const longResponse = await mockLLM.complete({
        model: 'test-model',
        prompt: longPrompt,
      });

      expect(longResponse.inputTokens).toBeGreaterThan(
        shortResponse.inputTokens
      );
    });
  });

  describe('LLMProvider Interface', () => {
    it('should implement the correct interface', () => {
      const mockLLM = new MockLLM();

      expect(mockLLM).toHaveProperty('name');
      expect(mockLLM).toHaveProperty('complete');
      expect(typeof mockLLM.complete).toBe('function');
      expect(mockLLM.name).toBe('mock');
    });

    it('should return the correct response structure', async () => {
      const mockLLM = new MockLLM();

      const response = await mockLLM.complete({
        model: 'test-model',
        prompt: 'Test',
      });

      expect(response).toHaveProperty('text');
      expect(response).toHaveProperty('inputTokens');
      expect(response).toHaveProperty('outputTokens');
      expect(typeof response.text).toBe('string');
      expect(typeof response.inputTokens).toBe('number');
      expect(typeof response.outputTokens).toBe('number');
    });
  });
});
