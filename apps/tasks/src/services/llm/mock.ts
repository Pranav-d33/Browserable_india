import { logger } from '@bharat-agents/shared';
import { LLMProvider, LLMRequestOptions, LLMResponse } from './types';

// =============================================================================
// Mock LLM Implementation (Phase 0)
// =============================================================================

export class MockLLM implements LLMProvider {
  name = 'mock';

  async complete(opts: LLMRequestOptions): Promise<LLMResponse> {
    logger.info({
      provider: this.name,
      model: opts.model,
      promptLength: opts.prompt.length,
      systemLength: opts.system?.length || 0,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
      json: opts.json,
      tools: opts.tools?.length || 0,
    }, 'Mock LLM complete called');

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Generate mock response based on options
    let response: string;
    
    if (opts.json) {
      response = JSON.stringify({
        message: `Mock JSON response to: "${opts.prompt.substring(0, 50)}${opts.prompt.length > 50 ? '...' : ''}"`,
        timestamp: new Date().toISOString(),
        model: opts.model,
        temperature: opts.temperature || 0.7,
      });
    } else {
      response = `Mock response to: "${opts.prompt.substring(0, 50)}${opts.prompt.length > 50 ? '...' : ''}"`;
      
      if (opts.system) {
        response += `\n\nSystem context: ${opts.system.substring(0, 100)}${opts.system.length > 100 ? '...' : ''}`;
      }
    }

    // Calculate approximate token counts
    const inputTokens = this.estimateTokens(opts.prompt) + (opts.system ? this.estimateTokens(opts.system) : 0);
    const outputTokens = this.estimateTokens(response);

    return {
      text: response,
      inputTokens,
      outputTokens,
    };
  }

  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }
}
