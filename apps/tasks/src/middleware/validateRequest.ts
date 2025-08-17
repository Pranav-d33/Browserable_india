import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '@bharat-agents/shared';

/**
 * Middleware to validate request data using Zod schemas
 */
export const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Replace request data with validated data
      req.body = validatedData.body || req.body;
      req.query = validatedData.query || req.query;
      req.params = validatedData.params || req.params;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = new ValidationError(
          'Request validation failed',
          error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          }))
        );
        next(validationError);
      } else {
        next(error);
      }
    }
  };
};
