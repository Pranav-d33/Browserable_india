import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
  HttpStatus,
  ErrorType,
  isAppError,
  isOperationalError,
  createErrorMiddleware,
  asyncHandler,
} from '../errors.js';

// Mock logger
vi.mock('../logger.js', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AppError', () => {
    it('should create an AppError with default values', () => {
      const error = new AppError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(error.type).toBe(ErrorType.INTERNAL);
      expect(error.isOperational).toBe(true);
      expect(error.code).toBeUndefined();
      expect(error.details).toBeUndefined();
    });

    it('should create an AppError with custom values', () => {
      const error = new AppError(
        'Custom error',
        HttpStatus.BAD_REQUEST,
        ErrorType.VALIDATION,
        false,
        'CUSTOM_ERROR',
        { field: 'test' }
      );

      expect(error.message).toBe('Custom error');
      expect(error.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(error.type).toBe(ErrorType.VALIDATION);
      expect(error.isOperational).toBe(false);
      expect(error.code).toBe('CUSTOM_ERROR');
      expect(error.details).toEqual({ field: 'test' });
    });

    it('should have proper stack trace', () => {
      const error = new AppError('Test error');
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });

    it('should serialize to JSON correctly', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new AppError(
        'Test error',
        HttpStatus.BAD_REQUEST,
        ErrorType.VALIDATION
      );
      const json = error.toJSON();

      expect(json.message).toBe('Test error');
      expect(json.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(json.type).toBe(ErrorType.VALIDATION);
      expect(json.stack).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });

    it('should not include stack in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new AppError('Test error');
      const json = error.toJSON();

      expect(json.stack).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Specific Error Classes', () => {
    it('should create ValidationError', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });

      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(error.type).toBe(ErrorType.VALIDATION);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual({ field: 'email' });
    });

    it('should create AuthenticationError with default message', () => {
      const error = new AuthenticationError();

      expect(error.message).toBe('Authentication required');
      expect(error.statusCode).toBe(HttpStatus.UNAUTHORIZED);
      expect(error.type).toBe(ErrorType.AUTHENTICATION);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('should create AuthenticationError with custom message', () => {
      const error = new AuthenticationError('Custom auth error');

      expect(error.message).toBe('Custom auth error');
      expect(error.statusCode).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should create AuthorizationError with default message', () => {
      const error = new AuthorizationError();

      expect(error.message).toBe('Insufficient permissions');
      expect(error.statusCode).toBe(HttpStatus.FORBIDDEN);
      expect(error.type).toBe(ErrorType.AUTHORIZATION);
      expect(error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('should create NotFoundError with resource name', () => {
      const error = new NotFoundError('User');

      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(HttpStatus.NOT_FOUND);
      expect(error.type).toBe(ErrorType.NOT_FOUND);
      expect(error.code).toBe('NOT_FOUND_ERROR');
    });

    it('should create ConflictError', () => {
      const error = new ConflictError('Resource already exists', { id: '123' });

      expect(error.message).toBe('Resource already exists');
      expect(error.statusCode).toBe(HttpStatus.CONFLICT);
      expect(error.type).toBe(ErrorType.CONFLICT);
      expect(error.code).toBe('CONFLICT_ERROR');
      expect(error.details).toEqual({ id: '123' });
    });

    it('should create RateLimitError with default message', () => {
      const error = new RateLimitError();

      expect(error.message).toBe('Rate limit exceeded');
      expect(error.statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(error.type).toBe(ErrorType.RATE_LIMIT);
      expect(error.code).toBe('RATE_LIMIT_ERROR');
    });

    it('should create ExternalServiceError', () => {
      const error = new ExternalServiceError('Database');

      expect(error.message).toBe('External service error: Database');
      expect(error.statusCode).toBe(HttpStatus.BAD_GATEWAY);
      expect(error.type).toBe(ErrorType.EXTERNAL_SERVICE);
      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
    });

    it('should create ExternalServiceError with custom message', () => {
      const error = new ExternalServiceError('Database', 'Connection timeout');

      expect(error.message).toBe('Connection timeout');
      expect(error.statusCode).toBe(HttpStatus.BAD_GATEWAY);
    });
  });

  describe('Error Helper Functions', () => {
    it('should identify AppError instances', () => {
      const appError = new AppError('Test');
      const regularError = new Error('Test');

      expect(isAppError(appError)).toBe(true);
      expect(isAppError(regularError)).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
    });

    it('should check operational errors', () => {
      const operationalError = new AppError(
        'Test',
        HttpStatus.BAD_REQUEST,
        ErrorType.VALIDATION,
        true
      );
      const nonOperationalError = new AppError(
        'Test',
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorType.INTERNAL,
        false
      );
      const regularError = new Error('Test');

      expect(isOperationalError(operationalError)).toBe(true);
      expect(isOperationalError(nonOperationalError)).toBe(false);
      expect(isOperationalError(regularError)).toBe(false);
    });
  });

  describe('Error Middleware', () => {
    it('should create error middleware with default options', () => {
      const middleware = createErrorMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('should create error middleware with custom options', () => {
      const middleware = createErrorMiddleware({
        includeStack: true,
        logErrors: false,
      });
      expect(typeof middleware).toBe('function');
    });

    it('should handle AppError instances', () => {
      const middleware = createErrorMiddleware();
      const req = {
        url: '/test',
        method: 'GET',
        ip: '127.0.0.1',
        get: vi.fn(),
      } as any;
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
      const next = vi.fn();

      const error = new ValidationError('Invalid input');
      middleware(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid input',
        type: ErrorType.VALIDATION,
        code: 'VALIDATION_ERROR',
      });
    });

    it('should handle Zod validation errors', () => {
      const middleware = createErrorMiddleware();
      const req = {
        url: '/test',
        method: 'GET',
        ip: '127.0.0.1',
        get: vi.fn(),
      } as any;
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
      const next = vi.fn();

      const zodError = new Error('ZodError');
      zodError.name = 'ZodError';
      (zodError as any).issues = [
        { path: ['email'], message: 'Invalid email' },
        { path: ['password'], message: 'Password required' },
      ];

      middleware(zodError, req, res, next);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Validation failed',
        type: ErrorType.VALIDATION,
        code: 'VALIDATION_ERROR',
        details: {
          email: ['Invalid email'],
          password: ['Password required'],
        },
      });
    });

    it('should handle unknown errors', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const middleware = createErrorMiddleware();
      const req = {
        url: '/test',
        method: 'GET',
        ip: '127.0.0.1',
        get: vi.fn(),
      } as any;
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
      const next = vi.fn();

      const error = new Error('Unknown error');
      middleware(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error',
        type: ErrorType.INTERNAL,
        code: 'INTERNAL_ERROR',
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Async Handler', () => {
    it('should wrap async functions and catch errors', async () => {
      const req = {} as any;
      const res = {} as any;
      const next = vi.fn();

      const asyncFn = vi.fn().mockRejectedValue(new Error('Async error'));
      const wrappedFn = asyncHandler(asyncFn);

      await wrappedFn(req, res, next);

      expect(asyncFn).toHaveBeenCalledWith(req, res, next);
      // Give the async handler time to process
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should pass through successful async functions', async () => {
      const req = {} as any;
      const res = {} as any;
      const next = vi.fn();

      const asyncFn = vi.fn().mockResolvedValue('success');
      const wrappedFn = asyncHandler(asyncFn);

      await wrappedFn(req, res, next);

      expect(asyncFn).toHaveBeenCalledWith(req, res, next);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
