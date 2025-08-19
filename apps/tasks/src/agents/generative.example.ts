import { GenerativeAgent } from './generative.js';

/**
 * Example usage of the generative agent
 */
async function exampleUsage(): Promise<void> {
  console.log('=== Generative Agent Examples ===\n');

  const agent = new GenerativeAgent();

  // Example 1: Basic text generation
  console.log('1. Basic text generation...');
  const textResult = await agent.runNode({
    runId: 'run-123',
    nodeId: 'node-456',
    input: JSON.stringify({
      instructions: 'Write a short story about a robot learning to paint',
      format: 'text',
    }),
  });

  console.log('✓ Text generation completed');
  console.log(`  Output: ${textResult.output.substring(0, 100)}...`);
  console.log(`  Success: ${textResult.meta?.success}`);
  console.log(`  Input tokens: ${textResult.meta?.inputTokens}`);
  console.log(`  Output tokens: ${textResult.meta?.outputTokens}`);
  console.log(`  Cost: $${textResult.meta?.cost}`);
  console.log(`  Duration: ${textResult.meta?.duration}ms`);
  console.log();

  // Example 2: JSON generation without schema
  console.log('2. JSON generation without schema...');
  const jsonResult = await agent.runNode({
    runId: 'run-123',
    nodeId: 'node-789',
    input: JSON.stringify({
      instructions: 'Create a user profile with name, email, and preferences',
      format: 'json',
    }),
  });

  console.log('✓ JSON generation completed');
  console.log(`  Output: ${jsonResult.output.substring(0, 100)}...`);
  console.log(`  Success: ${jsonResult.meta?.success}`);
  console.log(`  Format: ${jsonResult.meta?.format}`);
  console.log();

  // Example 3: JSON generation with schema validation
  console.log('3. JSON generation with schema validation...');
  const schemaResult = await agent.runNode({
    runId: 'run-123',
    nodeId: 'node-101',
    input: JSON.stringify({
      instructions: 'Create a product listing',
      format: 'json',
      schema:
        'z.object({ name: z.string(), price: z.number(), category: z.string(), inStock: z.boolean() })',
    }),
  });

  console.log('✓ Schema-validated JSON generation completed');
  console.log(`  Output: ${schemaResult.output.substring(0, 100)}...`);
  console.log(`  Success: ${schemaResult.meta?.success}`);
  console.log(`  Schema: ${schemaResult.meta?.schema ? 'Applied' : 'None'}`);
  console.log();

  // Example 4: Complex schema with nested objects
  console.log('4. Complex schema with nested objects...');
  const complexSchemaResult = await agent.runNode({
    runId: 'run-123',
    nodeId: 'node-202',
    input: JSON.stringify({
      instructions:
        'Create a detailed user profile with address and preferences',
      format: 'json',
      schema: `z.object({
        name: z.string(),
        email: z.string().email(),
        age: z.number().min(0),
        address: z.object({
          street: z.string(),
          city: z.string(),
          country: z.string(),
          zipCode: z.string()
        }),
        preferences: z.object({
          theme: z.enum(['light', 'dark']),
          notifications: z.boolean(),
          language: z.string()
        })
      })`,
    }),
  });

  console.log('✓ Complex schema JSON generation completed');
  console.log(`  Output: ${complexSchemaResult.output.substring(0, 150)}...`);
  console.log(`  Success: ${complexSchemaResult.meta?.success}`);
  console.log();

  // Example 5: Default format (text)
  console.log('5. Default format (text)...');
  const defaultResult = await agent.runNode({
    runId: 'run-123',
    nodeId: 'node-303',
    input: JSON.stringify({
      instructions: 'Explain quantum computing in simple terms',
      // format not specified, defaults to 'text'
    }),
  });

  console.log('✓ Default format generation completed');
  console.log(`  Output: ${defaultResult.output.substring(0, 100)}...`);
  console.log(`  Format: ${defaultResult.meta?.format}`);
  console.log(`  Success: ${defaultResult.meta?.success}`);
  console.log();

  console.log('=== Examples completed ===');
}

