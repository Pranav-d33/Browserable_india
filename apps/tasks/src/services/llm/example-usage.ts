import { getLLM } from './index';

// =============================================================================
// Example Usage of LLM Provider Adapters
// =============================================================================

async function exampleUsage(): Promise<void> {
  console.log('=== LLM Provider Adapters Example ===\n');

  // Get the LLM factory instance
  const llm = getLLM();

  // List available providers
  console.log('Available providers:', llm.listProviders());
  console.log('Default provider:', llm.getDefaultProvider());
  console.log('Default model:', llm.getDefaultModel());
  console.log('');

  // Example 1: Basic completion with default provider
  console.log('1. Basic completion:');
  try {
    const response1 = await llm.complete({
      prompt: 'What is the capital of France?',
      model: 'test-model',
    });
    console.log('Response:', response1.text);
    console.log('Input tokens:', response1.inputTokens);
    console.log('Output tokens:', response1.outputTokens);
    console.log('');
  } catch (error) {
    console.error('Error:', error);
  }

  // Example 2: JSON mode
  console.log('2. JSON mode:');
  try {
    const response2 = await llm.complete({
      prompt: 'Generate a JSON object with name and age',
      model: 'test-model',
      json: true,
    });
    console.log('JSON Response:', JSON.parse(response2.text));
    console.log('');
  } catch (error) {
    console.error('Error:', error);
  }

  // Example 3: With system prompt
  console.log('3. With system prompt:');
  try {
    const response3 = await llm.complete({
      system: 'You are a helpful math tutor. Always show your work.',
      prompt: 'Solve: 2x + 5 = 13',
      model: 'test-model',
      temperature: 0.3,
    });
    console.log('Response:', response3.text);
    console.log('');
  } catch (error) {
    console.error('Error:', error);
  }

  // Example 4: With tools
  console.log('4. With tools:');
  try {
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

    const response4 = await llm.complete({
      prompt: "What's the weather like in New York?",
      model: 'test-model',
      tools,
    });
    console.log('Response:', response4.text);
    console.log('');
  } catch (error) {
    console.error('Error:', error);
  }

  // Example 5: Health check
  console.log('5. Health check:');
  try {
    const health = await llm.healthCheck();
    console.log('Health status:', health);
    console.log('');
  } catch (error) {
    console.error('Error:', error);
  }

  // Example 6: Provider statistics
  console.log('6. Provider statistics:');
  try {
    const stats = llm.getProviderStats();
    console.log('Provider stats:', stats);
    console.log('');
  } catch (error) {
    console.error('Error:', error);
  }

  // Example 7: Using specific provider
  console.log('7. Using specific provider:');
  try {
    const response7 = await llm.complete({
      prompt: 'Hello from specific provider',
      provider: 'mock',
      model: 'test-model',
    });
    console.log('Response:', response7.text);
    console.log('');
  } catch (error) {
    console.error('Error:', error);
  }

  // Example 8: Error handling
  console.log('8. Error handling:');
  try {
    await llm.complete({
      prompt: '', // Empty prompt should throw error
      model: 'test-model',
    });
  } catch (error) {
    console.log(
      'Expected error caught:',
      error instanceof Error ? error.message : error
    );
    console.log('');
  }

  console.log('=== Example completed ===');
}

// Example with OpenAI provider (if available)
async function openaiExample(): Promise<void> {
  console.log('=== OpenAI Provider Example ===\n');

  const llm = getLLM();

  // Check if OpenAI provider is available
  if (llm.listProviders().includes('openai')) {
    console.log('OpenAI provider is available');

    try {
      const response = await llm.complete({
        prompt: 'Explain quantum computing in simple terms',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 150,
      });

      console.log('OpenAI Response:', response.text);
      console.log('Input tokens:', response.inputTokens);
      console.log('Output tokens:', response.outputTokens);
    } catch (error) {
      console.error('OpenAI error:', error);
    }
  } else {
    console.log('OpenAI provider not available (no API key)');
  }
}

// Run examples
if (import.meta.url === `file://${process.argv[1]}`) {
  exampleUsage()
    .then(() => openaiExample())
    .catch(console.error);
}

export { exampleUsage, openaiExample };
