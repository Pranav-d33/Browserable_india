import { Request, Response, NextFunction } from 'express';
import { ulid } from 'ulid';

/**
 * Middleware to add request ID to request and response headers
 */
export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Use existing x-request-id header or generate new one
  const requestId = (req.headers['x-request-id'] as string) || ulid();
  
  // Add request ID to request object
  req.headers['x-request-id'] = requestId;
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);
  
  // Add trace ID (same as request ID for now, can be enhanced later)
  res.setHeader('X-Trace-ID', requestId);
  
  next();
};
