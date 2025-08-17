# LLM Provider Adapters

This directory contains the LLM (Large Language Model) provider adapters for the tasks application. The implementation provides a unified interface for different LLM providers with robust error handling, retries, circuit breakers, and cost tracking.

## Features

- **Unified Interface**: Common interface for all LLM providers
- **Multiple Providers**: Support for OpenAI and Mock providers
- **Robust Error Handling**: Exponential backoff with jitter, timeouts, and circuit breakers
- **Token Counting**: Accurate token counting with tiktoken (OpenAI) and approximations
- **JSON Mode**: Support for structured JSON responses
- **Tools Support**: Function calling capabilities
- **Metrics & Cost Tracking**: Integration with Prometheus metrics and cost tracking
- **Health Checks**: Provider health monitoring
- **Configuration**: Environment-based provider selection

## Architecture

```
src/services/llm/
├── types.ts          # TypeScript interfaces and types
├── mock.ts           # Mock LLM provider for testing
├── openai.ts         # OpenAI provider implementation
├── index.ts          # Factory and main exports
├── test.ts           # Comprehensive test suite
├── llm.test.ts       # Simple test suite
├── example-usage.ts  # Usage examples
└── README.md         # This documentation
```

## Quick Start

### Basic Usage

```typescript
import { getLLM } from './src/services/llm';

const llm = getLLM();

// Simple completion
const response = await llm.complete({
  prompt: 'What is the capital of France?',
  model: 'gpt-3.5-turbo',
});

console.log(response.text);
console.log(
  `Tokens: ${response.inputTokens} input, ${response.outputTokens} output`
);
```

### JSON Mode

```typescript
const response = await llm.complete({
  prompt: 'Generate a JSON object with name and age',
  model: 'gpt-3.5-turbo',
  json: true,
});

const data = JSON.parse(response.text);
console.log(data.name, data.age);
```

### With System Prompt

```typescript
const response = await llm.complete({
  system: 'You are a helpful math tutor. Always show your work.',
  prompt: 'Solve: 2x + 5 = 13',
  model: 'gpt-3.5-turbo',
  temperature: 0.3,
});
```

### With Tools (Function Calling)

```typescript
const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'get_weather',
      description: 'Get the current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The city and state, e.g. San Francisco, CA',
          },
        },
        required: ['location'],
      },
    },
  },
];

const response = await llm.complete({
  prompt: "What's the weather like in New York?",
  model: 'gpt-3.5-turbo',
  tools,
});
```

## Configuration

### Environment Variables

```bash
# Required for OpenAI provider
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Set default provider and model
LLM_PROVIDER=openai  # or 'mock'
LLM_MODEL=gpt-4      # or any supported model
```

### Provider Selection

The factory automatically selects providers based on available environment variables:

1. **Mock Provider**: Always available for testing
2. **OpenAI Provider**: Available when `OPENAI_API_KEY` is set
3. **Default Provider**: Set via `LLM_PROVIDER` environment variable

### Runtime Configuration

```typescript
const llm = getLLM();

// Set default provider
llm.setDefaultProvider('openai');

// Set default model
llm.setDefaultModel('gpt-4');

// Get available providers
const providers = llm.listProviders();
console.log('Available:', providers); // ['mock', 'openai']
```

## Providers

### Mock Provider

The mock provider is designed for testing and development. It:

- Simulates realistic response times (100ms delay)
- Returns structured responses based on input
- Supports JSON mode with mock data
- Estimates token counts
- Always available (no API key required)

```typescript
const response = await llm.complete({
  prompt: 'Hello, world!',
  provider: 'mock',
  model: 'test-model',
});
```

### OpenAI Provider

The OpenAI provider provides full integration with OpenAI's API:

- **Token Counting**: Uses tiktoken for accurate token counting
- **Retry Logic**: Exponential backoff with jitter
- **Circuit Breaker**: Prevents cascading failures
- **Cost Tracking**: Automatic cost calculation and metrics
- **JSON Mode**: Native support for structured responses
- **Tools**: Full function calling support

#### Configuration

