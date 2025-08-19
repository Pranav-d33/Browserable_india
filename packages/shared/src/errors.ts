import { Request, Response, NextFunction } from 'express';
import type { ErrorRequestHandler } from 'express';

import { logger } from './logger.js';

// HTTP status codes
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
}

// Error types
export enum ErrorType {
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  INTERNAL = 'INTERNAL',
}

// Base application error class
export class AppError extends Error {
  public readonly statusCode: HttpStatus;
  public readonly type: ErrorType;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    type: ErrorType = ErrorType.INTERNAL,
    isOperational: boolean = true,
    code?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.type = type;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }

    // Set prototype explicitly for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      message: this.message,
      statusCode: this.statusCode,
      type: this.type,
      code: this.code,
      details: this.details,
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack }),
    };
  }
}

// Specific error classes
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      message,
      HttpStatus.BAD_REQUEST,
      ErrorType.VALIDATION,
      true,
      'VALIDATION_ERROR',
      details
    );
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(
      message,
      HttpStatus.UNAUTHORIZED,
      ErrorType.AUTHENTICATION,
      true,
      'AUTHENTICATION_ERROR'
    );
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(
      message,
      HttpStatus.FORBIDDEN,
      ErrorType.AUTHORIZATION,
      true,
      'AUTHORIZATION_ERROR'
    );
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(
      `${resource} not found`,
      HttpStatus.NOT_FOUND,
      ErrorType.NOT_FOUND,
      true,
      'NOT_FOUND_ERROR'
    );
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      message,
      HttpStatus.CONFLICT,
      ErrorType.CONFLICT,
      true,
      'CONFLICT_ERROR',
      details
    );
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(
      message,
      HttpStatus.TOO_MANY_REQUESTS,
      ErrorType.RATE_LIMIT,
      true,
      'RATE_LIMIT_ERROR'
    );
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message?: string) {
    super(
      message || `External service error: ${service}`,
      HttpStatus.BAD_GATEWAY,
      ErrorType.EXTERNAL_SERVICE,
      true,
      'EXTERNAL_SERVICE_ERROR'
    );
  }
}

// Error helper functions
export const isAppError = (error: unknown): error is AppError => {
  return error instanceof AppError;
};

export const isOperationalError = (error: Error): boolean => {
  if (isAppError(error)) {
    return error.isOperational;
  }
  return false;
};

// Express error middleware factory
export const createErrorMiddleware = (
  options: {
    includeStack?: boolean;
    logErrors?: boolean;
  } = {}
): ErrorRequestHandler => {
  const {
    includeStack = process.env.NODE_ENV === 'development',
    logErrors = true,
  } = options;

  return (error: Error, req: Request, res: Response, _next: NextFunction) => {
    // Log error if enabled
    if (logErrors) {
      const logData = {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      };

      if (isAppError(error)) {
        logger.error(logData, `AppError: ${error.type} - ${error.message}`);
      } else {
        logger.error(logData, `UnhandledError: ${error.message}`);
      }
    }

    // Handle AppError instances
    if (isAppError(error)) {
      const response: Record<string, unknown> = {
        message: error.message,
        type: error.type,
        code: error.code,
      };

      if (error.details) {
        response.details = error.details;
      }

      if (includeStack) {
        response.stack = error.stack;
      }

      return res.status(error.statusCode).json(response);
    }

    // Handle Zod validation errors
    if (
      error &&
      typeof error === 'object' &&
      (error as { name?: string }).name === 'ZodError' &&
      (error as { issues?: unknown }).issues
    ) {
      const zodError = error as {
        issues: Array<{ path: (string | number)[]; message: string }>;
      };
      const details = zodError.issues.reduce(
        (acc: Record<string, string[]>, issue) => {
          const path = issue.path.join('.');
          if (!acc[path]) acc[path] = [];
          acc[path].push(issue.message);
          return acc;
        },
        {} as Record<string, string[]>
      );

      return res.status(HttpStatus.BAD_REQUEST).json({
        message: 'Validation failed',
        type: ErrorType.VALIDATION,
        code: 'VALIDATION_ERROR',
        details,
        ...(includeStack && { stack: error.stack }),
      });
    }

    // Handle unknown errors
    const statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : error.message;

    const response: Record<string, unknown> = {
      message,
      type: ErrorType.INTERNAL,
      code: 'INTERNAL_ERROR',
    };

    if (includeStack) {
      response.stack = error.stack;
    }

    return res.status(statusCode).json(response);
  };
};

// Async error wrapper for Express routes
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => unknown
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
