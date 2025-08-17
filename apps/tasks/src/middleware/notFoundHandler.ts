import { createErrorResponse } from '@bharat-agents/shared';
import { Request, Response } from 'express';

export function notFoundHandler(req: Request, res: Response): void {
  const errorResponse = createErrorResponse(
    'Not Found',
    `Route ${req.method} ${req.originalUrl} not found`
  );

  res.status(404).json(errorResponse);
}
