import type { Response } from 'express';
import { logger, AgentKind } from '@bharat-agents/shared';
import { jarvis } from '../orchestrator/jarvis.js';
// import { db } from '../db/client.js';
import { idempotencyService } from '../services/idempotency.js';
import { recordTaskCreation } from '../services/metrics.js';
import { sendErrorResponse } from '../utils/errorResponse.js';
import {
  CreateTaskRequest,
  TaskResponse,
  createSanitizedResponse,
  taskResponseSchema,
} from '../schemas/validation.js';
import { getCurrentUserId } from '../security/auth.js';
import { AuthenticatedRequest } from '../security/auth.js';

// Use imported types from validation schema
interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * Create a new task execution
 * POST /v1/tasks/create
 */
export const createTask = async (
  req: AuthenticatedRequest,
  res: Response<TaskResponse | ErrorResponse>
): Promise<void> => {
  const { agent, input, options } = req.body as CreateTaskRequest;
  const idempotencyKey = req.headers['idempotency-key'] as string;
  const userId = getCurrentUserId(req);

  if (!userId) {
    sendErrorResponse(req, res, 'Authentication required', 401, {
      message: 'User must be authenticated to create tasks',
    });
    return;
  }

  logger.info(
    {
      userId,
      agent,
      inputLength: input.length,
      hasOptions: !!options,
      hasIdempotencyKey: !!idempotencyKey,
    },
    'Creating new task'
  );

  try {
    // Handle idempotency if key is provided
    if (idempotencyKey) {
      // Validate idempotency key format
      if (!idempotencyService.validateKey(idempotencyKey)) {
        sendErrorResponse(req, res, 'Invalid Idempotency-Key', 400, {
          message:
            'Idempotency key must be alphanumeric with hyphens/underscores only',
        });
        return;
      }

      // Check for existing idempotency key
      const idempotencyResult =
        await idempotencyService.checkIdempotency(idempotencyKey);

      if (idempotencyResult.isDuplicate && idempotencyResult.existingRun) {
        logger.info(
          {
            idempotencyKey,
            existingRunId: idempotencyResult.existingRunId,
          },
          'Returning existing run due to idempotency key'
        );

        // Return the existing run
        res.status(200).json({
          runId: idempotencyResult.existingRun.id,
          status: idempotencyResult.existingRun.status,
          agent: idempotencyResult.existingRun.agent,
          input: idempotencyResult.existingRun.input,
          output: idempotencyResult.existingRun.output,
          artifacts: [], // TODO: Add artifacts support
          createdAt: idempotencyResult.existingRun.createdAt.toISOString(),
        });
        return;
      }
    }

    // Convert input string to AgentRunInput format for Jarvis
    const agentRunInput = {
      prompt: input,
      data: options?.metadata || {},
      context: {},
      options: options || {},
    };

    // Convert agent string to AgentKind enum if provided
    let agentKind: AgentKind | undefined;
    if (agent) {
      agentKind = agent as AgentKind;
    }

    // Create the run using Jarvis orchestrator
    const result = await jarvis.handleCreateRun({
      userId,
      input: agentRunInput,
      agent: agentKind,
      options: {
        timeout: options?.timeout,
        priority: options?.priority,
        tags: options?.tags,
        metadata: options?.metadata,
      },
    });

    // Store idempotency key if provided
    if (idempotencyKey) {
      await idempotencyService.storeIdempotency(idempotencyKey, result.runId);
    }

    logger.info(
      {
        runId: result.runId,
        status: result.status,
        agent: agentKind || 'auto-selected',
      },
      'Task created successfully'
    );

    // Record metrics
    recordTaskCreation(agentKind || 'auto', result.status);

    // Create sanitized response
    const responseData = createSanitizedResponse(taskResponseSchema, {
      runId: result.runId,
      status: result.status,
      agent: agentKind || 'auto',
      input: input,
      output:
        (result.output?.result as string) ||
        result.output?.toString() ||
        undefined,
      artifacts: [], // TODO: Add artifacts support
      createdAt: new Date().toISOString(),
    });

    // Return the sanitized response
    res.status(201).json(responseData);
  } catch (error) {
    logger.error({ error, agent, input, userId }, 'Failed to create task');

    // Record failed task creation
    recordTaskCreation(agent || 'unknown', 'FAILED');

    throw error; // Let the error middleware handle it
  }
};

/**
 * Get run details by ID with RBAC enforcement
 * GET /v1/runs/:id
 */
