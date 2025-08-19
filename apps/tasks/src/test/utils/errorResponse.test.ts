import { describe, it, expect } from 'vitest';
import { Request, Response } from 'express';
import {
  createErrorResponse,
  sendErrorResponse,
  createValidationErrorResponse,
  createNotFoundErrorResponse,
  createUnauthorizedErrorResponse,
  createForbiddenErrorResponse,
} from '../../utils/errorResponse.js';

describe('Error Response Utils', () => {
  const mockRequest = {
    method: 'POST',
    path: '/v1/tasks/create',
    headers: {
      'x-request-id': 'test-request-id-123',
      'x-trace-id': 'test-trace-id-456',
    },
  } as Request;

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as Response;

  describe('createErrorResponse', () => {
    it('should create structured error response with error object', () => {
      const error = new Error('Test error message');
      const response = createErrorResponse(mockRequest, error, 500);

      expect(response).toMatchObject({
        error: 'Error',
        message: 'Test error message',
        traceId: 'test-trace-id-456',
        requestId: 'test-request-id-123',
        path: '/v1/tasks/create',
        method: 'POST',
        statusCode: 500,
      });
      expect(response.timestamp).toBeDefined();
    });

    it('should create structured error response with string error', () => {
      const response = createErrorResponse(mockRequest, 'String error', 400);

      expect(response).toMatchObject({
        error: 'Error',
        message: 'String error',
        statusCode: 400,
      });
    });

    it('should include details when provided', () => {
      const details = { field: 'test', value: 'invalid' };
      const response = createErrorResponse(
        mockRequest,
        'Test error',
        400,
        details
      );

      expect(response.details).toEqual(details);
    });

    it('should use request ID as trace ID when trace ID not provided', () => {
      const reqWithoutTraceId = {
        ...mockRequest,
        headers: { 'x-request-id': 'test-request-id-123' },
      } as Request;

      const response = createErrorResponse(
        reqWithoutTraceId,
        'Test error',
        500
      );

      expect(response.traceId).toBe('test-request-id-123');
    });

    it('should use unknown for missing request ID', () => {
      const reqWithoutIds = {
        ...mockRequest,
        headers: {},
      } as Request;

      const response = createErrorResponse(reqWithoutIds, 'Test error', 500);

      expect(response.requestId).toBe('unknown');
      expect(response.traceId).toBe('unknown');
    });
  });

  describe('sendErrorResponse', () => {
    it('should send error response with correct status and JSON', () => {
      sendErrorResponse(mockRequest, mockResponse, 'Test error', 400);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Error',
          message: 'Test error',
          statusCode: 400,
        })
      );
    });
  });

  describe('createValidationErrorResponse', () => {
    it('should create validation error response', () => {
      const response = createValidationErrorResponse(
        mockRequest,
        'email',
        'Invalid email format',
        'invalid@email'
      );

      expect(response).toMatchObject({
        error: 'Error',
        message: 'Validation Error',
        statusCode: 400,
        details: {
          field: 'email',
          message: 'Invalid email format',
          value: 'invalid@email',
        },
      });
    });

    it('should create validation error response without value', () => {
      const response = createValidationErrorResponse(
        mockRequest,
        'email',
        'Invalid email format'
      );

      expect(response.details).toEqual({
        field: 'email',
        message: 'Invalid email format',
      });
    });
  });

  describe('createNotFoundErrorResponse', () => {
    it('should create not found error response with ID', () => {
      const response = createNotFoundErrorResponse(
        mockRequest,
        'Task',
        'task-123'
      );

      expect(response).toMatchObject({
        error: 'Error',
        message: 'Not Found',
        statusCode: 404,
        details: {
          resource: 'Task',
          id: 'task-123',
        },
      });
    });

    it('should create not found error response without ID', () => {
      const response = createNotFoundErrorResponse(mockRequest, 'Task');

      expect(response).toMatchObject({
        error: 'Error',
        message: 'Not Found',
        statusCode: 404,
        details: {
          resource: 'Task',
        },
      });
    });
  });

  describe('createUnauthorizedErrorResponse', () => {
    it('should create unauthorized error response with reason', () => {
      const response = createUnauthorizedErrorResponse(
        mockRequest,
        'Invalid token'
      );

      expect(response).toMatchObject({
        error: 'Error',
        message: 'Unauthorized',
        statusCode: 401,
        details: {
          reason: 'Invalid token',
        },
      });
    });

    it('should create unauthorized error response without reason', () => {
      const response = createUnauthorizedErrorResponse(mockRequest);

      expect(response).toMatchObject({
        error: 'Error',
        message: 'Unauthorized',
        statusCode: 401,
      });
      expect(response.details).toBeUndefined();
    });
  });

  describe('createForbiddenErrorResponse', () => {
    it('should create forbidden error response with required roles', () => {
      const response = createForbiddenErrorResponse(mockRequest, [
        'ADMIN',
        'USER',
      ]);

      expect(response).toMatchObject({
        error: 'Error',
        message: 'Forbidden',
        statusCode: 403,
        details: {
          requiredRoles: ['ADMIN', 'USER'],
        },
      });
    });

    it('should create forbidden error response without required roles', () => {
      const response = createForbiddenErrorResponse(mockRequest);

      expect(response).toMatchObject({
        error: 'Error',
        message: 'Forbidden',
        statusCode: 403,
      });
      expect(response.details).toBeUndefined();
    });
  });
});
