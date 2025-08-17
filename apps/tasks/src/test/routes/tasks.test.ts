import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createTask, getRunDetails, getRunAuditLogs } from '../../controllers/taskController.js';
import { authenticateToken, requireRole } from '../../security/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { createTaskSchema } from '../../schemas/validation.js';

// Mock dependencies
vi.mock('../../orchestrator/jarvis.js', () => ({
  jarvis: {
    handleCreateRun: vi.fn(),
    getRun: vi.fn(),
  },
}));

vi.mock('../../services/idempotency.js', () => ({
  idempotencyService: {
    validateKey: vi.fn(),
    checkIdempotency: vi.fn(),
    storeIdempotency: vi.fn(),
  },
}));

vi.mock('../../services/metrics.js', () => ({
  recordTaskCreation: vi.fn(),
  recordTaskExecution: vi.fn(),
}));

vi.mock('../../services/audit.js', () => ({
  getAuditLogs: vi.fn(),
  getAuditStats: vi.fn(),
}));

// Create test app
const app = express();
app.use(express.json());

// Mock middleware
app.use((req, res, next) => {
  req.user = {
    userId: 'test-user-123',
    email: 'test@example.com',
    role: 'user',
    iat: Date.now(),
    exp: Date.now() + 3600000,
  };
  next();
});

// Test routes
app.post('/tasks/create', authenticateToken, requireRole(['user', 'admin']), validateRequest({ body: createTaskSchema }), createTask);
app.get('/runs/:id', authenticateToken, requireRole(['admin', 'user']), getRunDetails);
app.get('/runs/:id/logs', authenticateToken, requireRole(['admin', 'user']), getRunAuditLogs);

