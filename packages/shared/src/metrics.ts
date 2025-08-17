import { Request, Response, NextFunction } from 'express';
import { register, Counter, Histogram, Gauge } from 'prom-client';

// HTTP request metrics
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status_code', 'status_class'] as const,
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status_code', 'status_class'] as const,
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

// Agent run metrics
export const agentRunsTotal = new Counter({
  name: 'agent_runs_total',
  help: 'Total number of agent runs',
  labelNames: ['agent', 'status'] as const,
});

export const agentRunDuration = new Histogram({
  name: 'agent_run_duration_seconds',
  help: 'Agent run duration in seconds',
  labelNames: ['agent', 'status'] as const,
  buckets: [1, 5, 10, 30, 60, 120, 300, 600],
});

// LLM token metrics
export const llmTokensTotal = new Counter({
  name: 'llm_tokens_total',
  help: 'Total number of LLM tokens processed',
  labelNames: ['provider', 'model', 'type'] as const,
});

// LLM cost metrics
export const llmCostUsdTotal = new Counter({
  name: 'llm_cost_usd_total',
  help: 'Total LLM cost in USD',
  labelNames: ['provider', 'model'] as const,
});

// Active connections gauge
export const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  labelNames: ['type'] as const,
});

// Queue metrics
export const queueSize = new Gauge({
  name: 'queue_size',
  help: 'Current queue size',
  labelNames: ['queue_name'] as const,
});

export const queueProcessingDuration = new Histogram({
  name: 'queue_processing_duration_seconds',
  help: 'Queue processing duration in seconds',
  labelNames: ['queue_name', 'status'] as const,
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
});

/**
 * Express middleware to collect HTTP metrics
 */
export function observeHttp(app: any) {
  // Override the default route handler to add metrics
  const originalUse = app.use;

  app.use = function (path: string, handler: any) {
    if (typeof path === 'string' && typeof handler === 'function') {
      return originalUse.call(
        this,
        path,
        (req: Request, res: Response, next: NextFunction) => {
          const startTime = Date.now();

          // Override res.end to capture metrics
          const originalEnd = res.end;
          res.end = function (chunk?: any, encoding?: any) {
            const duration = (Date.now() - startTime) / 1000;
            const statusCode = res.statusCode;
            const statusClass = `${Math.floor(statusCode / 100)}xx`;

            // Increment request counter
            httpRequestsTotal.inc({
              method: req.method,
              path: req.route?.path || path,
              status_code: statusCode.toString(),
              status_class: statusClass,
            });

            // Observe request duration
            httpRequestDuration.observe(
              {
                method: req.method,
                path: req.route?.path || path,
                status_code: statusCode.toString(),
                status_class: statusClass,
              },
              duration
            );

            // Call original end method
            return originalEnd.call(this, chunk, encoding);
          };

          handler(req, res, next);
        }
      );
    }

    return originalUse.apply(this, arguments);
  };
}

/**
 * Helper to record agent run metrics
 */
export function recordAgentRun(
  agent: string,
  status: string,
  duration?: number
) {
  agentRunsTotal.inc({ agent, status });

  if (duration !== undefined) {
    agentRunDuration.observe({ agent, status }, duration);
  }
}

/**
 * Helper to record LLM token usage
 */
export function recordLLMTokens(
  provider: string,
  model: string,
  type: 'input' | 'output',
  count: number
) {
  llmTokensTotal.inc({ provider, model, type }, count);
}

/**
 * Helper to record LLM cost
 */
export function recordLLMCost(
  provider: string,
  model: string,
  costUsd: number
) {
  llmCostUsdTotal.inc({ provider, model }, costUsd);
}

/**
 * Helper to update active connections
 */
export function updateActiveConnections(type: string, count: number) {
  activeConnections.set({ type }, count);
}

/**
 * Helper to update queue size
 */
export function updateQueueSize(queueName: string, size: number) {
  queueSize.set({ queue_name: queueName }, size);
}

/**
 * Helper to record queue processing duration
 */
export function recordQueueProcessing(
  queueName: string,
  status: string,
  duration: number
) {
  queueProcessingDuration.observe({ queue_name: queueName, status }, duration);
}

/**
 * Get metrics as string for Prometheus scraping
 */
export async function getMetrics(): Promise<string> {
  return await register.metrics();
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
  register.clear();
}

/**
 * Initialize default metrics collection
 */
export function initializeMetrics(): void {
  // Enable default metrics (CPU, memory, etc.)
  require('prom-client').collectDefaultMetrics();
}
