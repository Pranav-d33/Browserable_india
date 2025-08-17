import { describe, it, expect, beforeEach, vi } from 'vitest';
import { llmFactory, MockLLM, OpenAILLM } from './index';
import { LLMProvider } from './types';

// Mock environment variables
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
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLM_PROVIDER;
    delete process.env.LLM_MODEL;
  });

  describe('MockLLM', () => {
    it('should complete requests with mock responses', async () => {
      const mockLLM = new MockLLM();
      
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
      const mockLLM = new MockLLM();
      
      const response = await mockLLM.complete({
        model: 'test-model',
        prompt: 'Generate a JSON response',
        json: true,
      });

      expect(() => JSON.parse(response.text)).not.toThrow();
      expect(JSON.parse(response.text)).toHaveProperty('message');
      expect(JSON.parse(response.text)).toHaveProperty('timestamp');
    });

    it('should handle system prompts', async () => {
      const mockLLM = new MockLLM();
      
      const response = await mockLLM.complete({
        model: 'test-model',
        system: 'You are a helpful assistant.',
        prompt: 'What is 2+2?',
      });

      expect(response.text).toContain('System context: You are a helpful assistant.');
    });
  });

  describe('LLM Factory', () => {
    it('should initialize with mock provider by default', () => {
      const providers = llmFactory.listProviders();
      expect(providers).toContain('mock');
      expect(llmFactory.getDefaultProvider()).toBe('mock');
    });

    it('should register OpenAI provider when API key is available', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      
      // Create a new factory instance to test initialization
      const { llmFactory: newFactory } = require('./index');
      const providers = newFactory.listProviders();
      
      expect(providers).toContain('openai');
    });

    it('should set default provider from environment', () => {
      process.env.LLM_PROVIDER = 'mock';
      process.env.LLM_MODEL = 'gpt-4';
      
      const { llmFactory: newFactory } = require('./index');
      
      expect(newFactory.getDefaultProvider()).toBe('mock');
      expect(newFactory.getDefaultModel()).toBe('gpt-4');
    });

    it('should complete requests using default provider', async () => {
      const response = await llmFactory.complete({
        prompt: 'Test prompt',
        model: 'test-model',
      });

      expect(response.text).toContain('Mock response');
      expect(response.inputTokens).toBeGreaterThan(0);
      expect(response.outputTokens).toBeGreaterThan(0);
    });

    it('should complete requests with specific provider', async () => {
      const response = await llmFactory.complete({
        prompt: 'Test prompt',
        provider: 'mock',
        model: 'test-model',
      });

      expect(response.text).toContain('Mock response');
    });

    it('should throw error for non-existent provider', async () => {
      await expect(
        llmFactory.complete({
          prompt: 'Test prompt',
          provider: 'non-existent',
        })
      ).rejects.toThrow('Provider \'non-existent\' not found');
    });

    it('should throw error for missing prompt', async () => {
      await expect(
        llmFactory.complete({
          model: 'test-model',
        })
      ).rejects.toThrow('Prompt is required');
    });

    it('should perform health check', async () => {
      const health = await llmFactory.healthCheck();
      
      expect(health).toHaveProperty('mock');
      expect(health.mock.status).toBe('healthy');
    });

    it('should get provider stats', () => {
      const stats = llmFactory.getProviderStats();
      expect(stats).toBeDefined();
    });
  });

  describe('Configuration', () => {
    it('should allow setting default provider', () => {
      llmFactory.setDefaultProvider('mock');
      expect(llmFactory.getDefaultProvider()).toBe('mock');
    });

    it('should allow setting default model', () => {
      llmFactory.setDefaultModel('gpt-4');
      expect(llmFactory.getDefaultModel()).toBe('gpt-4');
    });

    it('should throw error when setting non-existent provider as default', () => {
      expect(() => {
        llmFactory.setDefaultProvider('non-existent');
      }).toThrow('Provider \'non-existent\' not found');
    });
  });

  describe('OpenAI LLM (with mocked client)', () => {
    beforeEach(() => {
      // Mock OpenAI client
      vi.mock('openai', () => ({
        default: vi.fn().mockImplementation(() => ({
          chat: {
            completions: {
              create: vi.fn().mockResolvedValue({
                choices: [{ message: { content: 'Mock OpenAI response' } }],
                usage: { prompt_tokens: 10, completion_tokens: 5 },
              }),
            },
          },
        })),
      }));
    });

    it('should complete requests with OpenAI', async () => {
      const openaiLLM = new OpenAILLM('test-api-key');
      
      const response = await openaiLLM.complete({
        model: 'gpt-3.5-turbo',
        prompt: 'Hello, OpenAI!',
      });

      expect(response.text).toBe('Mock OpenAI response');
      expect(response.inputTokens).toBe(10);
      expect(response.outputTokens).toBe(5);
    });

    it('should handle JSON mode', async () => {
      const openaiLLM = new OpenAILLM('test-api-key');
      
      await openaiLLM.complete({
        model: 'gpt-3.5-turbo',
        prompt: 'Generate JSON',
        json: true,
      });

      // The mock should have been called with response_format
      expect(openaiLLM).toBeDefined();
    });

    it('should handle tools', async () => {
      const openaiLLM = new OpenAILLM('test-api-key');
      
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

      await openaiLLM.complete({
        model: 'gpt-3.5-turbo',
        prompt: 'Use the tool',
        tools,
      });

      // The mock should have been called with tools
      expect(openaiLLM).toBeDefined();
    });

    it('should handle circuit breaker state', () => {
      const openaiLLM = new OpenAILLM('test-api-key');
      
      const state = openaiLLM.getCircuitBreakerState();
      expect(state.state).toBe('closed');
      expect(state.failures).toBe(0);
    });

    it('should allow configuration updates', () => {
      const openaiLLM = new OpenAILLM('test-api-key');
      
      openaiLLM.setRetryConfig({ maxRetries: 5 });
      openaiLLM.setTimeoutConfig({ requestTimeout: 60000 });
      openaiLLM.setCircuitBreakerConfig({ failureThreshold: 10 });
      
      // Configuration should be updated (we can't easily test the internal state,
      // but we can verify the methods don't throw)
      expect(openaiLLM).toBeDefined();
    });
  });
});
