import { z } from 'zod';
import { logger } from '@bharat-agents/shared';
import { getLLM } from '../services/llm/index.js';
import { record } from '../services/audit.js';

export interface RunArgs {
  runId: string;
  nodeId: string;
  input: string;
  meta?: Record<string, unknown>;
}

export interface NodeResult {
  output: string;
  artifacts?: Array<{
    type: string;
    url: string;
    metadata?: Record<string, unknown>;
  }>;
  meta?: Record<string, unknown>;
}

export interface ArtifactStoreOptions {
  runId: string;
  buffer: Buffer;
  mime: string;
  ext: string;
  metadata?: Record<string, unknown>;
}

/**
 * Base agent class that provides common functionality for all agents
 */
export abstract class BaseAgent {
  abstract name: string;

  /**
   * Execute a node with the given arguments
   */
  abstract runNode(args: RunArgs): Promise<NodeResult>;

  /**
   * Safely parse JSON from LLM response using a schema
   */
  protected async safeLLMJson<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    runId: string,
    nodeId?: string
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const llm = getLLM();
      const response = await llm.complete({
        model: llm.getDefaultModel(),
        system: `You are a helpful assistant that responds with valid JSON only. 
        Always respond with a valid JSON object that matches the expected schema.
        Do not include any explanatory text, markdown formatting, or code blocks.
        Respond with ONLY the JSON object.`,
        prompt: `${prompt}\n\nRespond with valid JSON only.`,
        temperature: 0.1, // Low temperature for deterministic output
        json: true,
      });

      // Parse the response text as JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(response.text);
      } catch (parseError) {
        logger.warn(
          {
            runId,
            nodeId,
            response: response.text,
            error:
              parseError instanceof Error
                ? parseError.message
                : String(parseError),
          },
          'Failed to parse LLM response as JSON, attempting to extract JSON'
        );

        // Try to extract JSON from the response if it's wrapped in markdown or other text
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No valid JSON found in LLM response');
        }
      }

      // Validate against schema
      const validated = schema.parse(parsed);

      // Record audit log
      await record({
        runId,
        nodeId,
        action: 'llm_json_parse',
        status: 'OK',
        durationMs: Date.now() - startTime,
        payload: { prompt, schema: schema.description || 'unknown' },
        result: { success: true, parsed: validated },
      });

      return validated;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Record audit log for failure
      await record({
        runId,
        nodeId,
        action: 'llm_json_parse',
        status: 'ERR',
        durationMs: duration,
        payload: { prompt, schema: schema.description || 'unknown' },
        result: {
          error: error instanceof Error ? error.message : String(error),
          success: false,
        },
      });

      logger.error(
        {
          runId,
          nodeId,
          error: error instanceof Error ? error.message : String(error),
          prompt,
          duration,
        },
        'Failed to parse LLM response as JSON'
      );

      throw error;
    }
  }

  /**
   * Store an artifact (file) to S3/MinIO and return the URL
   */
  protected async storeArtifact(
    options: ArtifactStoreOptions
  ): Promise<string> {
    const { runId, buffer, mime, ext, metadata = {} } = options;
    const startTime = Date.now();

    try {
      // Generate a unique filename
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      const filename = `${runId}/${timestamp}-${randomId}.${ext}`;

      // For now, we'll use a simple file system storage
      // In production, this would upload to S3/MinIO
      const fs = await import('fs/promises');
      const path = await import('path');

      // Create artifacts directory if it doesn't exist
      const artifactsDir = path.join(process.cwd(), 'artifacts', runId);
      await fs.mkdir(artifactsDir, { recursive: true });

      const filePath = path.join(
        artifactsDir,
        `${timestamp}-${randomId}.${ext}`
      );
      await fs.writeFile(filePath, buffer);

      // Generate a URL (in production, this would be the S3/MinIO URL)
      const baseUrl =
        process.env.ARTIFACT_BASE_URL || 'http://localhost:3000/artifacts';
      const artifactUrl = `${baseUrl}/${filename}`;

      // Store artifact metadata in database
      const { db } = await import('../db/client.js');
      await db.artifact.create({
        data: {
          runId,
          type: mime,
          url: artifactUrl,
          metadata: {
            ...metadata,
            filename,
            size: buffer.length,
            extension: ext,
            storedAt: new Date().toISOString(),
          },
        },
      });

      // Record audit log
      await record({
        runId,
        action: 'artifact_stored',
        status: 'OK',
        durationMs: Date.now() - startTime,
        payload: {
          filename,
          mime,
          size: buffer.length,
          ext,
          metadata,
        },
        result: { url: artifactUrl, success: true },
      });

      logger.info(
        {
          runId,
          filename,
          size: buffer.length,
          url: artifactUrl,
        },
        'Artifact stored successfully'
      );

      return artifactUrl;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Record audit log for failure
      await record({
        runId,
        action: 'artifact_stored',
        status: 'ERR',
        durationMs: duration,
        payload: {
          filename: `${runId}/${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${ext}`,
          mime,
          size: buffer.length,
          ext,
          metadata,
        },
        result: {
          error: error instanceof Error ? error.message : String(error),
          success: false,
        },
      });

      logger.error(
        {
          runId,
          error: error instanceof Error ? error.message : String(error),
          mime,
          size: buffer.length,
          duration,
        },
        'Failed to store artifact'
      );

      throw error;
    }
  }

  /**
   * Helper method to record audit logs for agent actions
   */
  protected async recordAction(
    runId: string,
    nodeId: string,
    action: string,
    payload?: unknown,
    result?: unknown,
    status: 'OK' | 'ERR' = 'OK',
    durationMs?: number
  ): Promise<void> {
    await record({
      runId,
      nodeId,
      action: `${this.name}_${action}`,
      status,
      durationMs: durationMs || 0,
      payload,
      result,
    });
  }
}
