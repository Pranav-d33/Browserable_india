import { Router } from 'express';

import { env } from '../env.js';
import { browserService } from '../services/browserService.js';

const router = Router();

// =============================================================================
// Health Check Endpoint
// =============================================================================

/**
 * GET /health
 * Basic health check endpoint
 */
router.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
    service: env.SERVICE_NAME,
    version: env.SERVICE_VERSION,
  };

  res.status(200).json(health);
});

// =============================================================================
// Readiness Check Endpoint
// =============================================================================

/**
 * GET /ready
 * Readiness check endpoint that verifies dependencies
 */
router.get('/ready', async (req, res) => {
  try {
    // Check if browser service is operational
    const sessions = await browserService.listSessions();

    const readiness = {
      status: 'ready',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: env.NODE_ENV,
      service: env.SERVICE_NAME,
      version: env.SERVICE_VERSION,
      dependencies: {
        browserService: 'operational',
        activeSessions: sessions.length,
        maxConcurrent: env.BROWSER_MAX_CONCURRENT,
      },
      configuration: {
        allowEvaluate: env.ALLOW_EVALUATE,
        blockPrivateAddr: env.BLOCK_PRIVATE_ADDR,
        allowLocalhost: env.ALLOW_LOCALHOST,
        allowDownloads: env.ALLOW_DOWNLOADS,
        sessionTimeout: env.SESSION_IDLE_MS,
        navigationTimeout: env.MAX_NAVIGATION_TIMEOUT_MS,
      },
    };

    res.status(200).json(readiness);
  } catch (error) {
    const readiness = {
      status: 'not ready',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: env.NODE_ENV,
      service: env.SERVICE_NAME,
      version: env.SERVICE_VERSION,
      error: error instanceof Error ? error.message : 'Unknown error',
      dependencies: {
        browserService: 'error',
      },
    };

    res.status(503).json(readiness);
  }
});

// =============================================================================
// Detailed Health Check Endpoint
// =============================================================================

/**
 * GET /health/detailed
 * Detailed health check with more information
 */
router.get('/health/detailed', async (req, res) => {
  try {
    const sessions = await browserService.listSessions();
    const memoryUsage = process.memoryUsage();

    const detailedHealth = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: env.NODE_ENV,
      service: env.SERVICE_NAME,
      version: env.SERVICE_VERSION,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        memory: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external,
        },
      },
      browser: {
        activeSessions: sessions.length,
        maxConcurrent: env.BROWSER_MAX_CONCURRENT,
        sessionTimeout: env.SESSION_IDLE_MS,
        navigationTimeout: env.MAX_NAVIGATION_TIMEOUT_MS,
      },
      security: {
        allowEvaluate: env.ALLOW_EVALUATE,
        blockPrivateAddr: env.BLOCK_PRIVATE_ADDR,
        allowLocalhost: env.ALLOW_LOCALHOST,
        allowDownloads: env.ALLOW_DOWNLOADS,
      },
      rateLimiting: {
        windowMs: env.RATE_LIMIT_WINDOW_MS,
        maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
      },
    };

    res.status(200).json(detailedHealth);
  } catch (error) {
    const detailedHealth = {
      status: 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: env.NODE_ENV,
      service: env.SERVICE_NAME,
      version: env.SERVICE_VERSION,
      error: error instanceof Error ? error.message : 'Unknown error',
    };

    res.status(500).json(detailedHealth);
  }
});

export { router as healthRouter };
