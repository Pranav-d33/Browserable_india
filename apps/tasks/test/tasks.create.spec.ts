import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest';
import request from 'supertest';
import express from 'express';
import { tasksRouter } from '../src/routes/tasks.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { notFoundHandler } from '../src/middleware/notFoundHandler.js';

// Set test environment
process.env.NODE_ENV = 'test';

// Mock database operations
vi.mock('../src/db/client.js', () => ({
  db: {
    run: {
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    idempotencyKey: {
      deleteMany: vi.fn(),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  },
}));

// Mock idempotency service
vi.mock('../src/services/idempotency.js', () => ({
  idempotencyService: {
    validateKey: vi.fn(),
    checkIdempotency: vi.fn(),
    storeIdempotency: vi.fn(),
  },
}));

describe('POST /v1/tasks/create', () => {
  let app: express.Application;

  beforeAll(async () => {
    // Create Express app for testing
    app = express();

    // Add middleware
    app.use(express.json());

    // Add routes
    app.use('/v1/tasks', tasksRouter);

    // Add error handlers
    app.use(notFoundHandler);
    app.use(errorHandler);
  });

  afterAll(async () => {
    // Cleanup
  });

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Set up default mocks for successful cases
    const { db } = await import('../src/db/client.js');
    const { idempotencyService } = await import(
      '../src/services/idempotency.js'
    );

    // Default database mocks
    const mockRun = {
      id: 'test-run-id-123',
      userId: 'system',
      agent: 'echo',
      status: 'PENDING',
      input: 'namaste bharat',
      output: null,
      meta: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.run.create).mockResolvedValue(mockRun);
    vi.mocked(db.run.update).mockResolvedValue({
      ...mockRun,
      status: 'COMPLETED',
      output: 'namaste bharat',
    });

    // Default idempotency mocks
    vi.mocked(idempotencyService.validateKey).mockReturnValue(true);
    vi.mocked(idempotencyService.checkIdempotency).mockResolvedValue({
      isDuplicate: false,
      existingRun: null,
      existingRunId: null,
    });
    vi.mocked(idempotencyService.storeIdempotency).mockResolvedValue();
  });

  describe('Basic task creation', () => {
    it('should create a task with ECHO agent and return expected response', async () => {
      const requestBody = {
        agent: 'echo',
        input: 'namaste bharat',
      };

      const response = await request(app)
        .post('/v1/tasks/create')
        .set('Content-Type', 'application/json')
        .send(requestBody);

      // Assert response status
      expect(response.status).toBe(201);

      // Assert response body structure
      expect(response.body).toHaveProperty('runId');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('agent');
      expect(response.body).toHaveProperty('input');
      expect(response.body).toHaveProperty('createdAt');

      // Assert specific values
      expect(response.body.status).toBe('COMPLETED');
      expect(response.body.agent).toBe('echo');
      expect(response.body.input).toBe('namaste bharat');
      expect(response.body.output).toBe('namaste bharat');

      // Assert runId is a valid string
      expect(typeof response.body.runId).toBe('string');
      expect(response.body.runId.length).toBeGreaterThan(0);

      // Assert createdAt is a valid ISO date string
      expect(new Date(response.body.createdAt)).toBeInstanceOf(Date);
    });

    it('should create a task with default agent (echo) when agent is not specified', async () => {
      const requestBody = {
        input: 'namaste bharat',
      };

      const response = await request(app)
        .post('/v1/tasks/create')
        .set('Content-Type', 'application/json')
        .send(requestBody);

      expect(response.status).toBe(201);
      expect(response.body.agent).toBe('echo');
      expect(response.body.status).toBe('COMPLETED');
      expect(response.body.output).toBe('namaste bharat');
    });

    it('should handle task with meta information', async () => {
      const requestBody = {
        agent: 'echo',
        input: 'namaste bharat',
        meta: {
          source: 'test',
          priority: 'high',
          tags: ['test', 'echo'],
        },
      };

      const response = await request(app)
        .post('/v1/tasks/create')
        .set('Content-Type', 'application/json')
        .send(requestBody);

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('COMPLETED');
      expect(response.body.output).toBe('namaste bharat');
    });
  });

  describe('Idempotency testing', () => {
    it('should return same runId when using same Idempotency-Key', async () => {
      const { idempotencyService } = await import(
        '../src/services/idempotency.js'
      );

      // Mock idempotency service to return existing run for second request
      const existingRun = {
        id: 'existing-run-id-456',
        userId: 'system',
        agent: 'echo',
        status: 'COMPLETED',
        input: 'namaste bharat',
        output: 'namaste bharat',
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // First call: no existing run
      vi.mocked(idempotencyService.checkIdempotency)
        .mockResolvedValueOnce({
          isDuplicate: false,
          existingRun: null,
          existingRunId: null,
        })
        // Second call: existing run found
        .mockResolvedValueOnce({
          isDuplicate: true,
          existingRun: existingRun,
          existingRunId: existingRun.id,
        });

      const requestBody = {
        agent: 'echo',
        input: 'namaste bharat',
      };

      const idempotencyKey = 'test-key-123';

      // First request
      const firstResponse = await request(app)
        .post('/v1/tasks/create')
        .set('Content-Type', 'application/json')
        .set('Idempotency-Key', idempotencyKey)
        .send(requestBody);

      expect(firstResponse.status).toBe(201);
      const firstRunId = firstResponse.body.runId;

      // Second request with same idempotency key
      const secondResponse = await request(app)
        .post('/v1/tasks/create')
        .set('Content-Type', 'application/json')
        .set('Idempotency-Key', idempotencyKey)
        .send(requestBody);

      expect(secondResponse.status).toBe(200); // Should return 200 for idempotent response
      expect(secondResponse.body.runId).toBe(existingRun.id);
      expect(secondResponse.body.status).toBe('COMPLETED');
      expect(secondResponse.body.output).toBe('namaste bharat');
    });

    it('should return different runIds when using different Idempotency-Keys', async () => {
      const { db } = await import('../src/db/client.js');

      // Mock different run IDs for different requests
      const firstRun = {
        id: 'first-run-id-123',
        userId: 'system',
        agent: 'echo',
        status: 'PENDING',
        input: 'namaste bharat',
        output: null,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const secondRun = {
        id: 'second-run-id-456',
        userId: 'system',
        agent: 'echo',
        status: 'PENDING',
        input: 'namaste bharat',
        output: null,
        meta: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock database to return different run IDs
      vi.mocked(db.run.create)
        .mockResolvedValueOnce(firstRun)
        .mockResolvedValueOnce(secondRun);

      vi.mocked(db.run.update)
        .mockResolvedValueOnce({
          ...firstRun,
          status: 'COMPLETED',
          output: 'namaste bharat',
        })
        .mockResolvedValueOnce({
          ...secondRun,
          status: 'COMPLETED',
          output: 'namaste bharat',
        });

      const requestBody = {
        agent: 'echo',
        input: 'namaste bharat',
      };

      // First request
      const firstResponse = await request(app)
        .post('/v1/tasks/create')
        .set('Content-Type', 'application/json')
        .set('Idempotency-Key', 'key-1')
        .send(requestBody);

      expect(firstResponse.status).toBe(201);
      const firstRunId = firstResponse.body.runId;

      // Second request with different idempotency key
      const secondResponse = await request(app)
        .post('/v1/tasks/create')
        .set('Content-Type', 'application/json')
        .set('Idempotency-Key', 'key-2')
        .send(requestBody);

      expect(secondResponse.status).toBe(201);
      expect(secondResponse.body.runId).not.toBe(firstRunId);
      expect(secondResponse.body.status).toBe('COMPLETED');
    });

    it('should handle invalid idempotency key format', async () => {
      const { idempotencyService } = await import(
        '../src/services/idempotency.js'
      );

      // Mock idempotency service to reject invalid key
      vi.mocked(idempotencyService.validateKey).mockReturnValue(false);

      const requestBody = {
        agent: 'echo',
        input: 'namaste bharat',
      };

      const response = await request(app)
        .post('/v1/tasks/create')
        .set('Content-Type', 'application/json')
        .set('Idempotency-Key', 'invalid key with spaces!')
        .send(requestBody);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Error');
      expect(response.body.message).toBe('Invalid Idempotency-Key');
    });
  });

  describe('Error handling', () => {
    it('should return 400 for missing input', async () => {
      const requestBody = {
        agent: 'echo',
      };

      const response = await request(app)
        .post('/v1/tasks/create')
        .set('Content-Type', 'application/json')
        .send(requestBody);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Request validation failed');
    });

    it('should return 400 for empty input', async () => {
      const requestBody = {
        agent: 'echo',
        input: '',
      };

      const response = await request(app)
        .post('/v1/tasks/create')
        .set('Content-Type', 'application/json')
        .send(requestBody);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Request validation failed');
    });

    it('should return 400 for input too long', async () => {
      const longInput = 'a'.repeat(10001);
      const requestBody = {
        agent: 'echo',
        input: longInput,
      };

      const response = await request(app)
        .post('/v1/tasks/create')
        .set('Content-Type', 'application/json')
        .send(requestBody);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Request validation failed');
    });

    it('should return 400 for invalid agent', async () => {
      const requestBody = {
        agent: 'INVALID_AGENT',
        input: 'namaste bharat',
      };

      const response = await request(app)
        .post('/v1/tasks/create')
        .set('Content-Type', 'application/json')
        .send(requestBody);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Request validation failed');
    });

    it('should return 400 for input with XSS content', async () => {
      const requestBody = {
        agent: 'echo',
        input: '<script>alert("xss")</script>',
      };

      const response = await request(app)
        .post('/v1/tasks/create')
        .set('Content-Type', 'application/json')
        .send(requestBody);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Request validation failed');
    });
  });

  describe('Response validation', () => {
    it('should return properly formatted response with all required fields', async () => {
      const requestBody = {
        agent: 'echo',
        input: 'namaste bharat',
      };

      const response = await request(app)
        .post('/v1/tasks/create')
        .set('Content-Type', 'application/json')
        .send(requestBody);

      expect(response.status).toBe(201);

      // Validate response schema
      const responseBody = response.body;

      // Required fields
      expect(responseBody).toHaveProperty('runId');
      expect(responseBody).toHaveProperty('status');
      expect(responseBody).toHaveProperty('agent');
      expect(responseBody).toHaveProperty('input');
      expect(responseBody).toHaveProperty('createdAt');

      // Field types
      expect(typeof responseBody.runId).toBe('string');
      expect(typeof responseBody.status).toBe('string');
      expect(typeof responseBody.agent).toBe('string');
      expect(typeof responseBody.input).toBe('string');
      expect(typeof responseBody.createdAt).toBe('string');

      // Status enum values
      expect([
        'PENDING',
        'RUNNING',
        'COMPLETED',
        'FAILED',
        'CANCELLED',
      ]).toContain(responseBody.status);

      // Valid date
      expect(() => new Date(responseBody.createdAt)).not.toThrow();
      expect(new Date(responseBody.createdAt).toISOString()).toBe(
        responseBody.createdAt
      );
    });
  });
});