/**
 * Example of cost tracking and metadata persistence
 */
function costTrackingExample(): void {
  console.log('=== Cost Tracking Example ===\n');

  console.log(
    'The generative agent automatically tracks costs and persists metadata:'
  );
  console.log('• Input/output token counts');
  console.log('• Cost calculation using trackLLMCost');
  console.log('• Metadata stored in Run for analysis');
  console.log('• Audit logs for all generation attempts');
  console.log();

  console.log('Example metadata structure:');
  console.log('{');
  console.log('  format: "json",');
  console.log('  inputTokens: 25,');
  console.log('  outputTokens: 150,');
  console.log('  cost: 0.0025,');
  console.log('  duration: 2500,');
  console.log('  success: true');
  console.log('}');
  console.log();

  console.log('=== Cost Tracking Example completed ===');
}

/**
 * Example of schema validation and retry logic
 */
function schemaValidationExample(): void {
  console.log('=== Schema Validation Example ===\n');

  console.log('JSON generation with schema validation includes:');
  console.log('• Automatic schema parsing from string');
  console.log('• Two-attempt retry with schema fix prompts');
  console.log('• Robust error handling for invalid schemas');
  console.log('• JSON extraction from markdown-wrapped responses');
  console.log();

  console.log('Example schema validation flow:');
  console.log('1. Parse schema string to Zod schema');
  console.log('2. Generate JSON with LLM');
  console.log('3. Validate against schema');
  console.log('4. If validation fails, retry with fix prompt');
  console.log('5. Track all attempts in audit logs');
  console.log();

  console.log('=== Schema Validation Example completed ===');
}

/**
 * Example of different use cases
 */
function useCaseExamples(): Promise<void> | void {
  console.log('=== Use Case Examples ===\n');

  console.log('Common use cases for the generative agent:');
  console.log();

  console.log('📝 Content Generation:');
  console.log('• Blog posts and articles');
  console.log('• Marketing copy and descriptions');
  console.log('• Creative writing and stories');
  console.log('• Technical documentation');
  console.log();

  console.log('🔧 Data Generation:');
  console.log('• Test data for applications');
  console.log('• Mock API responses');
  console.log('• Sample user profiles');
  console.log('• Product catalogs');
  console.log();

  console.log('📊 Structured Output:');
  console.log('• JSON configurations');
  console.log('• Database schemas');
  console.log('• API specifications');
  console.log('• Configuration files');
  console.log();

  console.log('🎯 Schema-Validated Data:');
  console.log('• User registration forms');
  console.log('• Product listings');
  console.log('• Survey responses');
  console.log('• Configuration objects');
  console.log();

  console.log('=== Use Case Examples completed ===');
}

/**
 * Example of error handling scenarios
 */
function errorHandlingExample(): void {
  console.log('=== Error Handling Examples ===\n');

  console.log('The generative agent handles various error scenarios:');
  console.log();

  console.log('❌ Schema Errors:');
  console.log('• Invalid schema syntax');
  console.log('• Schema parsing failures');
  console.log('• Validation errors after retries');
  console.log();

  console.log('❌ LLM Errors:');
  console.log('• Service unavailability');
  console.log('• Rate limiting');
  console.log('• Network timeouts');
  console.log();

  console.log('❌ JSON Errors:');
  console.log('• Invalid JSON responses');
  console.log('• Malformed JSON structure');
  console.log('• Missing required fields');
  console.log();

  console.log('✅ Error Recovery:');
  console.log('• Automatic retries for JSON generation');
  console.log('• Schema fix prompts on validation failures');
  console.log('• Graceful degradation with error reporting');
  console.log('• Comprehensive audit logging');
  console.log();

  console.log('=== Error Handling Examples completed ===');
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  exampleUsage()
    .then(() => costTrackingExample())
    .then(() => schemaValidationExample())
    .then(() => useCaseExamples())
    .then(() => errorHandlingExample())
    .catch(console.error);
}
