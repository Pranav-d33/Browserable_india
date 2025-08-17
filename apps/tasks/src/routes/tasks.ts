import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@bharat-agents/shared';
import { validateRequest } from '../middleware/validateRequest.js';
import { createTask, getRunDetails, getRunAuditLogs } from '../controllers/taskController.js';
import { createTaskSchema } from '../schemas/validation.js';
import { authenticateToken, requireUser, requireRole } from '../security/auth.js';

const router = Router();

// =============================================================================
// Request Validation Schemas
// =============================================================================

const taskRequestSchema = z.object({
  body: createTaskSchema,
});

// =============================================================================
// Routes
// =============================================================================

/**
 * POST /v1/tasks/create
 * Create a new task execution with enhanced agent selection
 * Body: { agent?: 'BROWSER'|'GEN', input: string, options?: object }
 * Returns: { runId, status, output, artifacts? }
 */
router.post(
  '/create',
  authenticateToken,
  requireRole(['user', 'admin']),
  validateRequest(taskRequestSchema),
  asyncHandler(createTask)
);

/**
 * GET /v1/runs/:id
 * Get run details with nodes and artifacts
 * Owner/admin only with RBAC enforcement
 */
router.get(
  '/runs/:id',
  authenticateToken,
  requireRole(['admin', 'user']),
  asyncHandler(getRunDetails)
);

/**
 * GET /v1/runs/:id/logs
 * Get audit logs for a run
 * Owner/admin only with RBAC enforcement
 */
router.get(
  '/runs/:id/logs',
  authenticateToken,
  requireRole(['admin', 'user']),
  asyncHandler(getRunAuditLogs)
);

export { router as tasksRouter };
