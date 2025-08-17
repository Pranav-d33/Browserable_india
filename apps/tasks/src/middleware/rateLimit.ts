import { Request, Response, NextFunction } from 'express';
import { userRateLimitService } from '../services/rateLimit.js';
import { getCurrentUserId } from '../security/auth.js';
import { AuthenticatedRequest } from '../security/auth.js';
import { logger } from '@bharat-agents/shared';

/**
 * Rate limiting middleware for authenticated users
 */
export async function userRateLimitMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User must be authenticated for rate limiting',
      });
      return;
    }

    // Check rate limit
    const rateLimitResult = await userRateLimitService.checkRateLimit(userId);
    
    if (!rateLimitResult.allowed) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: rateLimitResult.retryAfter,
        resetTime: rateLimitResult.resetTime,
      });
      
      // Set retry-after header
      if (rateLimitResult.retryAfter) {
        res.set('Retry-After', rateLimitResult.retryAfter.toString());
      }
      
      logger.warn({
        userId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
        retryAfter: rateLimitResult.retryAfter,
      }, 'Rate limit exceeded');
      
      return;
    }

    // Set rate limit headers
    res.set('X-RateLimit-Limit', '120');
    res.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    res.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());

    next();
  } catch (error) {
    logger.error({ error }, 'Rate limit middleware error');
    
    // On error, allow the request but log the issue
    next();
  }
}

/**
 * Concurrent run limit middleware
 */
export async function concurrentRunLimitMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User must be authenticated for concurrent run limiting',
      });
      return;
    }

    // Check concurrent limit
    const concurrentResult = await userRateLimitService.checkConcurrentLimit(userId);
    
    if (!concurrentResult.allowed) {
      res.status(429).json({
        error: 'Concurrent run limit exceeded',
        message: `Maximum ${concurrentResult.limit} concurrent runs allowed. Please wait for a run to complete.`,
        current: concurrentResult.current,
        limit: concurrentResult.limit,
      });
      
      logger.warn({
        userId,
        current: concurrentResult.current,
        limit: concurrentResult.limit,
        path: req.path,
        method: req.method,
      }, 'Concurrent run limit exceeded');
      
      return;
    }

    // Set concurrent limit headers
    res.set('X-ConcurrentLimit-Limit', concurrentResult.limit.toString());
    res.set('X-ConcurrentLimit-Current', concurrentResult.current.toString());

    next();
  } catch (error) {
    logger.error({ error }, 'Concurrent run limit middleware error');
    
    // On error, allow the request but log the issue
    next();
  }
}

/**
 * Combined rate limit and concurrent limit middleware
 */
export async function combinedLimitMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User must be authenticated for rate limiting',
      });
      return;
    }

    // Check both limits
    const [rateLimitResult, concurrentResult] = await Promise.all([
      userRateLimitService.checkRateLimit(userId),
      userRateLimitService.checkConcurrentLimit(userId),
    ]);

    // Check rate limit first
    if (!rateLimitResult.allowed) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: rateLimitResult.retryAfter,
        resetTime: rateLimitResult.resetTime,
      });
      
      if (rateLimitResult.retryAfter) {
        res.set('Retry-After', rateLimitResult.retryAfter.toString());
      }
      
      logger.warn({
        userId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
        retryAfter: rateLimitResult.retryAfter,
      }, 'Rate limit exceeded');
      
      return;
    }

    // Check concurrent limit
    if (!concurrentResult.allowed) {
      res.status(429).json({
        error: 'Concurrent run limit exceeded',
        message: `Maximum ${concurrentResult.limit} concurrent runs allowed. Please wait for a run to complete.`,
        current: concurrentResult.current,
        limit: concurrentResult.limit,
      });
      
      logger.warn({
        userId,
        current: concurrentResult.current,
        limit: concurrentResult.limit,
        path: req.path,
        method: req.method,
      }, 'Concurrent run limit exceeded');
      
      return;
    }

    // Set all limit headers
    res.set('X-RateLimit-Limit', '120');
    res.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    res.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());
    res.set('X-ConcurrentLimit-Limit', concurrentResult.limit.toString());
    res.set('X-ConcurrentLimit-Current', concurrentResult.current.toString());

    next();
  } catch (error) {
    logger.error({ error }, 'Combined limit middleware error');
    
    // On error, allow the request but log the issue
    next();
  }
}
