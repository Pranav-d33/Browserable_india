import type { Response } from 'express';
import { jarvis } from '../orchestrator/jarvis.js';
import { AgentKind } from '@bharat-agents/shared';
import { logger } from '@bharat-agents/shared';
import { getCurrentUserId } from '../security/auth.js';
import { AuthenticatedRequest } from '../security/auth.js';
import { userRateLimitService } from '../services/rateLimit.js';

// =============================================================================
// TYPES
// =============================================================================

interface CreateRunRequestBody {
  input: {
    prompt?: string;
    data?: Record<string, unknown>;
    context?: Record<string, unknown>;
    options?: Record<string, unknown>;
  };
  agent?: 'ECHO' | 'BROWSER' | 'GEN';
  options?: {
    timeout?: number;
    priority?: 'low' | 'normal' | 'high';
    tags?: string[];
    metadata?: Record<string, unknown>;
  };
}

// =============================================================================
// CONTROLLER METHODS
// =============================================================================

/**
 * Create a new agent run
 */
export async function createRun(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User must be authenticated to create runs',
      });
      return;
    }

    const body = req.body as CreateRunRequestBody;

    // Validate required fields
    if (!body.input) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'Input is required',
      });
      return;
    }

    // Convert agent string to enum if provided
    let agentKind: AgentKind | undefined;
    if (body.agent) {
      if (!Object.values(AgentKind).includes(body.agent as AgentKind)) {
        res.status(400).json({
          error: 'Invalid agent',
          message: `Agent must be one of: ${Object.values(AgentKind).join(', ')}`,
        });
        return;
      }
      agentKind = body.agent as AgentKind;
    }

    logger.info('Creating agent run', {
      userId,
      agentKind,
      hasPrompt: !!body.input.prompt,
      asyncJobs: process.env.ASYNC_JOBS === 'true',
    });

    // Track run start for concurrent limit
    await userRateLimitService.trackRunStart(userId, 'pending'); // We'll update this with actual runId

    // Create the run using Jarvis orchestrator
    const result = await jarvis.handleCreateRun({
      userId,
      input: body.input,
      agent: agentKind,
      options: body.options,
    });

    // Update tracking with actual runId
    if (result.runId) {
      await userRateLimitService.trackRunEnd(userId, 'pending');
      await userRateLimitService.trackRunStart(userId, result.runId);
    }

    // Return appropriate response based on execution mode
    if (result.status === 'pending') {
      res.status(202).json({
        message: 'Run queued for execution',
        runId: result.runId,
        status: result.status,
      });
    } else {
      res.status(200).json({
        message: 'Run completed',
        runId: result.runId,
        status: result.status,
        output: result.output,
        error: result.error,
      });
    }
  } catch (error) {
    logger.error('Error creating run:', error);

    res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}

/**
 * Get a run by ID with RBAC enforcement
 */
export async function getRun(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User must be authenticated to access runs',
      });
      return;
    }

    const { runId } = req.params;

    logger.info('Getting run', { runId, userId });

    const run = await jarvis.getRun(runId, userId);

    if (!run) {
      res.status(404).json({
        error: 'Run not found',
        message: `Run with ID ${runId} not found`,
      });
      return;
    }

    res.status(200).json({
      run,
    });
  } catch (error) {
    logger.error('Error getting run:', error);

    if (error instanceof Error && error.message.includes('Access denied')) {
      res.status(403).json({
        error: 'Access denied',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}

/**
 * List runs with RBAC enforcement and pagination
 */
export async function listRuns(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User must be authenticated to list runs',
      });
      return;
    }

    // Pagination parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 20)
    );
    const offset = (page - 1) * limit;
    const agentId = req.query.agent as string;
    const cursor = req.query.cursor as string;

    logger.info('Listing runs', {
      userId,
      page,
      limit,
      offset,
      agentId,
      hasCursor: !!cursor,
    });

    let runs;
    let totalCount;
    let nextCursor;

    if (agentId) {
      const result = await jarvis.listRunsByAgent(
        agentId,
        limit,
        userId,
        cursor
      );
      runs = result.runs;
      totalCount = result.totalCount;
      nextCursor = result.nextCursor;
    } else {
      const result = await jarvis.listRuns(limit, userId, cursor);
      runs = result.runs;
      totalCount = result.totalCount;
      nextCursor = result.nextCursor;
    }

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      runs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextCursor,
      },
    });
  } catch (error) {
    logger.error('Error listing runs:', error);

    res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}

/**
 * Get supported agents
 */
export async function getSupportedAgents(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const agents = jarvis.getSupportedAgents();

    res.status(200).json({
      agents: agents.map(agent => ({
        kind: agent,
        name: `${agent} Agent`,
        description: `Agent for ${agent.toLowerCase()} operations`,
      })),
    });
  } catch (error) {
    logger.error('Error getting supported agents:', error);

    res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}

/**
 * Get run limits configuration
 */
export async function getRunLimits(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const limits = jarvis.getRunLimits();

    res.status(200).json({
      limits,
    });
  } catch (error) {
    logger.error('Error getting run limits:', error);

    res.status(500).json({
      error: 'Internal server error',
      message:
        error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}
