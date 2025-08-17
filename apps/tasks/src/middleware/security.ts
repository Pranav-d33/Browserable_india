import { Request, Response, NextFunction } from 'express';
import { logger } from '@bharat-agents/shared';

/**
 * Security middleware to ensure proper logging and request sanitization
 */
export const securityMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Ensure sensitive headers are not logged
  const sanitizedHeaders = { ...req.headers };
  
  // Redact sensitive headers
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'x-access-token',
    'x-refresh-token',
    'x-session-token',
    'x-csrf-token',
    'x-xsrf-token',
  ];
  
  sensitiveHeaders.forEach(header => {
    if (sanitizedHeaders[header]) {
      sanitizedHeaders[header] = '[REDACTED]';
    }
  });

  // Log request with sanitized headers
  logger.info({
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    requestId: req.headers['x-request-id'] || 'unknown',
    headers: sanitizedHeaders,
  }, 'Incoming request (sanitized)');

  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
};

/**
 * Input sanitization middleware
 */
export const inputSanitizationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Sanitize query parameters
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        // Basic sanitization for query parameters
        req.query[key] = value
          .replace(/[<>]/g, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      }
    }
  }

  // Sanitize body if present
  if (req.body && typeof req.body === 'object') {
    const sanitizedBody: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string') {
        // Basic sanitization for body values
        sanitizedBody[key] = value
          .replace(/[<>]/g, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      } else {
        sanitizedBody[key] = value;
      }
    }
    
    req.body = sanitizedBody;
  }

  next();
};

/**
 * Rate limiting error handler
 */
export const rateLimitErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err.message === 'Too many requests') {
    logger.warn({
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.headers['x-request-id'] || 'unknown',
    }, 'Rate limit exceeded');
    
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: 60, // 1 minute
    });
    return;
  }
  
  next(err);
};

/**
 * Validate request size
 */
export const requestSizeValidation = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const maxSize = 1024 * 1024; // 1MB
  
  if (contentLength > maxSize) {
    logger.warn({
      contentLength,
      maxSize,
      ip: req.ip,
      requestId: req.headers['x-request-id'] || 'unknown',
    }, 'Request too large');
    
    res.status(413).json({
      error: 'Payload Too Large',
      message: 'Request body too large. Maximum size is 1MB.',
    });
    return;
  }
  
  next();
};
