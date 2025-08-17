import { Request, Response, NextFunction } from 'express';

import { createErrorResponse } from '../utils.js';

export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const errorResponse = createErrorResponse('Route not found');
  res.status(404).json(errorResponse);
};
