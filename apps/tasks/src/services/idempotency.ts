import { logger } from '@bharat-agents/shared';
import { db } from '../db/client.js';
import { recordIdempotencyOperation } from './metrics.js';

export interface IdempotencyResult {
  isDuplicate: boolean;
  existingRunId?: string;
  existingRun?: unknown;
}

/**
 * Idempotency service for handling duplicate request prevention
 */
export class IdempotencyService {
  /**
   * Check if an idempotency key exists and return existing run if found
   */
  async checkIdempotency(idempotencyKey: string): Promise<IdempotencyResult> {
    try {
      const existing = await db.idempotency.findUnique({
        where: { idempotencyKey },
        include: {
          run: true,
        },
      });

      if (existing) {
        logger.info(
          {
            idempotencyKey,
            runId: existing.runId,
          },
          'Idempotency key found, returning existing run'
        );

        recordIdempotencyOperation('check', 'found');

        return {
          isDuplicate: true,
          existingRunId: existing.runId,
          existingRun: existing.run,
        };
      }

      recordIdempotencyOperation('check', 'not_found');
      return { isDuplicate: false };
    } catch (error) {
      logger.error({ error, idempotencyKey }, 'Failed to check idempotency');
      // On error, allow the request to proceed (fail open)
      return { isDuplicate: false };
    }
  }

  /**
   * Store idempotency key with run ID
   */
  async storeIdempotency(idempotencyKey: string, runId: string): Promise<void> {
    try {
      await db.idempotency.create({
        data: {
          idempotencyKey,
          runId,
        },
      });

      logger.info(
        {
          idempotencyKey,
          runId,
        },
        'Stored idempotency key'
      );

      recordIdempotencyOperation('store', 'success');
    } catch (error) {
      logger.error(
        { error, idempotencyKey, runId },
        'Failed to store idempotency key'
      );
      recordIdempotencyOperation('store', 'failed');
      // Don't throw - idempotency failure shouldn't break the main flow
    }
  }

  /**
   * Clean up expired idempotency keys (older than 24 hours)
   */
  async cleanupExpiredKeys(): Promise<number> {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const result = await db.idempotency.deleteMany({
        where: {
          createdAt: {
            lt: twentyFourHoursAgo,
          },
        },
      });

      logger.info(
        {
          deletedCount: result.count,
        },
        'Cleaned up expired idempotency keys'
      );

      recordIdempotencyOperation('cleanup', 'success');
      return result.count;
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup expired idempotency keys');
      recordIdempotencyOperation('cleanup', 'failed');
      return 0;
    }
  }

  /**
   * Validate idempotency key format
   */
  validateKey(key: string): boolean {
    // Idempotency key should be a valid UUID or a reasonable string
    if (!key || key.length < 1 || key.length > 255) {
      return false;
    }

    // Allow UUID format or alphanumeric with hyphens/underscores
    const validFormat = /^[a-zA-Z0-9_-]+$/.test(key);
    return validFormat;
  }
}

// Export singleton instance
export const idempotencyService = new IdempotencyService();
