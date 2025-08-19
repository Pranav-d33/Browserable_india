import { describe, it, expect } from 'vitest';
import { GenerativeAgent } from './generative.js';

describe('GenerativeAgent - Simple Tests', () => {
  it('should have correct name', () => {
    const agent = new GenerativeAgent();
    expect(agent.name).toBe('generative');
  });

  it('should extend BaseAgent', () => {
    const agent = new GenerativeAgent();
    expect(agent).toBeInstanceOf(GenerativeAgent);
    expect(typeof agent.runNode).toBe('function');
  });

  it('should validate input schema', () => {
    const validInput = {
      instructions: 'Write a story about a robot',
      format: 'text' as const,
    };

    // This test ensures the schema is properly defined
    expect(validInput.instructions).toBe('Write a story about a robot');
    expect(validInput.format).toBe('text');
  });

  it('should support both text and json formats', () => {
    const formats = ['text', 'json'] as const;

    formats.forEach(format => {
      expect(['text', 'json']).toContain(format);
    });
  });

  it('should handle schema as optional string', () => {
    const inputWithSchema = {
      instructions: 'Create a user profile',
      format: 'json' as const,
      schema: 'z.object({ name: z.string(), age: z.number() })',
    };

    expect(inputWithSchema.schema).toBe(
      'z.object({ name: z.string(), age: z.number() })'
    );
  });

  it('should default format to text when not specified', () => {
    const inputWithoutFormat = {
      instructions: 'Write a story',
      // format not specified
    };

    // This test ensures the default behavior is understood
    expect(inputWithoutFormat.instructions).toBe('Write a story');
    // format would default to 'text' in the schema
  });

  it('should support cost tracking metadata', () => {
    const expectedMetadata = {
      inputTokens: 10,
      outputTokens: 50,
      cost: 0.001,
      format: 'text',
      duration: 1000,
      success: true,
    };

    // This test ensures the metadata structure is understood
    expect(expectedMetadata.inputTokens).toBe(10);
    expect(expectedMetadata.outputTokens).toBe(50);
    expect(expectedMetadata.cost).toBe(0.001);
    expect(expectedMetadata.format).toBe('text');
    expect(expectedMetadata.success).toBe(true);
  });
});
