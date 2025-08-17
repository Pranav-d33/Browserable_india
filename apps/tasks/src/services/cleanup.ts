import { logger } from '@bharat-agents/shared';
import { idempotencyService } from './idempotency.js';

/**
 * Cleanup service for maintaining system health
 */
export class CleanupService {
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Start the cleanup scheduler
   */
  startCleanupScheduler(): void {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.performCleanup();
      } catch (error) {
        logger.error({ error }, 'Cleanup scheduler failed');
      }
    }, 60 * 60 * 1000); // 1 hour

    logger.info('Started cleanup scheduler');
  }

  /**
   * Stop the cleanup scheduler
   */
  stopCleanupScheduler(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Stopped cleanup scheduler');
    }
  }

  /**
   * Perform all cleanup tasks
   */
  private async performCleanup(): Promise<void> {
    logger.info('Starting cleanup tasks');

    try {
      // Clean up expired idempotency keys
      const deletedKeys = await idempotencyService.cleanupExpiredKeys();
      
      logger.info({
        deletedIdempotencyKeys: deletedKeys,
      }, 'Cleanup completed');
    } catch (error) {
      logger.error({ error }, 'Cleanup failed');
    }
  }

  /**
   * Manual cleanup trigger
   */
  async manualCleanup(): Promise<void> {
    logger.info('Manual cleanup triggered');
    await this.performCleanup();
  }
}

// Export singleton instance
export const cleanupService = new CleanupService();
