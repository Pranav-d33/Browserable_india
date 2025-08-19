// =============================================================================
// LLM Provider Types
// =============================================================================

export interface LLMProvider {
  name: string;
  complete(opts: {
    model: string;
    system?: string;
    prompt: string;
    temperature?: number;
    maxTokens?: number;
    json?: boolean;
    tools?: Array<{ name: string; description?: string; parameters?: unknown }>;
  }): Promise<{
    text: string;
    inputTokens: number;
    outputTokens: number;
  }>;
}

export interface LLMRequestOptions {
  model: string;
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  tools?: Array<{ name: string; description?: string; parameters?: unknown }>;
}

export interface LLMResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
  nextAttemptTime: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
}

export interface TimeoutConfig {
  requestTimeout: number;
  connectTimeout: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  halfOpenMaxAttempts: number;
}
