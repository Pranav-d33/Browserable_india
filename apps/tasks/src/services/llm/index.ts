import { logger } from '@bharat-agents/shared';
import { LLMProvider, LLMRequestOptions, LLMResponse } from './types';
import { MockLLM } from './mock';
import { OpenAILLM } from './openai';
import { GeminiLLM } from './gemini';

// =============================================================================
// LLM Provider Factory
// =============================================================================

class LLMFactory {
  private providers: Map<string, LLMProvider> = new Map();
  private defaultProvider: string = 'mock';
  private defaultModel: string = 'gpt-3.5-turbo';

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Always register mock provider for testing
    this.registerProvider(new MockLLM());

    // Register Gemini provider if API key is available
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey) {
      this.registerProvider(new GeminiLLM(geminiApiKey));
      // Set Gemini as default if no other provider is specified
      if (!process.env.LLM_PROVIDER) {
        this.defaultProvider = 'gemini';
        this.defaultModel = 'gemini-pro';
      }
    } else {
      logger.warn('GEMINI_API_KEY not found, Gemini provider not available');
    }

    // Register OpenAI provider if API key is available
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (openaiApiKey) {
      this.registerProvider(new OpenAILLM(openaiApiKey));
    } else {
      logger.warn('OPENAI_API_KEY not found, OpenAI provider not available');
    }

    // Set default provider based on environment
    const envProvider = process.env.LLM_PROVIDER?.toLowerCase();
    const envModel = process.env.LLM_MODEL;

    if (envProvider && this.providers.has(envProvider)) {
      this.defaultProvider = envProvider;
      logger.info({ provider: envProvider }, 'Set default LLM provider from environment');
    }

    if (envModel) {
      this.defaultModel = envModel;
      logger.info({ model: envModel }, 'Set default LLM model from environment');
    }

    logger.info({
      availableProviders: Array.from(this.providers.keys()),
      defaultProvider: this.defaultProvider,
      defaultModel: this.defaultModel,
    }, 'LLM factory initialized');
  }

  registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
    logger.info({ provider: provider.name }, 'Registered LLM provider');
  }

  setDefaultProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider '${name}' not found. Available providers: ${Array.from(this.providers.keys()).join(', ')}`);
    }
    this.defaultProvider = name;
    logger.info({ provider: name }, 'Set default LLM provider');
  }

  setDefaultModel(model: string): void {
    this.defaultModel = model;
    logger.info({ model }, 'Set default LLM model');
  }

  async complete(
    opts: Partial<LLMRequestOptions> & { provider?: string; model?: string }
  ): Promise<LLMResponse> {
    const providerName = opts.provider || this.defaultProvider;
    const model = opts.model || this.defaultModel;
    
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider '${providerName}' not found. Available providers: ${Array.from(this.providers.keys()).join(', ')}`);
    }

    const requestOptions: LLMRequestOptions = {
      model,
      prompt: opts.prompt || '',
      system: opts.system,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
      json: opts.json,
      tools: opts.tools,
    };

    // Validate required fields
    if (!requestOptions.prompt) {
      throw new Error('Prompt is required');
    }

    logger.debug({
      provider: providerName,
      model,
      promptLength: requestOptions.prompt.length,
      systemLength: requestOptions.system?.length || 0,
      temperature: requestOptions.temperature,
      maxTokens: requestOptions.maxTokens,
      json: requestOptions.json,
      tools: requestOptions.tools?.length || 0,
    }, 'Executing LLM request');

    return provider.complete(requestOptions);
  }

  getProvider(name: string): LLMProvider | undefined {
    return this.providers.get(name);
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  getDefaultProvider(): string {
    return this.defaultProvider;
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  // Health check for all providers
  async healthCheck(): Promise<Record<string, { status: 'healthy' | 'unhealthy'; error?: string }>> {
    const results: Record<string, { status: 'healthy' | 'unhealthy'; error?: string }> = {};

    for (const [name, provider] of this.providers) {
      try {
        // Simple health check with a minimal request
        await provider.complete({
          model: 'test',
          prompt: 'Hello',
          maxTokens: 10,
        });
        results[name] = { status: 'healthy' };
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    return results;
  }

  // Get provider statistics (useful for monitoring)
  getProviderStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [name, provider] of this.providers) {
      if (name === 'openai' && provider instanceof OpenAILLM) {
        stats[name] = {
          circuitBreaker: provider.getCircuitBreakerState(),
        };
      }
    }

    return stats;
  }
}

// Export singleton instance
export const llmFactory = new LLMFactory();

// Export convenience function
export const getLLM = () => llmFactory;

// Export types for external use
export type { LLMProvider, LLMRequestOptions, LLMResponse } from './types';
export { MockLLM } from './mock';
export { OpenAILLM } from './openai';
