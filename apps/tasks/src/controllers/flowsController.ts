import type { Response } from 'express';
import { logger, AgentKind } from '@bharat-agents/shared';
import { jarvis } from '../orchestrator/jarvis.js';
import { idempotencyService } from '../services/idempotency.js';
import { recordTaskCreation } from '../services/metrics.js';
import { sendErrorResponse } from '../utils/errorResponse.js';
import { getCurrentUserId } from '../security/auth.js';
import { AuthenticatedRequest } from '../security/auth.js';
import {
  priceMonitorFlow,
  PriceMonitorInput,
  priceMonitorSteps,
} from '../flows/priceMonitor.js';
import {
  formAutofillFlow,
  FormAutofillInput,
  generateFormAutofillSteps,
} from '../flows/formAutofill.js';

// =============================================================================
// Price Monitor Flow
// =============================================================================

/**
 * Execute price monitoring flow
 * POST /v1/flows/price-monitor
 */
export const executePriceMonitor = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const input = req.body as PriceMonitorInput;
  const idempotencyKey = req.headers['idempotency-key'] as string;
  const userId = getCurrentUserId(req);

  if (!userId) {
    sendErrorResponse(req, res, 'Authentication required', 401, {
      message: 'User must be authenticated to execute flows',
    });
    return;
  }

  logger.info(
    {
      userId,
      productUrl: input.productUrl,
      selector: input.selector,
      hasIdempotencyKey: !!idempotencyKey,
    },
    'Executing price monitor flow'
  );

  try {
    // Handle idempotency if key is provided
    if (idempotencyKey) {
      if (!idempotencyService.validateKey(idempotencyKey)) {
        sendErrorResponse(req, res, 'Invalid Idempotency-Key', 400, {
          message:
            'Idempotency key must be alphanumeric with hyphens/underscores only',
        });
        return;
      }

      const idempotencyResult =
        await idempotencyService.checkIdempotency(idempotencyKey);

      if (idempotencyResult.isDuplicate && idempotencyResult.existingRun) {
        logger.info(
          {
            idempotencyKey,
            existingRunId: idempotencyResult.existingRunId,
          },
          'Returning existing price monitor run due to idempotency key'
        );

        res.status(200).json({
          runId: idempotencyResult.existingRun.id,
          status: idempotencyResult.existingRun.status,
          agent: 'BROWSER',
          input: input,
          output: idempotencyResult.existingRun.output,
          artifacts: idempotencyResult.existingRun.artifacts || [],
          createdAt: idempotencyResult.existingRun.createdAt.toISOString(),
        });
        return;
      }
    }

    // Convert input to AgentRunInput format
    const agentRunInput = {
      prompt: `Monitor price for product at ${input.productUrl} using selector ${input.selector}`,
      data: input,
      context: {
        flowType: 'price_monitor',
        productUrl: input.productUrl,
        selector: input.selector,
      },
      options: {
        flow: priceMonitorFlow,
        steps: priceMonitorSteps,
      },
    };

    // Create the run using Jarvis orchestrator
    const result = await jarvis.handleCreateRun({
      userId,
      input: agentRunInput,
      agent: AgentKind.BROWSER,
      options: {
        priority: 'normal',
        tags: ['flow', 'price-monitor'],
        metadata: {
          flowType: 'price_monitor',
          productUrl: input.productUrl,
          selector: input.selector,
        },
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
        productUrl: input.productUrl,
      },
      'Price monitor flow created successfully'
    );

    // Record metrics
    recordTaskCreation('BROWSER', result.status);

    // Return response
    res.status(201).json({
      runId: result.runId,
      status: result.status,
      agent: 'BROWSER',
      input: input,
      output: result.output?.result || null,
      artifacts: result.output?.artifacts || [],
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      { error, input, userId },
      'Failed to execute price monitor flow'
    );

    // Record failed task creation
    recordTaskCreation('BROWSER', 'FAILED');

    throw error; // Let the error middleware handle it
  }
};

// =============================================================================
// Form Autofill Flow
// =============================================================================

/**
 * Execute form autofill flow
 * POST /v1/flows/form-autofill
 */
export const executeFormAutofill = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const input = req.body as FormAutofillInput;
  const idempotencyKey = req.headers['idempotency-key'] as string;
  const userId = getCurrentUserId(req);

  if (!userId) {
    sendErrorResponse(req, res, 'Authentication required', 401, {
      message: 'User must be authenticated to execute flows',
    });
    return;
  }

  logger.info(
    {
      userId,
      url: input.url,
      fieldsCount: input.fields.length,
      hasSubmitSelector: !!input.submitSelector,
      hasIdempotencyKey: !!idempotencyKey,
    },
    'Executing form autofill flow'
  );

  try {
    // Handle idempotency if key is provided
    if (idempotencyKey) {
      if (!idempotencyService.validateKey(idempotencyKey)) {
        sendErrorResponse(req, res, 'Invalid Idempotency-Key', 400, {
          message:
            'Idempotency key must be alphanumeric with hyphens/underscores only',
        });
        return;
      }

      const idempotencyResult =
        await idempotencyService.checkIdempotency(idempotencyKey);

      if (idempotencyResult.isDuplicate && idempotencyResult.existingRun) {
        logger.info(
          {
            idempotencyKey,
            existingRunId: idempotencyResult.existingRunId,
          },
          'Returning existing form autofill run due to idempotency key'
        );

        res.status(200).json({
          runId: idempotencyResult.existingRun.id,
          status: idempotencyResult.existingRun.status,
          agent: 'BROWSER',
          input: input,
          output: idempotencyResult.existingRun.output,
          artifacts: idempotencyResult.existingRun.artifacts || [],
          createdAt: idempotencyResult.existingRun.createdAt.toISOString(),
        });
        return;
      }
    }

    // Generate steps for this specific form
    const steps = generateFormAutofillSteps(input);

    // Convert input to AgentRunInput format
    const agentRunInput = {
      prompt: `Fill form at ${input.url} with ${input.fields.length} fields${input.submitSelector ? ' and submit' : ''}`,
      data: input,
      context: {
        flowType: 'form_autofill',
        url: input.url,
        fieldsCount: input.fields.length,
        hasSubmit: !!input.submitSelector,
      },
      options: {
        flow: formAutofillFlow,
        steps: steps,
      },
    };

    // Create the run using Jarvis orchestrator
    const result = await jarvis.handleCreateRun({
      userId,
      input: agentRunInput,
      agent: AgentKind.BROWSER,
      options: {
        priority: 'normal',
        tags: ['flow', 'form-autofill'],
        metadata: {
          flowType: 'form_autofill',
          url: input.url,
          fieldsCount: input.fields.length,
          hasSubmit: !!input.submitSelector,
        },
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
        url: input.url,
        fieldsCount: input.fields.length,
      },
      'Form autofill flow created successfully'
    );

    // Record metrics
    recordTaskCreation('BROWSER', result.status);

    // Return response
    res.status(201).json({
      runId: result.runId,
      status: result.status,
      agent: 'BROWSER',
      input: input,
      output: result.output?.result || null,
      artifacts: result.output?.artifacts || [],
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      { error, input, userId },
      'Failed to execute form autofill flow'
    );

    // Record failed task creation
    recordTaskCreation('BROWSER', 'FAILED');

    throw error; // Let the error middleware handle it
  }
};
