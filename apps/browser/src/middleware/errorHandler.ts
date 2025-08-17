import { Request, Response, NextFunction } from 'express';

import { createErrorResponse } from '../utils.js';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('Error:', error);

  const errorResponse = createErrorResponse(
    error.message || 'Internal server error'
  );

  res.status(500).json(errorResponse);
};