```typescript
import { OpenAILLM } from './src/services/llm';

const openaiLLM = new OpenAILLM('your-api-key');

// Configure retry behavior
openaiLLM.setRetryConfig({
  maxRetries: 5,
  baseDelay: 2000,
  maxDelay: 30000,
  jitter: true,
});

// Configure timeouts
openaiLLM.setTimeoutConfig({
  requestTimeout: 60000,
  connectTimeout: 15000,
});

// Configure circuit breaker
openaiLLM.setCircuitBreakerConfig({
  failureThreshold: 10,
  recoveryTimeout: 120000,
  halfOpenMaxAttempts: 5,
});
```

## Error Handling

The implementation includes comprehensive error handling:

### Retry Logic

- **Exponential Backoff**: Delays increase exponentially (1s, 2s, 4s, etc.)
- **Jitter**: Random variation to prevent thundering herd
- **Max Retries**: Configurable retry limit (default: 3)
- **Non-Retryable Errors**: Certain errors (invalid API key, rate limits) are not retried

### Circuit Breaker

- **Three States**: Closed (normal), Open (failing), Half-Open (testing)
- **Failure Threshold**: Number of failures before opening circuit
- **Recovery Timeout**: Time to wait before attempting recovery
- **Half-Open Testing**: Limited attempts to test if service is recovered

### Error Types

```typescript
try {
  const response = await llm.complete({
    prompt: 'Hello',
    provider: 'openai',
    model: 'gpt-3.5-turbo',
  });
} catch (error) {
  if (error.message.includes('Circuit breaker is open')) {
    // Service is temporarily unavailable
  } else if (error.message.includes('invalid_api_key')) {
    // Configuration error
  } else if (error.message.includes('rate_limit_exceeded')) {
    // Rate limit hit
  }
}
```

## Monitoring and Metrics

### Health Checks

```typescript
const health = await llm.healthCheck();
console.log(health);
// {
//   mock: { status: 'healthy' },
//   openai: { status: 'healthy' }
// }
```

### Provider Statistics

```typescript
const stats = llm.getProviderStats();
console.log(stats);
// {
//   openai: {
//     circuitBreaker: {
//       state: 'closed',
//       failures: 0,
//       lastFailureTime: 0
//     }
//   }
// }
```

### Metrics Integration

The implementation automatically records:

- **Token Usage**: Input and output tokens per provider/model
- **Cost Tracking**: USD costs based on token usage
- **Request Duration**: Response times
- **Error Rates**: Failure counts

Metrics are available via Prometheus endpoints and can be viewed in monitoring dashboards.

## Testing

### Running Tests

```bash
# Run all LLM tests
pnpm test src/services/llm/

# Run specific test file
pnpm test src/services/llm/llm.test.ts
```

### Test Coverage

The test suite covers:

- Provider interface compliance
- Mock provider functionality
- JSON mode handling
- Error scenarios
- Configuration options
- Health checks

### Example Usage

```bash
# Run the example
npx tsx src/services/llm/example-usage.ts
```

## Migration from Legacy Service

The new LLM factory is backward compatible with the legacy `LLMService`:

```typescript
// Old way (deprecated)
import { llmService } from './src/services/llm';
const response = await llmService.generate('Hello', { model: 'gpt-3.5-turbo' });

// New way (recommended)
import { getLLM } from './src/services/llm';
const llm = getLLM();
const response = await llm.complete({
  prompt: 'Hello',
  model: 'gpt-3.5-turbo',
});
```

The legacy service will show deprecation warnings but continue to work.

## Best Practices

1. **Always specify a model**: Use explicit model names for predictable behavior
2. **Handle errors gracefully**: Implement proper error handling for production use
3. **Monitor costs**: Use the built-in cost tracking to monitor usage
4. **Use appropriate timeouts**: Configure timeouts based on your use case
5. **Test with mock provider**: Use the mock provider for development and testing
6. **Health checks**: Implement health checks in your application startup

## Troubleshooting

### Common Issues

1. **"Provider not found"**: Check that the provider is properly configured
2. **"Circuit breaker is open"**: Service is temporarily unavailable, wait for recovery
3. **"Invalid API key"**: Verify your OpenAI API key is correct
4. **"Rate limit exceeded"**: Reduce request frequency or upgrade your plan

### Debug Mode

Enable debug logging to see detailed information:

```typescript
// Set log level to debug in your environment
LOG_LEVEL = debug;
```

This will show detailed information about requests, retries, and circuit breaker state changes.
