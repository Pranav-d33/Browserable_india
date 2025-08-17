import {
  startTelemetry,
  shutdownTelemetry,
  logger,
  createErrorMiddleware,
  asyncHandler,
} from '@bharat-agents/shared';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import hpp from 'hpp';
import pinoHttp from 'pino-http';

import { register, Counter, Gauge } from 'prom-client';

import { BrowserActions } from './actions';
import { env } from './env';
import { healthRouter } from './routes/health.js';
import { SessionManager } from './session';

// Metrics
const browserSessionsActive = new Gauge({
  name: 'browser_sessions_active',
  help: 'Number of active browser sessions',
});

const browserSessionsCreatedTotal = new Counter({
  name: 'browser_sessions_created_total',
  help: 'Total number of browser sessions created',
});

const browserActionsTotal = new Counter({
  name: 'browser_actions_total',
  help: 'Total number of browser actions executed',
  labelNames: ['action'] as const,
});

// Initialize session manager and actions
const sessionManager = new SessionManager(
  env.BROWSER_MAX_CONCURRENT,
  env.SESSION_STORE_TYPE
);
const browserActions = new BrowserActions(
  sessionManager,
  env.MAX_NAVIGATION_TIMEOUT_MS,
  env.ALLOW_EVALUATE,
  {
    BLOCK_PRIVATE_ADDR: env.BLOCK_PRIVATE_ADDR,
    ALLOW_LOCALHOST: env.ALLOW_LOCALHOST,
    ALLOW_DOWNLOADS: env.ALLOW_DOWNLOADS,
  }
);

// Create Express app
const app = express();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  })
);

// CORS with strict origin
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Request parsing and security
app.use(hpp());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(
  pinoHttp({
    logger,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
      ],
      remove: true,
    },
  })
);

// Rate limiting with separate buckets
const sessionRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: { error: 'Too many session requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

const actionRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS * 2, // Allow more action requests
  message: { error: 'Too many action requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Session routes
app.post(
  '/v1/session/create',
  sessionRateLimit,
  asyncHandler(async (req, res) => {
    const { browserType = 'chromium', userAgent, proxy } = req.body;

    try {
      const sessionId = await sessionManager.create({
        browserType,
        userAgent,
        proxy,
      });

      browserSessionsCreatedTotal.inc();
      browserSessionsActive.set(sessionManager.getActiveCount());

      res.json({ sessionId });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'Maximum concurrent sessions reached'
      ) {
        res.status(429).json({
          error: 'Too many concurrent sessions',
          retryAfter: Math.ceil(env.SESSION_IDLE_MS / 1000),
        });
        res.set(
          'Retry-After',
          Math.ceil(env.SESSION_IDLE_MS / 1000).toString()
        );
      } else {
        throw error;
      }
    }
  })
);

app.post(
  '/v1/session/close',
  sessionRateLimit,
  asyncHandler(async (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }

    const closed = await sessionManager.close(sessionId);
    if (closed) {
      browserSessionsActive.set(sessionManager.getActiveCount());
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  })
);

app.get('/v1/session/list', sessionRateLimit, (req, res) => {
  const sessions = sessionManager.list().map(session => ({
    id: session.id,
    browserType: session.browserType,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    tags: session.tags,
  }));

  res.json({ sessions });
});

// Action routes
app.post(
  '/v1/action/goto',
  actionRateLimit,
  asyncHandler(async (req, res) => {
    await browserActions.goto(req.body);
    browserActionsTotal.inc({ action: 'goto' });
    res.json({ success: true });
  })
);

app.post(
  '/v1/action/click',
  actionRateLimit,
  asyncHandler(async (req, res) => {
    await browserActions.click(req.body);
    browserActionsTotal.inc({ action: 'click' });
    res.json({ success: true });
  })
);

app.post(
  '/v1/action/type',
  actionRateLimit,
  asyncHandler(async (req, res) => {
    await browserActions.type(req.body);
    browserActionsTotal.inc({ action: 'type' });
    res.json({ success: true });
  })
);

app.post(
  '/v1/action/waitFor',
  actionRateLimit,
  asyncHandler(async (req, res) => {
    await browserActions.waitFor(req.body);
    browserActionsTotal.inc({ action: 'waitFor' });
    res.json({ success: true });
  })
);

app.post(
  '/v1/action/select',
  actionRateLimit,
  asyncHandler(async (req, res) => {
    await browserActions.select(req.body);
    browserActionsTotal.inc({ action: 'select' });
    res.json({ success: true });
  })
);

app.post(
  '/v1/action/evaluate',
  actionRateLimit,
  asyncHandler(async (req, res) => {
    const result = await browserActions.evaluate(req.body);
    browserActionsTotal.inc({ action: 'evaluate' });
    res.json({ result });
  })
);

app.post(
  '/v1/action/screenshot',
  actionRateLimit,
  asyncHandler(async (req, res) => {
    const screenshot = await browserActions.screenshot(req.body);
    browserActionsTotal.inc({ action: 'screenshot' });

    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', 'attachment; filename="screenshot.png"');
    res.send(screenshot);
  })
);

app.post(
  '/v1/action/pdf',
  actionRateLimit,
  asyncHandler(async (req, res) => {
    const pdf = await browserActions.pdf(req.body);
    browserActionsTotal.inc({ action: 'pdf' });

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'attachment; filename="page.pdf"');
    res.send(pdf);
  })
);

// Health and readiness endpoints
app.use('/', healthRouter);

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    const metrics = await register.metrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch {
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
});

// Error handling middleware
app.use(createErrorMiddleware());

// Idle session reaper
const idleReaper = setInterval(async () => {
  try {
    const closedCount = await sessionManager.closeIdle(env.SESSION_IDLE_MS);
    if (closedCount > 0) {
      browserSessionsActive.set(sessionManager.getActiveCount());
    }
  } catch (error) {
    logger.error('Error in idle session reaper', { error });
  }
}, env.SESSION_IDLE_MS);

// Graceful shutdown
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`Received ${signal}, starting graceful shutdown`);

  clearInterval(idleReaper);

  try {
    await sessionManager.closeAll();
    await shutdownTelemetry();
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error });
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start the server
const startServer = async (): Promise<void> => {
  try {
    // Start telemetry
    await startTelemetry();

    // Start server
    app.listen(env.PORT, () => {
      logger.info('Browser service started', {
        port: env.PORT,
        environment: env.NODE_ENV,
        maxConcurrent: env.BROWSER_MAX_CONCURRENT,
        sessionIdleMs: env.SESSION_IDLE_MS,
        allowEvaluate: env.ALLOW_EVALUATE,
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

// Start the application
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
