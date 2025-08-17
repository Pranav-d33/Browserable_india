import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@bharat-agents/shared';
import { validateRequest } from '../middleware/validateRequest.js';
import { executePriceMonitor, executeFormAutofill } from '../controllers/flowsController.js';
import { authenticateToken, requireRole } from '../security/auth.js';
import { 
  priceMonitorInputSchema, 
  formAutofillInputSchema 
} from '../flows/index.js';

const router = Router();

// =============================================================================
// Request Validation Schemas
// =============================================================================

const priceMonitorRequestSchema = z.object({
  body: priceMonitorInputSchema,
});

const formAutofillRequestSchema = z.object({
  body: formAutofillInputSchema,
});

// =============================================================================
// Routes
// =============================================================================

/**
 * POST /v1/flows/price-monitor
 * Execute price monitoring flow
 * Convenience route to call BrowserAgent with prebuilt steps
 */
router.post(
  '/price-monitor',
  authenticateToken,
  requireRole(['user', 'admin']),
  validateRequest(priceMonitorRequestSchema),
  asyncHandler(executePriceMonitor)
);

/**
 * POST /v1/flows/form-autofill
 * Execute form autofill flow
 * Convenience route to call BrowserAgent with prebuilt steps
 */
router.post(
  '/form-autofill',
  authenticateToken,
  requireRole(['user', 'admin']),
  validateRequest(formAutofillRequestSchema),
  asyncHandler(executeFormAutofill)
);

export { router as flowsRouter };
