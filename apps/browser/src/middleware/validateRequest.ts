import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

import { createErrorResponse } from '../utils.js';

export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors
      .array()
      .map(error => error.msg)
      .join(', ');
    const errorResponse = createErrorResponse(
      'Validation failed',
      errorMessages
    );
    res.status(400).json(errorResponse);
    return;
  }

  next();
};
