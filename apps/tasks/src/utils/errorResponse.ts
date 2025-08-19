import { Request, Response } from 'express';

export interface StructuredErrorResponse {
  error: string;
  message: string;
  traceId: string;
  requestId: string;
  timestamp: string;
  path: string;
  method: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

/**
 * Create a structured error response
 */
export const createErrorResponse = (
  req: Request,
  error: Error | string,
  statusCode: number = 500,
  details?: Record<string, unknown>
): StructuredErrorResponse => {
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';
  const traceId = (req.headers['x-trace-id'] as string) || requestId;

  return {
    error: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : error,
    traceId,
    requestId,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    statusCode,
    ...(details && { details }),
  };
};

/**
 * Send structured error response
 */
export const sendErrorResponse = (
  req: Request,
  res: Response,
  error: Error | string,
  statusCode: number = 500,
  details?: Record<string, unknown>
): void => {
  const errorResponse = createErrorResponse(req, error, statusCode, details);
  res.status(statusCode).json(errorResponse);
};

/**
 * Create validation error response
 */
export const createValidationErrorResponse = (
  req: Request,
  field: string,
  message: string,
  value?: unknown
): StructuredErrorResponse => {
  return createErrorResponse(req, 'Validation Error', 400, {
    field,
    message,
    ...(value !== undefined && { value }),
  });
};

/**
 * Create not found error response
 */
export const createNotFoundErrorResponse = (
  req: Request,
  resource: string,
  id?: string
): StructuredErrorResponse => {
  return createErrorResponse(req, 'Not Found', 404, { resource, id });
};

/**
 * Create unauthorized error response
 */
export const createUnauthorizedErrorResponse = (
  req: Request,
  reason?: string
): StructuredErrorResponse => {
  return createErrorResponse(
    req,
    'Unauthorized',
    401,
    reason ? { reason } : undefined
  );
};

/**
 * Create forbidden error response
 */
export const createForbiddenErrorResponse = (
  req: Request,
  requiredRoles?: string[]
): StructuredErrorResponse => {
  return createErrorResponse(
    req,
    'Forbidden',
    403,
    requiredRoles ? { requiredRoles } : undefined
  );
};
