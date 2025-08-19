import { redis } from './redis.js';
import { logger } from '@bharat-agents/shared';

export interface RateLimitConfig {
  requestsPerMinute: number;
  concurrentRuns: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export interface ConcurrentLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
}

/**
 * Per-user rate limiting service using Redis
 */
export class UserRateLimitService {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if user can make a request (rate limit)
   */
  async checkRateLimit(userId: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const key = `rate_limit:${userId}`;

    try {
      // Use Redis pipeline for atomic operations
      const pipeline = redis.pipeline();

      // Remove old entries (older than window)
      pipeline.zremrangebyscore(key, 0, windowStart);

      // Count current requests in window
      pipeline.zcard(key);

      // Add current request timestamp
      pipeline.zadd(key, now, now.toString());

      // Set expiry on the key
      pipeline.expire(key, Math.ceil(this.config.windowMs / 1000));

      const results = await pipeline.exec();

      if (!results) {
        throw new Error('Redis pipeline failed');
      }

      const currentCount = results[1] as number;
      const remaining = Math.max(
        0,
        this.config.requestsPerMinute - currentCount
      );
      const allowed = currentCount < this.config.requestsPerMinute;

      // Calculate reset time
      const resetTime = now + this.config.windowMs;

      // Calculate retry after if rate limited
      let retryAfter: number | undefined;
      if (!allowed) {
        const oldestRequest = await redis.zrange(key, 0, 0, 'WITHSCORES');
        if (oldestRequest && oldestRequest.length >= 2) {
          const oldestTime = parseInt(oldestRequest[1]);
          retryAfter = Math.ceil(
            (oldestTime + this.config.windowMs - now) / 1000
          );
        }
      }

      logger.debug(
        {
          userId,
          currentCount,
          remaining,
          allowed,
          resetTime,
          retryAfter,
        },
        'Rate limit check completed'
      );

      return {
        allowed,
        remaining,
        resetTime,
        retryAfter,
      };
    } catch (error) {
      logger.error({ userId, error }, 'Rate limit check failed');

      // On Redis failure, allow the request but log the error
      return {
        allowed: true,
        remaining: this.config.requestsPerMinute - 1,
        resetTime: now + this.config.windowMs,
      };
    }
  }

  /**
   * Check if user can start a new concurrent run
   */
  async checkConcurrentLimit(userId: string): Promise<ConcurrentLimitResult> {
    const key = `concurrent_runs:${userId}`;

    try {
      const current = await redis.scard(key);
      const allowed = current < this.config.concurrentRuns;

      logger.debug(
        {
          userId,
          current,
          limit: this.config.concurrentRuns,
          allowed,
        },
        'Concurrent limit check completed'
      );

      return {
        allowed,
        current,
        limit: this.config.concurrentRuns,
      };
    } catch (error) {
      logger.error({ userId, error }, 'Concurrent limit check failed');

      // On Redis failure, allow the request but log the error
      return {
        allowed: true,
        current: 0,
        limit: this.config.concurrentRuns,
      };
    }
  }

  /**
   * Track the start of a concurrent run
   */
  async trackRunStart(userId: string, runId: string): Promise<void> {
    const key = `concurrent_runs:${userId}`;

    try {
      await redis.sadd(key, runId);
      await redis.expire(key, 3600); // Expire after 1 hour as safety

      logger.debug({ userId, runId }, 'Run start tracked');
    } catch (error) {
      logger.error({ userId, runId, error }, 'Failed to track run start');
    }
  }

  /**
   * Track the end of a concurrent run
   */
  async trackRunEnd(userId: string, runId: string): Promise<void> {
    const key = `concurrent_runs:${userId}`;

    try {
      await redis.srem(key, runId);

      logger.debug({ userId, runId }, 'Run end tracked');
    } catch (error) {
      logger.error({ userId, runId, error }, 'Failed to track run end');
    }
  }

  /**
   * Get current rate limit status for a user
   */
  async getRateLimitStatus(userId: string): Promise<{
    rateLimit: RateLimitResult;
    concurrentLimit: ConcurrentLimitResult;
  }> {
    const [rateLimit, concurrentLimit] = await Promise.all([
      this.checkRateLimit(userId),
      this.checkConcurrentLimit(userId),
    ]);

    return { rateLimit, concurrentLimit };
  }

  /**
   * Reset rate limits for a user (admin function)
   */
  async resetUserLimits(userId: string): Promise<void> {
    try {
      const pipeline = redis.pipeline();
      pipeline.del(`rate_limit:${userId}`);
      pipeline.del(`concurrent_runs:${userId}`);
      await pipeline.exec();

      logger.info({ userId }, 'User rate limits reset');
    } catch (error) {
      logger.error({ userId, error }, 'Failed to reset user rate limits');
      throw error;
    }
  }
}

// Default configuration
const defaultConfig: RateLimitConfig = {
  requestsPerMinute: 120,
  concurrentRuns: 3,
  windowMs: 60 * 1000, // 1 minute
};

// Export singleton instance
export const userRateLimitService = new UserRateLimitService(defaultConfig);
