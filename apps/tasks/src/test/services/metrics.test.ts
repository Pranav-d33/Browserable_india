import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  getMetrics, 
  resetMetrics, 
  recordHttpRequest, 
  recordTaskCreation,
  recordTaskExecution,
  recordDatabaseOperation,
  recordRedisOperation,
  recordIdempotencyOperation,
  recordQueueJob
} from '../../services/metrics.js';

describe('Metrics Service', () => {
  beforeEach(() => {
    // Reset metrics before each test
    resetMetrics();
  });

  afterEach(() => {
    // Reset metrics after each test
    resetMetrics();
  });

  describe('getMetrics', () => {
    it('should return metrics as string', async () => {
      const metrics = await getMetrics();
      expect(typeof metrics).toBe('string');
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should include default metrics', async () => {
      const metrics = await getMetrics();
      expect(metrics).toContain('tasks_service_');
    });
  });

  describe('recordHttpRequest', () => {
    it('should record HTTP request metrics', async () => {
      recordHttpRequest('GET', '/health', 200, 100);
      
      const metrics = await getMetrics();
      expect(metrics).toContain('http_request_duration_seconds');
      expect(metrics).toContain('http_requests_total');
    });
  });

  describe('recordTaskCreation', () => {
    it('should record task creation metrics', async () => {
      recordTaskCreation('echo', 'COMPLETED');
      
      const metrics = await getMetrics();
      expect(metrics).toContain('task_creation_total');
    });
  });

  describe('recordTaskExecution', () => {
    it('should record task execution duration', async () => {
      recordTaskExecution('echo', 500);
      
      const metrics = await getMetrics();
      expect(metrics).toContain('task_execution_duration_seconds');
    });
  });

  describe('recordDatabaseOperation', () => {
    it('should record database operation metrics', async () => {
      recordDatabaseOperation('select', 50);
      
      const metrics = await getMetrics();
      expect(metrics).toContain('database_query_duration_seconds');
    });
  });

  describe('recordRedisOperation', () => {
    it('should record Redis operation metrics', async () => {
      recordRedisOperation('ping', 10, 'success');
      
      const metrics = await getMetrics();
      expect(metrics).toContain('redis_operations_total');
      expect(metrics).toContain('redis_operation_duration_seconds');
    });
  });

  describe('recordIdempotencyOperation', () => {
    it('should record idempotency operation metrics', async () => {
      recordIdempotencyOperation('check', 'found');
      
      const metrics = await getMetrics();
      expect(metrics).toContain('idempotency_key_total');
    });
  });

  describe('recordQueueJob', () => {
    it('should record queue job metrics', async () => {
      recordQueueJob('agent', 'completed', 1000);
      
      const metrics = await getMetrics();
      expect(metrics).toContain('queue_job_total');
      expect(metrics).toContain('queue_job_duration_seconds');
    });

    it('should record queue job without duration', async () => {
      recordQueueJob('agent', 'failed');
      
      const metrics = await getMetrics();
      expect(metrics).toContain('queue_job_total');
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics', async () => {
      recordTaskCreation('echo', 'COMPLETED');
      
      let metrics = await getMetrics();
      expect(metrics).toContain('task_creation_total');
      
      resetMetrics();
      
      metrics = await getMetrics();
      // After reset, should only contain default metrics
      expect(metrics).not.toContain('task_creation_total');
    });
  });
});