describe('Tasks Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /tasks/create', () => {
    it('should create a task with BROWSER agent', async () => {
      const mockResult = {
        runId: 'run-123',
        status: 'completed',
        output: { result: 'Browser automation completed' },
      };

      const { jarvis } = await import('../../orchestrator/jarvis.js');
      vi.mocked(jarvis.handleCreateRun).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/tasks/create')
        .set('Authorization', 'Bearer test-token')
        .send({
          agent: 'BROWSER',
          input: 'Open google.com and click search',
          options: {
            timeout: 60000,
            priority: 'high',
            tags: ['web', 'automation'],
          },
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        runId: 'run-123',
        status: 'completed',
        agent: 'BROWSER',
        input: 'Open google.com and click search',
        output: 'Browser automation completed',
        artifacts: [],
      });

      expect(jarvis.handleCreateRun).toHaveBeenCalledWith({
        userId: 'test-user-123',
        input: {
          prompt: 'Open google.com and click search',
          data: {},
          context: {},
          options: {
            timeout: 60000,
            priority: 'high',
            tags: ['web', 'automation'],
          },
        },
        agent: 'BROWSER',
        options: {
          timeout: 60000,
          priority: 'high',
          tags: ['web', 'automation'],
          metadata: undefined,
        },
      });
    });

    it('should create a task with GEN agent', async () => {
      const mockResult = {
        runId: 'run-456',
        status: 'completed',
        output: { result: 'Generated story about cats' },
      };

      const { jarvis } = await import('../../orchestrator/jarvis.js');
      vi.mocked(jarvis.handleCreateRun).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/tasks/create')
        .set('Authorization', 'Bearer test-token')
        .send({
          agent: 'GEN',
          input: 'Write a story about cats',
          options: {
            priority: 'normal',
          },
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        runId: 'run-456',
        status: 'completed',
        agent: 'GEN',
        input: 'Write a story about cats',
        output: 'Generated story about cats',
      });
    });

    it('should create a task without specifying agent (auto-selection)', async () => {
      const mockResult = {
        runId: 'run-789',
        status: 'completed',
        output: { result: 'Auto-selected agent completed task' },
      };

      const { jarvis } = await import('../../orchestrator/jarvis.js');
      vi.mocked(jarvis.handleCreateRun).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/tasks/create')
        .set('Authorization', 'Bearer test-token')
        .send({
          input: 'Generate some content',
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        runId: 'run-789',
        status: 'completed',
        agent: 'auto',
        input: 'Generate some content',
      });

      expect(jarvis.handleCreateRun).toHaveBeenCalledWith({
        userId: 'test-user-123',
        input: {
          prompt: 'Generate some content',
          data: {},
          context: {},
          options: {},
        },
        agent: undefined,
        options: {
          timeout: undefined,
          priority: undefined,
          tags: undefined,
          metadata: undefined,
        },
      });
    });

    it('should handle idempotency key correctly', async () => {
      const mockIdempotencyResult = {
        isDuplicate: true,
        existingRunId: 'run-existing',
        existingRun: {
          id: 'run-existing',
          status: 'completed',
          agent: 'BROWSER',
          input: 'Previous request',
          output: 'Previous result',
          createdAt: new Date(),
        },
      };

      const { idempotencyService } = await import('../../services/idempotency.js');
      vi.mocked(idempotencyService.validateKey).mockReturnValue(true);
      vi.mocked(idempotencyService.checkIdempotency).mockResolvedValue(mockIdempotencyResult);

      const response = await request(app)
        .post('/tasks/create')
        .set('Authorization', 'Bearer test-token')
        .set('Idempotency-Key', 'test-key-123')
        .send({
          agent: 'BROWSER',
          input: 'Open google.com',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        runId: 'run-existing',
        status: 'completed',
        agent: 'BROWSER',
        input: 'Previous request',
        output: 'Previous result',
      });

      expect(idempotencyService.validateKey).toHaveBeenCalledWith('test-key-123');
      expect(idempotencyService.checkIdempotency).toHaveBeenCalledWith('test-key-123');
    });

    it('should reject invalid idempotency key', async () => {
      const { idempotencyService } = await import('../../services/idempotency.js');
      vi.mocked(idempotencyService.validateKey).mockReturnValue(false);

      const response = await request(app)
        .post('/tasks/create')
        .set('Authorization', 'Bearer test-token')
        .set('Idempotency-Key', 'invalid-key!')
        .send({
          input: 'Test input',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Invalid Idempotency-Key',
        message: 'Idempotency key must be alphanumeric with hyphens/underscores only',
      });
    });

    it('should validate input with XSS prevention', async () => {
      const response = await request(app)
        .post('/tasks/create')
        .set('Authorization', 'Bearer test-token')
        .send({
          input: '<script>alert("xss")</script>',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Validation failed',
      });
    });

    it('should reject input that is too long', async () => {
      const longInput = 'a'.repeat(10001);
      
      const response = await request(app)
        .post('/tasks/create')
        .set('Authorization', 'Bearer test-token')
        .send({
          input: longInput,
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Validation failed',
      });
    });

    it('should reject invalid agent type', async () => {
      const response = await request(app)
        .post('/tasks/create')
        .set('Authorization', 'Bearer test-token')
        .send({
          agent: 'INVALID_AGENT',
          input: 'Test input',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Validation failed',
      });
    });

    it('should reject invalid priority', async () => {
      const response = await request(app)
        .post('/tasks/create')
        .set('Authorization', 'Bearer test-token')
        .send({
          input: 'Test input',
          options: {
            priority: 'urgent', // Not allowed
          },
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Validation failed',
      });
    });
  });

  describe('GET /runs/:id', () => {
    it('should get run details for owner', async () => {
      const mockRun = {
        id: 'run-123',
        agentId: 'agent-browser',
        status: 'completed',
        input: { prompt: 'Test input' },
        output: { result: 'Test output' },
        metadata: { userId: 'test-user-123' },
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 1000,
        nodes: [
          {
            id: 'node-1',
            name: 'browser_execution',
            type: 'browser',
            status: 'completed',
            input: {},
            output: {},
            startedAt: new Date(),
            completedAt: new Date(),
            duration: 1000,
            attempts: 1,
            maxAttempts: 1,
          },
        ],
      };

      const { jarvis } = await import('../../orchestrator/jarvis.js');
      vi.mocked(jarvis.getRun).mockResolvedValue(mockRun);

      const response = await request(app)
        .get('/runs/run-123')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        run: {
          id: 'run-123',
          agentId: 'agent-browser',
          status: 'completed',
          input: { prompt: 'Test input' },
          output: { result: 'Test output' },
        },
        nodes: [
          {
            id: 'node-1',
            name: 'browser_execution',
            type: 'browser',
            status: 'completed',
          },
        ],
        artifacts: [],
      });

      expect(jarvis.getRun).toHaveBeenCalledWith('run-123', 'test-user-123');
    });

    it('should return 404 for non-existent run', async () => {
      const { jarvis } = await import('../../orchestrator/jarvis.js');
      vi.mocked(jarvis.getRun).mockResolvedValue(null);

      const response = await request(app)
        .get('/runs/non-existent')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        error: 'Run not found',
        message: 'Run with ID non-existent not found',
      });
    });

    it('should return 403 for unauthorized access', async () => {
      const { jarvis } = await import('../../orchestrator/jarvis.js');
      vi.mocked(jarvis.getRun).mockRejectedValue(new Error('Access denied: You can only access your own runs'));

      const response = await request(app)
        .get('/runs/run-123')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        error: 'Access denied',
        message: 'Access denied: You can only access your own runs',
      });
    });
  });

  describe('GET /runs/:id/logs', () => {
    it('should get audit logs for owner', async () => {
      const mockRun = {
        id: 'run-123',
        metadata: { userId: 'test-user-123' },
      };

      const mockAuditLogs = {
        logs: [
          {
            id: 'log-1',
            runId: 'run-123',
            action: 'CREATE_RUN',
            status: 'OK',
            durationMs: 100,
            createdAt: new Date(),
          },
        ],
        nextCursor: 'cursor-123',
        hasMore: false,
      };

      const mockAuditStats = {
        totalEvents: 1,
        successCount: 1,
        errorCount: 0,
        averageDuration: 100,
        actions: [{ action: 'CREATE_RUN', count: 1 }],
      };

      const { jarvis } = await import('../../orchestrator/jarvis.js');
      const { getAuditLogs, getAuditStats } = await import('../../services/audit.js');

      vi.mocked(jarvis.getRun).mockResolvedValue(mockRun);
      vi.mocked(getAuditLogs).mockResolvedValue(mockAuditLogs);
      vi.mocked(getAuditStats).mockResolvedValue(mockAuditStats);

      const response = await request(app)
        .get('/runs/run-123/logs')
        .set('Authorization', 'Bearer test-token')
        .query({ limit: 50 });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        logs: [
          {
            id: 'log-1',
            runId: 'run-123',
            action: 'CREATE_RUN',
            status: 'OK',
            durationMs: 100,
          },
        ],
        stats: {
          totalEvents: 1,
          successCount: 1,
          errorCount: 0,
          averageDuration: 100,
          actions: [{ action: 'CREATE_RUN', count: 1 }],
        },
        pagination: {
          nextCursor: 'cursor-123',
          hasMore: false,
        },
      });

      expect(jarvis.getRun).toHaveBeenCalledWith('run-123', 'test-user-123');
      expect(getAuditLogs).toHaveBeenCalledWith('run-123', undefined, 50);
      expect(getAuditStats).toHaveBeenCalledWith('run-123');
    });

    it('should handle cursor-based pagination', async () => {
      const mockRun = {
        id: 'run-123',
        metadata: { userId: 'test-user-123' },
      };

      const mockAuditLogs = {
        logs: [],
        nextCursor: undefined,
        hasMore: false,
      };

      const mockAuditStats = {
        totalEvents: 0,
        successCount: 0,
        errorCount: 0,
        averageDuration: 0,
        actions: [],
      };

      const { jarvis } = await import('../../orchestrator/jarvis.js');
      const { getAuditLogs, getAuditStats } = await import('../../services/audit.js');

      vi.mocked(jarvis.getRun).mockResolvedValue(mockRun);
      vi.mocked(getAuditLogs).mockResolvedValue(mockAuditLogs);
      vi.mocked(getAuditStats).mockResolvedValue(mockAuditStats);

      const response = await request(app)
        .get('/runs/run-123/logs')
        .set('Authorization', 'Bearer test-token')
        .query({ cursor: 'cursor-123', limit: 25 });

      expect(response.status).toBe(200);
      expect(getAuditLogs).toHaveBeenCalledWith('run-123', 'cursor-123', 25);
    });

    it('should return 404 for non-existent run', async () => {
      const { jarvis } = await import('../../orchestrator/jarvis.js');
      vi.mocked(jarvis.getRun).mockResolvedValue(null);

      const response = await request(app)
        .get('/runs/non-existent/logs')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        error: 'Run not found',
        message: 'Run with ID non-existent not found',
      });
    });

    it('should return 403 for unauthorized access', async () => {
      const { jarvis } = await import('../../orchestrator/jarvis.js');
      vi.mocked(jarvis.getRun).mockRejectedValue(new Error('Access denied: You can only access your own runs'));

      const response = await request(app)
        .get('/runs/run-123/logs')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        error: 'Access denied',
        message: 'Access denied: You can only access your own runs',
      });
    });
  });
});
