import { createClient } from 'redis';
import { env, logger } from '@bharat-agents/shared';

// Create Redis client
const redisClient = createClient({
  url: env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: retries => {
      if (retries > 10) {
        logger.error('Redis connection failed after 10 retries');
        return new Error('Redis connection failed');
      }
      return Math.min(retries * 100, 3000);
    },
  },
});

// Handle Redis events
redisClient.on('connect', () => {
  logger.info('Redis client connected');
});

redisClient.on('error', error => {
  logger.error({ error }, 'Redis client error');
});

redisClient.on('ready', () => {
  logger.info('Redis client ready');
});

redisClient.on('end', () => {
  logger.info('Redis client disconnected');
});

// Connect to Redis
redisClient.connect().catch(error => {
  logger.error({ error }, 'Failed to connect to Redis');
});

/**
 * Check Redis health
 */
export const checkRedisHealth = async (): Promise<boolean> => {
  try {
    await redisClient.ping();
    return true;
  } catch (error) {
    logger.error({ error }, 'Redis health check failed');
    return false;
  }
};

/**
 * Get Redis client instance
 */
export const getRedisClient = () => redisClient;

/**
 * Export Redis client for direct use
 */
export const redis = redisClient;

/**
 * Close Redis connection
 */
export const closeRedisConnection = async (): Promise<void> => {
  try {
    await redisClient.quit();
    logger.info('Redis connection closed');
  } catch (error) {
    logger.error({ error }, 'Error closing Redis connection');
  }
};
