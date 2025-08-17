import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';

import { env, logger, asyncHandler } from '@bharat-agents/shared';

// Import routes
import { tasksRouter } from './routes/tasks.js';
import { flowsRouter } from './routes/flows.js';
import runsRouter from './routes/runs.js';

// Import services
import { DatabaseAdapterFactory } from './db/adapter.js';
import { StorageServiceFactory } from './services/storage.js';
import { cleanupService } from './services/cleanup.js';
import { checkRedisHealth, closeRedisConnection } from './services/redis.js';
import { getMetrics } from './services/metrics.js';

// Import middleware
import { requestIdMiddleware } from './middleware/requestId.js';

// Import utilities
import { sendErrorResponse } from './utils/errorResponse.js';

// Import security middleware
import { 
  securityMiddleware, 
  inputSanitizationMiddleware, 
  rateLimitErrorHandler,
  requestSizeValidation 
} from './middleware/security.js';

// Create Express app
const app: express.Application = express();

// =============================================================================
// Security Middleware
// =============================================================================

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-origin" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: "deny" },
  hidePoweredBy: true,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  ieNoOpen: true,
  noSniff: true,
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
}));

// CORS configuration with environment-specific rules
const isDev = env.NODE_ENV === 'development';
const corsOrigins = env.CORS_ORIGIN 
  ? env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : isDev ? ['http://localhost:3000'] : [];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // In production, require origin
    if (!isDev && !origin) {
      logger.warn('CORS blocked request with no origin in production');
      return callback(new Error('Origin required in production'));
    }
    
    // In development, allow requests with no origin
    if (isDev && !origin) {
      return callback(null, true);
    }
    
    // Check if origin is allowed
    if (origin && corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn({ origin, allowedOrigins: corsOrigins, environment: env.NODE_ENV }, 'CORS blocked request from unauthorized origin');
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID', 'X-Trace-ID', 'Idempotency-Key'],
  exposedHeaders: ['X-Request-ID', 'X-Trace-ID'],
};

// Only apply CORS if enabled or in development
if (isDev || env.ENABLE_CORS) {
  app.use(cors(corsOptions));
  logger.info({ corsOrigins, environment: env.NODE_ENV }, 'CORS enabled');
} else {
  logger.info('CORS disabled in production');
}

// HTTP Parameter Pollution protection
app.use(hpp());

// Compression
app.use(compression());

// =============================================================================
// Rate Limiting
// =============================================================================

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: env.RATE_LIMIT_MAX ? parseInt(env.RATE_LIMIT_MAX) : 60, // limit each IP to 60 requests per minute in dev
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  keyGenerator: (req) => {
    // Use X-Forwarded-For header if available (for proxy setups)
    return req.headers['x-forwarded-for'] as string || req.ip || req.connection.remoteAddress || 'unknown';
  },
});

app.use(limiter);

// Add rate limit error handler
app.use(rateLimitErrorHandler);

// =============================================================================
// Body Parsing
// =============================================================================

// Body size limit: 1MB
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// =============================================================================
// Security Middleware
// =============================================================================

app.use(securityMiddleware);
app.use(inputSanitizationMiddleware);
app.use(requestSizeValidation);

// =============================================================================
// Request ID Middleware
// =============================================================================

app.use(requestIdMiddleware);

// =============================================================================
// Request Logging Middleware (pino-http)
// =============================================================================

