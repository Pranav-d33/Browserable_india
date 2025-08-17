import { describe, it, expect, beforeEach } from 'vitest';
import {
  getModelPricing,
  calculateInputCost,
  calculateOutputCost,
  calculateTotalCost,
  trackLLMCost,
  getAvailableModels,
  getSupportedProviders,
  isModelSupported,
  getCheapestModel,
  formatCost,
  estimateTextCost,
  type LLMProvider,
} from '../src/costs';

// Mock the metrics module
vi.mock('../src/metrics', () => ({
  recordLLMCost: vi.fn(),
}));

describe('Costs Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Model Pricing', () => {
    it('should get pricing for valid models', () => {
      const gpt4Pricing = getModelPricing('openai', 'gpt-4');
      expect(gpt4Pricing).toEqual({ input: 0.03, output: 0.06 });

      const claudePricing = getModelPricing('anthropic', 'claude-3-sonnet');
      expect(claudePricing).toEqual({ input: 0.003, output: 0.015 });
    });

    it('should return null for invalid models', () => {
      expect(getModelPricing('openai', 'invalid-model')).toBeNull();
      expect(getModelPricing('invalid-provider', 'gpt-4')).toBeNull();
    });
  });

  describe('Cost Calculations', () => {
    it('should calculate input costs correctly', () => {
      const cost = calculateInputCost('openai', 'gpt-4', 1000);
      expect(cost).toBe(0.03); // 1000 tokens * $0.03 per 1K tokens
    });

    it('should calculate output costs correctly', () => {
      const cost = calculateOutputCost('openai', 'gpt-4', 500);
      expect(cost).toBe(0.03); // 500 tokens * $0.06 per 1K tokens
    });

    it('should calculate total costs correctly', () => {
      const cost = calculateTotalCost('openai', 'gpt-4', 1000, 500);
      expect(cost).toBe(0.06); // input: 0.03 + output: 0.03
    });

    it('should return 0 for unsupported models', () => {
      const cost = calculateTotalCost('openai', 'invalid-model', 1000, 500);
      expect(cost).toBe(0);
    });
  });

  describe('Cost Tracking', () => {
    it('should track LLM costs and call metrics', async () => {
      const { recordLLMCost } = await import('../src/metrics');

      const cost = trackLLMCost({
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 1000,
        outputTokens: 500,
      });

      expect(cost).toBe(0.06);
      expect(recordLLMCost).toHaveBeenCalledWith('openai', 'gpt-4', 0.06);
    });
  });

  describe('Provider and Model Management', () => {
    it('should get available models for providers', () => {
      const openaiModels = getAvailableModels('openai');
      expect(openaiModels).toContain('gpt-4');
      expect(openaiModels).toContain('gpt-3.5-turbo');

      const anthropicModels = getAvailableModels('anthropic');
      expect(anthropicModels).toContain('claude-3-sonnet');
    });

    it('should get supported providers', () => {
      const providers = getSupportedProviders();
      expect(providers).toContain('openai');
      expect(providers).toContain('anthropic');
      expect(providers).toContain('groq');
    });

    it('should check if models are supported', () => {
      expect(isModelSupported('openai', 'gpt-4')).toBe(true);
      expect(isModelSupported('openai', 'invalid-model')).toBe(false);
      expect(isModelSupported('invalid-provider', 'gpt-4')).toBe(false);
    });

    it('should get cheapest model for provider', () => {
      const cheapest = getCheapestModel('openai');
      expect(cheapest).toBeDefined();
      expect(cheapest?.model).toBeDefined();
      expect(cheapest?.pricing).toBeDefined();

      // gpt-4o-mini should be the cheapest for OpenAI
      expect(cheapest?.model).toBe('gpt-4o-mini');
    });
  });

  describe('Cost Formatting', () => {
    it('should format costs as USD', () => {
      expect(formatCost(0.123456)).toBe('$0.123456');
      expect(formatCost(1.5)).toBe('$1.500000');
      expect(formatCost(0)).toBe('$0.000000');
    });
  });

  describe('Text Cost Estimation', () => {
    it('should estimate costs for text', () => {
      const inputText = 'Hello world! This is a test message.';
      const outputText = 'This is a response.';

      const cost = estimateTextCost('openai', 'gpt-4', inputText, outputText);
      expect(cost).toBeGreaterThan(0);
    });

    it('should estimate costs for input only', () => {
      const inputText = 'Hello world! This is a test message.';

      const cost = estimateTextCost('openai', 'gpt-4', inputText);
      expect(cost).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero tokens', () => {
      const cost = calculateTotalCost('openai', 'gpt-4', 0, 0);
      expect(cost).toBe(0);
    });

    it('should handle large token counts', () => {
      const cost = calculateTotalCost('openai', 'gpt-4', 1000000, 500000);
      expect(cost).toBe(60); // 1000 * 0.03 + 500 * 0.06
    });
  });
});
