import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { logger } from '@bharat-agents/shared';
import { LLMProvider, LLMRequestOptions, LLMResponse } from './types';

export class GeminiLLM implements LLMProvider {
  public readonly name = 'gemini';
  private genAI: GoogleGenerativeAI;
  private models: Map<string, GenerativeModel> = new Map();

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    logger.info('Gemini LLM provider initialized');
  }

  private getModel(modelName: string): GenerativeModel {
    if (!this.models.has(modelName)) {
      // Map common model names to Gemini models
      const geminiModel = this.mapModelName(modelName);
      this.models.set(
        modelName,
        this.genAI.getGenerativeModel({ model: geminiModel })
      );
    }
    return this.models.get(modelName)!;
  }

  private mapModelName(modelName: string): string {
    // Map common model names to Gemini models
    const modelMap: Record<string, string> = {
      'gemini-pro': 'gemini-pro',
      'gemini-1.5-pro': 'gemini-1.5-pro',
      'gemini-1.5-flash': 'gemini-1.5-flash',
      'gpt-3.5-turbo': 'gemini-pro', // Fallback for OpenAI model names
      'gpt-4': 'gemini-1.5-pro', // Fallback for OpenAI model names
    };

    return modelMap[modelName] || 'gemini-pro';
  }

  async complete(options: LLMRequestOptions): Promise<LLMResponse> {
    const {
      model = 'gemini-pro',
      prompt,
      system,
      temperature = 0.7,
      maxTokens,
      json = false,
      tools,
    } = options;

    try {
      const geminiModel = this.getModel(model);

      // Prepare content parts
      const contentParts: Array<{ text: string }> = [];

      // Add system message if provided
      if (system) {
        contentParts.push({ text: `System: ${system}\n\nUser: ${prompt}` });
      } else {
        contentParts.push({ text: prompt });
      }

      // Prepare generation config
      const generationConfig: {
        temperature: number;
        maxOutputTokens?: number;
        responseMimeType?: string;
      } = {
        temperature: Math.min(Math.max(temperature, 0), 1), // Ensure temperature is between 0 and 1
      };

      if (maxTokens) {
        generationConfig.maxOutputTokens = maxTokens;
      }

      // Handle JSON mode
      if (json) {
        generationConfig.responseMimeType = 'application/json';
      }

      // Handle tools if provided
      if (tools && tools.length > 0) {
        // Convert OpenAI tools format to Gemini format
        const geminiTools = tools.map(tool => ({
          functionDeclarations: [
            {
              name: tool.function.name,
              description: tool.function.description,
              parameters: tool.function.parameters,
            },
          ],
        }));

        const result = await geminiModel.generateContent({
          contents: contentParts,
          generationConfig,
          tools: geminiTools,
        });

        const response = result.response;

        // Handle tool calls if present
        if (response.candidates?.[0]?.content?.parts?.[0]?.functionCall) {
          const functionCall =
            response.candidates[0].content.parts[0].functionCall;
          return {
            content: '',
            toolCalls: [
              {
                id: `call_${Date.now()}`,
                type: 'function',
                function: {
                  name: functionCall.name,
                  arguments: JSON.stringify(functionCall.args),
                },
              },
            ],
          };
        }

        return {
          content: response.text(),
        };
      }

      // Standard text generation
      const result = await geminiModel.generateContent({
        contents: contentParts,
        generationConfig,
      });

      const response = result.response;

      logger.debug(
        {
          model,
          promptLength: prompt.length,
          responseLength: response.text().length,
          temperature,
          maxTokens,
          json,
        },
        'Gemini API request completed'
      );

      return {
        content: response.text(),
      };
    } catch (error) {
      logger.error(
        {
          model,
          error: error instanceof Error ? error.message : String(error),
          promptLength: prompt.length,
        },
        'Gemini API request failed'
      );

      throw new Error(
        `Gemini API error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Health check for Gemini
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    error?: string;
  }> {
    try {
      await this.complete({
        model: 'gemini-pro',
        prompt: 'Hello',
        maxTokens: 10,
      });
      return { status: 'healthy' };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
