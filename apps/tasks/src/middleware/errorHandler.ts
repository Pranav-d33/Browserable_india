import {
  createErrorResponse,
  ValidationError,
  isAppError,
} from '@bharat-agents/shared';
import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Error:', error);

  // Handle ValidationError from shared package
  if (error instanceof ValidationError) {
    const errorResponse = createErrorResponse(
      'Validation Error',
      error.message
    );
    res.status(400).json(errorResponse);
    return;
  }

  // Handle other AppError instances
  if (isAppError(error)) {
    const errorResponse = createErrorResponse(error.message, error.details);
    res.status(error.statusCode).json(errorResponse);
    return;
  }

  // Handle Zod validation errors
  if (error.name === 'ZodError') {
    const errorResponse = createErrorResponse(
      'Validation Error',
      'Request validation failed'
    );
    res.status(400).json(errorResponse);
    return;
  }

  if (error.name === 'CastError') {
    const errorResponse = createErrorResponse('Invalid ID format');
    res.status(400).json(errorResponse);
    return;
  }

  // Default error response
  const errorResponse = createErrorResponse(
    'Internal Server Error',
    process.env.NODE_ENV === 'development'
      ? error.message
      : 'Something went wrong'
  );

  res.status(500).json(errorResponse);
}