export const getRunDetails = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { id: runId } = req.params as { id: string };
  const userId = getCurrentUserId(req);

  if (!userId) {
    sendErrorResponse(req, res, 'Authentication required', 401, {
      message: 'User must be authenticated to access runs',
    });
    return;
  }

  logger.info({ runId, userId }, 'Getting run details');

  try {
    // Get run from Jarvis orchestrator with RBAC enforcement
    const run = await jarvis.getRun(runId, userId);

    if (!run) {
      sendErrorResponse(req, res, 'Run not found', 404, {
        message: `Run with ID ${runId} not found`,
      });
      return;
    }

    // Get nodes for this run
    const nodes = run.nodes || [];

    // TODO: Get artifacts for this run
    const artifacts: Array<{
      id?: string;
      name?: string;
      type?: string;
      url?: string;
      size?: number;
      createdAt?: string;
    }> = [];

    // Create response
    const responseData = {
      run: {
        id: run.id,
        agentId: run.agentId,
        status: run.status,
        input: run.input,
        output: run.output,
        error: run.error,
        metadata: run.metadata,
        startedAt: run.startedAt.toISOString(),
        completedAt: run.completedAt?.toISOString(),
        duration: run.duration,
      },
      nodes: nodes.map(node => ({
        id: node.id,
        name: node.name,
        type: node.type,
        status: node.status,
        input: node.input,
        output: node.output,
        error: node.error,
        startedAt: node.startedAt.toISOString(),
        completedAt: node.completedAt?.toISOString(),
        duration: node.duration,
        attempts: node.attempts,
        maxAttempts: node.maxAttempts,
      })),
      artifacts,
    };

    res.status(200).json(responseData);
  } catch (error) {
    logger.error({ error, runId, userId }, 'Failed to get run details');

    if (error instanceof Error && error.message.includes('Access denied')) {
      sendErrorResponse(req, res, 'Access denied', 403, {
        message: error.message,
      });
      return;
    }

    throw error; // Let the error middleware handle it
  }
};

/**
 * Get audit logs for a run with RBAC enforcement
 * GET /v1/runs/:id/logs
 */
export const getRunAuditLogs = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const { id: runId } = req.params as { id: string };
  const { cursor, limit = 50 } = req.query as {
    cursor?: string;
    limit?: number;
  };
  const userId = getCurrentUserId(req);

  if (!userId) {
    sendErrorResponse(req, res, 'Authentication required', 401, {
      message: 'User must be authenticated to access audit logs',
    });
    return;
  }

  logger.info({ runId, userId, cursor, limit }, 'Getting audit logs for run');

  try {
    // First, verify the run exists and user has access
    const run = await jarvis.getRun(runId, userId);

    if (!run) {
      sendErrorResponse(req, res, 'Run not found', 404, {
        message: `Run with ID ${runId} not found`,
      });
      return;
    }

    // Import audit service dynamically to avoid circular dependencies
    const { getAuditLogs, getAuditStats } = await import(
      '../services/audit.js'
    );

    // Get audit logs with cursor-based pagination
    const auditResult = await getAuditLogs(runId, cursor, limit);

    // Get audit statistics
    const stats = await getAuditStats(runId);

    // Transform logs for response
    const transformedLogs = auditResult.logs.map(log => ({
      id: log.id,
      runId: log.runId,
      nodeId: log.nodeId,
      userId: log.userId,
      action: log.action,
      status: log.status,
      durationMs: log.durationMs,
      payload: log.payload,
      result: log.result,
      createdAt: log.createdAt.toISOString(),
    }));

    const responseData = {
      logs: transformedLogs,
      stats,
      pagination: {
        nextCursor: auditResult.nextCursor,
        hasMore: auditResult.hasMore,
      },
    };

    logger.info(
      {
        runId,
        logCount: transformedLogs.length,
        hasMore: auditResult.hasMore,
        hasNextCursor: !!auditResult.nextCursor,
      },
      'Successfully retrieved audit logs for run'
    );

    res.status(200).json(responseData);
  } catch (error) {
    logger.error(
      { error, runId, userId, cursor, limit },
      'Failed to get audit logs for run'
    );

    if (error instanceof Error && error.message.includes('Access denied')) {
      sendErrorResponse(req, res, 'Access denied', 403, {
        message: error.message,
      });
      return;
    }

    throw error; // Let the error middleware handle it
  }
};
