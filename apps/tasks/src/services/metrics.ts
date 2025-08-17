import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { logger } from '@bharat-agents/shared';

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({
  register,
  prefix: 'tasks_service_',
});

// HTTP request metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// Task metrics
export const taskCreationTotal = new Counter({
  name: 'task_creation_total',
  help: 'Total number of tasks created',
  labelNames: ['agent', 'status'],
  registers: [register],
});

export const taskExecutionDuration = new Histogram({
  name: 'task_execution_duration_seconds',
  help: 'Duration of task execution in seconds',
  labelNames: ['agent'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

// Database metrics
export const databaseQueryDuration = new Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

export const databaseConnectionsActive = new Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections',
  registers: [register],
});

// Redis metrics
export const redisOperationsTotal = new Counter({
  name: 'redis_operations_total',
  help: 'Total number of Redis operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

export const redisOperationDuration = new Histogram({
  name: 'redis_operation_duration_seconds',
  help: 'Duration of Redis operations in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

// Idempotency metrics
export const idempotencyKeyTotal = new Counter({
  name: 'idempotency_key_total',
  help: 'Total number of idempotency key operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

// Queue metrics
export const queueJobTotal = new Counter({
  name: 'queue_job_total',
  help: 'Total number of queue jobs',
  labelNames: ['queue', 'status'],
  registers: [register],
});

export const queueJobDuration = new Histogram({
  name: 'queue_job_duration_seconds',
  help: 'Duration of queue job processing in seconds',
  labelNames: ['queue'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

// Agent run metrics
export const agentRunsTotal = new Counter({
  name: 'agent_runs_total',
  help: 'Total number of agent runs',
  labelNames: ['agent', 'status'],
  registers: [register],
});

export const agentRunDuration = new Histogram({
  name: 'agent_run_duration_seconds',
  help: 'Duration of agent runs in seconds',
  labelNames: ['agent'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
  registers: [register],
});

export const agentNodeDuration = new Histogram({
  name: 'agent_node_duration_seconds',
  help: 'Duration of agent node executions in seconds',
  labelNames: ['agent', 'node_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

/**
 * Get metrics as string
 */
export const getMetrics = async (): Promise<string> => {
  try {
    return await register.metrics();
  } catch (error) {
    logger.error({ error }, 'Failed to generate metrics');
    throw error;
  }
};

/**
 * Reset all metrics (useful for testing)
 */
export const resetMetrics = (): void => {
  register.clear();
  logger.info('Metrics reset');
};

/**
 * Record HTTP request metrics
 */
export const recordHttpRequest = (
  method: string,
  route: string,
  statusCode: number,
  duration: number
): void => {
  const labels = { method, route, status_code: statusCode.toString() };
  
  httpRequestDuration.observe(labels, duration / 1000); // Convert to seconds
  httpRequestTotal.inc(labels);
};

/**
 * Record task creation metrics
 */
export const recordTaskCreation = (agent: string, status: string): void => {
  taskCreationTotal.inc({ agent, status });
};

/**
 * Record task execution duration
 */
export const recordTaskExecution = (agent: string, duration: number): void => {
  taskExecutionDuration.observe({ agent }, duration / 1000); // Convert to seconds
};

/**
 * Record database operation metrics
 */
export const recordDatabaseOperation = (operation: string, duration: number): void => {
  databaseQueryDuration.observe({ operation }, duration / 1000); // Convert to seconds
};

/**
 * Record Redis operation metrics
 */
export const recordRedisOperation = (operation: string, duration: number, status: string): void => {
  const labels = { operation, status };
  
  redisOperationDuration.observe({ operation }, duration / 1000); // Convert to seconds
  redisOperationsTotal.inc(labels);
};

/**
 * Record idempotency key operation
 */
export const recordIdempotencyOperation = (operation: string, status: string): void => {
  idempotencyKeyTotal.inc({ operation, status });
};

/**
 * Record queue job metrics
 */
export const recordQueueJob = (queue: string, status: string, duration?: number): void => {
  const labels = { queue, status };
  
  queueJobTotal.inc(labels);
  
  if (duration !== undefined) {
    queueJobDuration.observe({ queue }, duration / 1000); // Convert to seconds
  }
};

/**
 * Record agent run metrics
 */
export const recordAgentRun = (agent: string, status: string, duration?: number): void => {
  const labels = { agent, status };
  
  agentRunsTotal.inc(labels);
  
  if (duration !== undefined) {
    agentRunDuration.observe({ agent }, duration / 1000); // Convert to seconds
  }
};

/**
 * Record agent node execution metrics
 */
export const recordAgentNode = (agent: string, nodeType: string, duration: number): void => {
  agentNodeDuration.observe({ agent, node_type: nodeType }, duration / 1000); // Convert to seconds
};