app.use(pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] as string,
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return 'warn';
    }
    if (res.statusCode >= 500 || err) {
      return 'error';
    }
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} - ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} - ${res.statusCode} - ${err?.message || 'Unknown error'}`;
  },
      serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        headers: req.headers,
        remoteAddress: req.remoteAddress,
        remotePort: req.remotePort,
      }),
      res: (res) => ({
        statusCode: res.statusCode,
        headers: res.headers,
      }),
    },
}));

// =============================================================================
// Health Endpoints
// =============================================================================

// Import health check system
import { performHealthCheck, startPressureMonitoring, stopPressureMonitoring } from './services/health.js';

// App health check with pressure monitoring
app.get('/health', asyncHandler(async (req, res) => {
  const healthData = await performHealthCheck();
  
  const statusCode = healthData.status === 'healthy' ? 200 : 
                    healthData.status === 'degraded' ? 200 : 503;
  
  res.status(statusCode).json(healthData);
}));

// Readiness check (DB + Redis)
app.get('/ready', asyncHandler(async (req, res) => {
  try {
    const healthData = await performHealthCheck();
    
    const isReady = healthData.database.status === 'connected' && 
                   healthData.redis.status === 'connected';
    
    const readinessData = {
      status: isReady ? 'ready' as const : 'not ready' as const,
      timestamp: new Date().toISOString(),
      database: healthData.database.status,
      redis: healthData.redis.status,
      responseTimes: {
        database: healthData.database.responseTime,
        redis: healthData.redis.responseTime,
      },
    };
    
    res.status(isReady ? 200 : 503).json(readinessData);
  } catch (error) {
    logger.error({ error }, 'Readiness check failed');
    
    const readinessData = {
      status: 'not ready' as const,
      timestamp: new Date().toISOString(),
      database: 'disconnected' as const,
      redis: 'disconnected' as const,
    };
    
    res.status(503).json(readinessData);
  }
}));

// =============================================================================
// Metrics Endpoint
// =============================================================================

app.get('/metrics', asyncHandler(async (req, res) => {
  try {
    const metrics = await getMetrics();
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.end(metrics);
  } catch (error) {
    logger.error({ error }, 'Failed to generate metrics');
    sendErrorResponse(req, res, 'Failed to generate metrics', 500);
  }
}));

// =============================================================================
// API Routes
// =============================================================================

app.use('/v1/tasks', tasksRouter);
app.use('/v1/flows', flowsRouter);
app.use('/v1/runs', runsRouter);

// =============================================================================
// 404 Handler
// =============================================================================

app.use('*', (req, res) => {
  sendErrorResponse(req, res, 'Not Found', 404, {
    path: req.originalUrl,
    method: req.method,
  });
});

// =============================================================================
// Global Error Handler
// =============================================================================

app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({ error }, 'Unhandled error');
  
  const statusCode = error.status || 500;
  const message = error.message || 'Internal Server Error';
  
  sendErrorResponse(req, res, message, statusCode, {
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
});

// =============================================================================
// Graceful Shutdown
// =============================================================================

const gracefulShutdown = async (signal: string) => {
  logger.info({ signal }, 'Received shutdown signal');
  
  try {
    // Stop pressure monitoring
    stopPressureMonitoring();
    logger.info('Pressure monitoring stopped');
    
    // Stop cleanup scheduler
    cleanupService.stopCleanupScheduler();
    logger.info('Cleanup scheduler stopped');
    
    // Close database connection
    await DatabaseAdapterFactory.close();
    logger.info('Database connection closed');
    
    // Close Redis connection
    await closeRedisConnection();
    
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Error during graceful shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// =============================================================================
// Start Server
// =============================================================================

const PORT = env.PORT || 3001;

const server = app.listen(PORT, async () => {
  logger.info({
    port: PORT,
    environment: env.NODE_ENV,
    nodeVersion: process.version,
  }, 'Tasks service started');

  try {
    // Initialize database adapter
    await DatabaseAdapterFactory.initialize();
    
    // Initialize storage service
    await StorageServiceFactory.initialize();
    
    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize services');
    process.exit(1);
  }

  // Start cleanup scheduler
  cleanupService.startCleanupScheduler();
  
  // Start pressure monitoring (only in production)
  if (env.NODE_ENV === 'production') {
    startPressureMonitoring(30000); // Check every 30 seconds
  }
});

// Handle server errors
server.on('error', (error) => {
  logger.error({ error }, 'Server error');
  process.exit(1);
});

export default app;
