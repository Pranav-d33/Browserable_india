import { Request, Response } from 'express';

import { browserService } from '../services/browserService.js';
import { BrowserActionType, BrowserActionStatus, SessionId } from '../types.js';
import {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
} from '../utils.js';

export const browserController = {
  // Session management endpoints
  async launchSession(req: Request, res: Response): Promise<void> {
    try {
      const result = await browserService.launchSession();

      const response = createSuccessResponse(
        result,
        'Browser session launched successfully'
      );
      res.status(201).json(response);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message || 'Unknown error'
          : 'Unknown error';
      const errorResponse = createErrorResponse(
        'Failed to launch browser session',
        errorMessage
      );
      res.status(500).json(errorResponse);
    }
  },

  async closeSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        const errorResponse = createErrorResponse('Session ID is required');
        res.status(400).json(errorResponse);
        return;
      }

      await browserService.closeSession(sessionId as SessionId);

      const response = createSuccessResponse(
        { sessionId },
        'Browser session closed successfully'
      );
      res.status(200).json(response);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message || 'Unknown error'
          : 'Unknown error';
      const errorResponse = createErrorResponse(
        'Failed to close browser session',
        errorMessage
      );
      res.status(500).json(errorResponse);
    }
  },

  async listSessions(req: Request, res: Response): Promise<void> {
    try {
      const sessions = await browserService.listSessions();

      const response = createSuccessResponse(
        sessions,
        'Browser sessions retrieved successfully'
      );
      res.status(200).json(response);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message || 'Unknown error'
          : 'Unknown error';
      const errorResponse = createErrorResponse(
        'Failed to list browser sessions',
        errorMessage
      );
      res.status(500).json(errorResponse);
    }
  },

  // Action execution (updated to require sessionId)
  async executeAction(req: Request, res: Response): Promise<void> {
    try {
      const actionData = req.body;

      // Validate that sessionId is provided
      if (!actionData.sessionId) {
        const errorResponse = createErrorResponse(
          'sessionId is required for browser actions'
        );
        res.status(400).json(errorResponse);
        return;
      }

      const action = await browserService.executeAction(actionData);

      const response = createSuccessResponse(
        action,
        'Browser action executed successfully'
      );
      res.status(201).json(response);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message || 'Unknown error'
          : 'Unknown error';
      const errorResponse = createErrorResponse(
        'Failed to execute browser action',
        errorMessage
      );
      res.status(500).json(errorResponse);
    }
  },

  async getActions(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as BrowserActionStatus;
      const type = req.query.type as BrowserActionType;

      const result = await browserService.getActions({
        page,
        limit,
        status,
        type,
      });

      const response = createPaginatedResponse(
        result.actions,
        page,
        limit,
        result.total
      );

      res.status(200).json(response);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message || 'Unknown error'
          : 'Unknown error';
      const errorResponse = createErrorResponse(
        'Failed to fetch browser actions',
        errorMessage
      );
      res.status(500).json(errorResponse);
    }
  },

  async getAction(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const action = await browserService.getAction(id);

      if (!action) {
        const errorResponse = createErrorResponse('Browser action not found');
        res.status(404).json(errorResponse);
        return;
      }

      const response = createSuccessResponse(action);
      res.status(200).json(response);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message || 'Unknown error'
          : 'Unknown error';
      const errorResponse = createErrorResponse(
        'Failed to fetch browser action',
        errorMessage
      );
      res.status(500).json(errorResponse);
    }
  },
};
