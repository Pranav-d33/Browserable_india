// =============================================================================
// Legacy LLM Service (Deprecated - Use new LLM factory instead)
// =============================================================================

import { logger } from '@bharat-agents/shared';
import { llmFactory } from './llm/index';

// Legacy interfaces for backward compatibility
export interface LLMProvider {
  name: string;
  generate(prompt: string, options?: LLMOptions): Promise<LLMResponse>;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  model?: string;
}

export interface LLMResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, unknown>;
}

// Legacy Mock LLM for backward compatibility
export class MockLLM implements LLMProvider {
  name = 'mock';

  async generate(prompt: string, options?: LLMOptions): Promise<LLMResponse> {
    logger.warn('Using deprecated MockLLM.generate() - use new LLM factory instead');
    
    const response = await llmFactory.complete({
      prompt,
      model: options?.model || 'mock-model',
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    });

    return {
      text: response.text,
      usage: {
        promptTokens: response.inputTokens,
        completionTokens: response.outputTokens,
        totalTokens: response.inputTokens + response.outputTokens,
      },
      metadata: {
        provider: this.name,
        model: options?.model || 'mock-model',
        timestamp: new Date().toISOString(),
      },
    };
  }
}

// Legacy LLM Service for backward compatibility
export class LLMService {
  private defaultProvider: string = 'mock';

  constructor() {
    logger.warn('Using deprecated LLMService - use new LLM factory instead');
  }

  registerProvider(provider: LLMProvider): void {
    logger.warn('registerProvider() is deprecated - providers are auto-registered in new factory');
  }

  setDefaultProvider(name: string): void {
    this.defaultProvider = name;
    llmFactory.setDefaultProvider(name);
  }

  async generate(
    prompt: string,
    options?: LLMOptions & { provider?: string }
  ): Promise<LLMResponse> {
    logger.warn('Using deprecated LLMService.generate() - use new LLM factory instead');
    
    const response = await llmFactory.complete({
      prompt,
      provider: options?.provider || this.defaultProvider,
      model: options?.model,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    });

    return {
      text: response.text,
      usage: {
        promptTokens: response.inputTokens,
        completionTokens: response.outputTokens,
        totalTokens: response.inputTokens + response.outputTokens,
      },
      metadata: {
        provider: options?.provider || this.defaultProvider,
        model: options?.model,
        timestamp: new Date().toISOString(),
      },
    };
  }

  getProvider(name: string): LLMProvider | undefined {
    const provider = llmFactory.getProvider(name);
    if (provider && name === 'mock') {
      return new MockLLM();
    }
    return undefined;
  }

  listProviders(): string[] {
    return llmFactory.listProviders();
  }
}

// Export singleton instance (legacy)
export const llmService = new LLMService();

// Export new factory for migration
export { llmFactory, getLLM } from './llm/index';
