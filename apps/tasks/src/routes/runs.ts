import { Router } from 'express';
import { authenticateToken, requireUser } from '../security/auth.js';
import { 
  createRun, 
  getRun, 
  listRuns, 
  getSupportedAgents, 
  getRunLimits 
} from '../controllers/runController.js';

// =============================================================================
// ROUTER SETUP
// =============================================================================

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(requireUser);

// =============================================================================
// ROUTES
// =============================================================================

/**
 * POST /v1/runs
 * Create a new agent run
 */
router.post('/', createRun);

/**
 * GET /v1/runs
 * List runs with optional filtering
 */
router.get('/', listRuns);

/**
 * GET /v1/runs/:runId
 * Get a specific run by ID
 */
router.get('/:runId', getRun);

/**
 * GET /v1/runs/agents/supported
 * Get list of supported agents
 */
router.get('/agents/supported', getSupportedAgents);

/**
 * GET /v1/runs/limits
 * Get run limits configuration
 */
router.get('/limits', getRunLimits);

// =============================================================================
// EXPORT
// =============================================================================

export default router;
