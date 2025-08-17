import { Router, IRouter } from 'express';
import { body, query, param } from 'express-validator';

import { browserController } from '../controllers/browserController.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router: IRouter = Router();

// Validation schemas
const launchSessionSchema = [
  // No body validation needed for launch
];

const closeSessionSchema = [
  param('sessionId').isString().withMessage('Session ID must be a string'),
];

const executeActionSchema = [
  body('sessionId').isString().withMessage('Session ID is required'),
  body('type')
    .isIn(['navigate', 'click', 'type', 'screenshot', 'extract', 'wait'])
    .withMessage(
      'Action type must be one of: navigate, click, type, screenshot, extract, wait'
    ),
  body('url').isURL().withMessage('URL must be a valid URL'),
  body('selector')
    .optional()
    .isString()
    .withMessage('Selector must be a string'),
  body('action').optional().isString().withMessage('Action must be a string'),
  body('data').optional().isObject().withMessage('Data must be an object'),
  body('screenshot')
    .optional()
    .isBoolean()
    .withMessage('Screenshot must be a boolean'),
];

const getActionSchema = [
  param('id').isUUID().withMessage('Action ID must be a valid UUID'),
];

const getActionsSchema = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(['pending', 'running', 'completed', 'failed'])
    .withMessage('Status must be one of: pending, running, completed, failed'),
  query('type')
    .optional()
    .isIn(['navigate', 'click', 'type', 'screenshot', 'extract', 'wait'])
    .withMessage(
      'Type must be one of: navigate, click, type, screenshot, extract, wait'
    ),
];

// Session management routes
router.post(
  '/launch',
  launchSessionSchema,
  validateRequest,
  browserController.launchSession
);

router.delete(
  '/close/:sessionId',
  closeSessionSchema,
  validateRequest,
  browserController.closeSession
);

router.get('/sessions', browserController.listSessions);

// Action routes
router.post(
  '/actions',
  executeActionSchema,
  validateRequest,
  browserController.executeAction
);

router.get(
  '/actions',
  getActionsSchema,
  validateRequest,
  browserController.getActions
);

router.get(
  '/actions/:id',
  getActionSchema,
  validateRequest,
  browserController.getAction
);

export { router as browserRoutes };
