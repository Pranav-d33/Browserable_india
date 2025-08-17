// Browser service utilities - standalone to avoid shared package dependencies

import { ApiResponse, PaginatedResponse } from './types.js';

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Create a success API response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string
): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date(),
  };
}

/**
 * Create an error API response
 */
export function createErrorResponse(
  error: string,
  message: string | undefined = undefined
): ApiResponse<never> {
  return {
    success: false,
    error,
    message,
    timestamp: new Date(),
  };
}

/**
 * Create a paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  message?: string
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    success: true,
    data,
    message,
    timestamp: new Date(),
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}
