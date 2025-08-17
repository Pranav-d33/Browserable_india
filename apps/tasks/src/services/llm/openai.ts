import OpenAI from 'openai';
import { encoding_for_model } from 'tiktoken';
import { logger, recordLLMTokens, trackLLMCost } from '@bharat-agents/shared';
import { LLMProvider, LLMRequestOptions, LLMResponse, CircuitBreakerState, RetryConfig, TimeoutConfig, CircuitBreakerConfig } from './types';

// =============================================================================
// OpenAI LLM Implementation
// =============================================================================

export class OpenAILLM implements LLMProvider {
  name = 'openai';
  private client: OpenAI;
  private circuitBreaker: CircuitBreakerState;
  private retryConfig: RetryConfig;
  private timeoutConfig: TimeoutConfig;
  private circuitBreakerConfig: CircuitBreakerConfig;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      timeout: 30000, // 30 seconds default timeout
    });

    // Initialize circuit breaker
    this.circuitBreaker = {
      failures: 0,
      lastFailureTime: 0,
      state: 'closed',
      nextAttemptTime: 0,
    };

    // Default configurations
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 10000, // 10 seconds
      jitter: true,
    };

    this.timeoutConfig = {
      requestTimeout: 30000, // 30 seconds
      connectTimeout: 10000, // 10 seconds
    };

    this.circuitBreakerConfig = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      halfOpenMaxAttempts: 3,
    };
  }

  async complete(opts: LLMRequestOptions): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      // Check circuit breaker state
      if (!this.canAttemptRequest()) {
        throw new Error('Circuit breaker is open');
      }

      const response = await this.executeWithRetries(opts);
      
      // Record success
      this.recordSuccess();
      
      // Calculate and record metrics
      const cost = trackLLMCost({
        provider: 'openai' as const,
        model: opts.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      });

      const duration = Date.now() - startTime;
      logger.info({
        provider: this.name,
        model: opts.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        cost: cost.toFixed(6),
        duration,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
        json: opts.json,
        tools: opts.tools?.length || 0,
      }, 'OpenAI LLM request completed successfully');

      return response;

    } catch (error) {
      // Record failure
      this.recordFailure();
      
      const duration = Date.now() - startTime;
      logger.error({
        provider: this.name,
        model: opts.model,
        error: error instanceof Error ? error.message : String(error),
        duration,
        circuitBreakerState: this.circuitBreaker.state,
        failures: this.circuitBreaker.failures,
      }, 'OpenAI LLM request failed');

      throw error;
    }
  }

  private async executeWithRetries(opts: LLMRequestOptions): Promise<LLMResponse> {
    let lastError: Error;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await this.executeRequest(opts);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(lastError)) {
          throw lastError;
        }

        // If this is the last attempt, throw the error
        if (attempt === this.retryConfig.maxRetries) {
          throw lastError;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt);
        
        logger.warn({
          provider: this.name,
          model: opts.model,
          attempt: attempt + 1,
          maxRetries: this.retryConfig.maxRetries,
          delay,
          error: lastError.message,
        }, 'OpenAI LLM request failed, retrying');

        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  private async executeRequest(opts: LLMRequestOptions): Promise<LLMResponse> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    
    if (opts.system) {
      messages.push({ role: 'system', content: opts.system });
    }
    
    messages.push({ role: 'user', content: opts.prompt });

    const requestOptions: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
      model: opts.model,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens,
    };

    // Handle JSON mode
    if (opts.json) {
      requestOptions.response_format = { type: 'json_object' };
    }

    // Handle tools
    if (opts.tools && opts.tools.length > 0) {
      requestOptions.tools = opts.tools;
    }

    const completion = await this.client.chat.completions.create(requestOptions);

    const text = completion.choices[0]?.message?.content || '';
    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;

    // Record token usage metrics
    recordLLMTokens('openai', opts.model, 'input', inputTokens);
    recordLLMTokens('openai', opts.model, 'output', outputTokens);

    return {
      text,
      inputTokens,
      outputTokens,
    };
  }

  private countTokens(text: string): number {
    try {
      // Use tiktoken for accurate token counting
      const encoding = encoding_for_model('gpt-3.5-turbo');
      const tokens = encoding.encode(text);
      encoding.free();
      return tokens.length;
    } catch (error) {
      // Fallback to approximate counting
      logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Failed to count tokens with tiktoken, using approximation');
      return Math.ceil(text.length / 4);
    }
  }

  private canAttemptRequest(): boolean {
    const now = Date.now();

    switch (this.circuitBreaker.state) {
      case 'closed':
        return true;
      
      case 'open':
        if (now >= this.circuitBreaker.nextAttemptTime) {
          this.circuitBreaker.state = 'half-open';
          this.circuitBreaker.failures = 0;
          return true;
        }
        return false;
      
      case 'half-open':
        return this.circuitBreaker.failures < this.circuitBreakerConfig.halfOpenMaxAttempts;
      
      default:
        return true;
    }
  }

  private recordSuccess(): void {
    if (this.circuitBreaker.state === 'half-open') {
      // Success in half-open state, close the circuit breaker
      this.circuitBreaker.state = 'closed';
      this.circuitBreaker.failures = 0;
    }
  }

  private recordFailure(): void {
    const now = Date.now();
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = now;

    if (this.circuitBreaker.state === 'closed' && 
        this.circuitBreaker.failures >= this.circuitBreakerConfig.failureThreshold) {
      // Open the circuit breaker
      this.circuitBreaker.state = 'open';
      this.circuitBreaker.nextAttemptTime = now + this.circuitBreakerConfig.recoveryTimeout;
      
      logger.warn({
        provider: this.name,
        failures: this.circuitBreaker.failures,
        threshold: this.circuitBreakerConfig.failureThreshold,
        nextAttemptTime: new Date(this.circuitBreaker.nextAttemptTime).toISOString(),
      }, 'Circuit breaker opened');
    } else if (this.circuitBreaker.state === 'half-open') {
      // Failure in half-open state, open the circuit breaker again
      this.circuitBreaker.state = 'open';
      this.circuitBreaker.nextAttemptTime = now + this.circuitBreakerConfig.recoveryTimeout;
    }
  }

  private calculateDelay(attempt: number): number {
    const delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(2, attempt),
      this.retryConfig.maxDelay
    );

    if (this.retryConfig.jitter) {
      // Add jitter (±25% of the delay)
      const jitter = delay * 0.25 * (Math.random() - 0.5);
      return Math.max(0, delay + jitter);
    }

    return delay;
  }

  private isNonRetryableError(error: Error): boolean {
    const nonRetryableErrors = [
      'invalid_api_key',
      'invalid_request_error',
      'rate_limit_exceeded',
      'insufficient_quota',
      'billing_not_active',
    ];

    return nonRetryableErrors.some(errType => 
      error.message.toLowerCase().includes(errType)
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Configuration setters
  setRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  setTimeoutConfig(config: Partial<TimeoutConfig>): void {
    this.timeoutConfig = { ...this.timeoutConfig, ...config };
  }

  setCircuitBreakerConfig(config: Partial<CircuitBreakerConfig>): void {
    this.circuitBreakerConfig = { ...this.circuitBreakerConfig, ...config };
  }

  // Get circuit breaker state for monitoring
  getCircuitBreakerState(): CircuitBreakerState {
    return { ...this.circuitBreaker };
  }
}
