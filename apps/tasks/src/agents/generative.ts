import { z } from 'zod';
import { logger, trackLLMCost } from '@bharat-agents/shared';
import { BaseAgent, type RunArgs, type NodeResult } from './base.js';
import { getLLM } from '../services/llm/index.js';

// Schema for generative agent input
const GenerativeInputSchema = z.object({
  instructions: z.string(),
  format: z.enum(['text', 'json']).optional().default('text'),
  schema: z.string().optional(), // Zod schema definition as string
});

// Schema for generative agent output
export const GenerativeOutputSchema = z.object({
  text: z.string(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  cost: z.number(),
  format: z.enum(['text', 'json']),
  schema: z.string().optional(),
  success: z.boolean(),
  error: z.string().optional(),
});

export class GenerativeAgent extends BaseAgent {
  name = 'generative';

  async runNode(args: RunArgs): Promise<NodeResult> {
    const startTime = Date.now();
    const { runId, nodeId, input } = args;

    try {
      // Parse and validate input
      const parsedInput = JSON.parse(input);
      const validatedInput = GenerativeInputSchema.parse(parsedInput);

      logger.info(
        {
          runId,
          nodeId,
          format: validatedInput.format,
          hasSchema: !!validatedInput.schema,
        },
        'Starting generative LLM task'
      );

      // Record start action
      await this.recordAction(runId, nodeId, 'start', {
        format: validatedInput.format,
        hasSchema: !!validatedInput.schema,
        instructionsLength: validatedInput.instructions.length,
      });

      // Execute LLM generation
      const result = await this.generateContent(validatedInput, runId, nodeId);

      // Record completion
      await this.recordAction(
        runId,
        nodeId,
        'complete',
        { format: validatedInput.format, hasSchema: !!validatedInput.schema },
        {
          success: result.success,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          cost: result.cost,
        },
        'OK',
        Date.now() - startTime
      );

      return {
        output: JSON.stringify(result),
        meta: {
          format: validatedInput.format,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          cost: result.cost,
          duration: Date.now() - startTime,
          success: result.success,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      // Record error
      await this.recordAction(
        runId,
        nodeId,
        'error',
        { input },
        { error: error instanceof Error ? error.message : String(error) },
        'ERR',
        duration
      );

      logger.error(
        {
          runId,
          nodeId,
          error: error instanceof Error ? error.message : String(error),
          duration,
        },
        'Generative LLM task failed'
      );

      return {
        output: JSON.stringify({
          text: '',
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
          format: 'text',
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }),
        meta: {
          duration,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Generate content using LLM with format-specific handling
   */
  private async generateContent(
    input: z.infer<typeof GenerativeInputSchema>,
    runId: string,
    nodeId: string
  ): Promise<z.infer<typeof GenerativeOutputSchema>> {
    const llm = getLLM();
    const startTime = Date.now();

    try {
      if (input.format === 'json') {
        return await this.generateJSON(input, llm, runId, nodeId);
      } else {
        return await this.generateText(input, llm, runId, nodeId);
      }
    } catch (error) {
      logger.error(
        {
          runId,
          nodeId,
          format: input.format,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime,
        },
        'Content generation failed'
      );
      throw error;
    }
  }

  /**
   * Generate text content
   */
  private async generateText(
    input: z.infer<typeof GenerativeInputSchema>,
    llm: {
      name: string;
      getDefaultModel(): string;
      complete(args: {
        model: string;
        prompt: string;
        temperature: number;
        maxTokens: number;
      }): Promise<{ text: string; inputTokens: number; outputTokens: number }>;
    },
    runId: string,
    nodeId: string
  ): Promise<z.infer<typeof GenerativeOutputSchema>> {
    const startTime = Date.now();

    try {
      const response = await llm.complete({
        model: llm.getDefaultModel(),
        prompt: input.instructions,
        temperature: 0.7,
        maxTokens: 1000,
      });

      const duration = Date.now() - startTime;

      // Track cost
      const cost = trackLLMCost({
        provider: llm.name,
        model: llm.getDefaultModel(),
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      });

      // Record generation action
      await this.recordAction(
        runId,
        nodeId,
        'text_generated',
        {
          instructions: input.instructions,
          model: llm.getDefaultModel(),
        },
        {
          success: true,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          cost,
          duration,
        },
        'OK',
        duration
      );

      return {
        text: response.text,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        cost,
        format: 'text',
        success: true,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      await this.recordAction(
        runId,
        nodeId,
        'text_generation_failed',
        { instructions: input.instructions },
        { error: error instanceof Error ? error.message : String(error) },
        'ERR',
        duration
      );

      throw error;
    }
  }

  /**
   * Generate JSON content with robust schema validation and retry
   */
  private async generateJSON(
    input: z.infer<typeof GenerativeInputSchema>,
    llm: {
      name: string;
      getDefaultModel(): string;
      complete(args: {
        model: string;
        system?: string;
        prompt: string;
        temperature: number;
        maxTokens: number;
        json?: boolean;
      }): Promise<{
        text: string;
        inputTokens: number;
        outputTokens: number;
      }>;
    },
    runId: string,
    nodeId: string
  ): Promise<z.infer<typeof GenerativeOutputSchema>> {
    const startTime = Date.now();

    // Parse schema if provided
    let schema: z.ZodSchema<unknown> | undefined;
    if (input.schema) {
      try {
        // Evaluate the schema string to create a Zod schema
        // This is a simplified approach - in production, you might want more robust schema parsing
        schema = eval(`(${input.schema})`);
        if (!schema || typeof schema.parse !== 'function') {
          throw new Error('Invalid schema definition');
        }
      } catch (schemaError) {
        logger.error(
          {
            runId,
            nodeId,
            schema: input.schema,
            error:
              schemaError instanceof Error
                ? schemaError.message
                : String(schemaError),
          },
          'Failed to parse schema'
        );
        throw new Error(
          `Invalid schema definition: ${schemaError instanceof Error ? schemaError.message : String(schemaError)}`
        );
      }
    }

    // Try up to 2 times for JSON generation with schema validation
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await llm.complete({
          model: llm.getDefaultModel(),
          system: schema
            ? `You are a helpful assistant that responds with valid JSON only. 
               The response must conform to the following schema: ${input.schema}
               Always respond with a valid JSON object that matches the schema exactly.
               Do not include any explanatory text, markdown formatting, or code blocks.
               Respond with ONLY the JSON object.`
            : `You are a helpful assistant that responds with valid JSON only. 
               Always respond with a valid JSON object.
               Do not include any explanatory text, markdown formatting, or code blocks.
               Respond with ONLY the JSON object.`,
          prompt: input.instructions,
          temperature: 0.1, // Low temperature for deterministic JSON output
          maxTokens: 1000,
          json: true, // Enable JSON mode if supported
        });

        // Parse the response as JSON
        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(response.text);
        } catch {
          // Try to extract JSON from the response if it's wrapped in markdown or other text
          const jsonMatch = response.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedJson = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No valid JSON found in LLM response');
          }
        }

        // Validate against schema if provided
        if (schema) {
          try {
            parsedJson = schema.parse(parsedJson);
          } catch (validationError) {
            if (attempt === 1) {
              // On first attempt, try to fix the schema and retry
              logger.warn(
                {
                  runId,
                  nodeId,
                  attempt,
                  error:
                    validationError instanceof Error
                      ? validationError.message
                      : String(validationError),
                  response: response.text,
                },
                'Schema validation failed, attempting retry with schema fix'
              );

              // Try again with a more explicit schema fix prompt
              const fixPrompt = `${input.instructions}

Previous response failed schema validation: ${validationError instanceof Error ? validationError.message : String(validationError)}

Please provide a response that strictly conforms to this schema: ${input.schema}

The response must be valid JSON that matches the schema exactly.`;

              const fixResponse = await llm.complete({
                model: llm.getDefaultModel(),
                system: `You are a helpful assistant that responds with valid JSON only. 
                         The response must conform to the following schema: ${input.schema}
                         Always respond with a valid JSON object that matches the schema exactly.
                         Do not include any explanatory text, markdown formatting, or code blocks.
                         Respond with ONLY the JSON object.`,
                prompt: fixPrompt,
                temperature: 0.1,
                maxTokens: 1000,
                json: true,
              });

              try {
                const fixedJson = JSON.parse(fixResponse.text);
                parsedJson = schema.parse(fixedJson);

                // Use the fixed response
                response.text = fixResponse.text;
                response.inputTokens += fixResponse.inputTokens;
                response.outputTokens += fixResponse.outputTokens;
              } catch (fixError) {
                throw new Error(
                  `Schema validation failed after retry: ${fixError instanceof Error ? fixError.message : String(fixError)}`
                );
              }
            } else {
              throw validationError;
            }
          }
        }

        const duration = Date.now() - startTime;

        // Track cost
        const cost = trackLLMCost({
          provider: llm.name,
          model: llm.getDefaultModel(),
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
        });

        // Record successful generation
        await this.recordAction(
          runId,
          nodeId,
          'json_generated',
          {
            instructions: input.instructions,
            schema: input.schema,
            model: llm.getDefaultModel(),
            attempt,
          },
          {
            success: true,
            inputTokens: response.inputTokens,
            outputTokens: response.outputTokens,
            cost,
            duration,
            parsedJson,
          },
          'OK',
          duration
        );

        return {
          text: response.text,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          cost,
          format: 'json',
          schema: input.schema,
          success: true,
        };
      } catch (_e) {
        lastError = _e instanceof Error ? _e : new Error(String(_e));

        logger.warn(
          {
            runId,
            nodeId,
            attempt,
            error: lastError.message,
            schema: input.schema,
          },
          `JSON generation attempt ${attempt} failed`
        );

        if (attempt === 1) {
          // Continue to retry
          continue;
        } else {
          // Final attempt failed
          const duration = Date.now() - startTime;

          await this.recordAction(
            runId,
            nodeId,
            'json_generation_failed',
            {
              instructions: input.instructions,
              schema: input.schema,
              attempts: 2,
            },
            { error: lastError.message },
            'ERR',
            duration
          );

          throw lastError;
        }
      }
    }

    // This should never be reached, but TypeScript requires it
    throw lastError || new Error('JSON generation failed after all attempts');
  }
}
