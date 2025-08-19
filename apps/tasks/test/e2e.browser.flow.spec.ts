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
import { createServer } from 'http';
import { AddressInfo } from 'net';

// Import test utilities
import { startTestServer, TestServer } from './fixtures/test-server.js';

// Import app modules
import { tasksRouter } from '../src/routes/tasks.js';
import { flowsRouter } from '../src/routes/flows.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { notFoundHandler } from '../src/middleware/notFoundHandler.js';
import { requestId } from '../src/middleware/requestId.js';

// Set test environment
process.env.NODE_ENV = 'test';

// Mock LLM service to avoid actual API calls
vi.mock('../src/services/llm/index.js', () => ({
  llmService: {
    generateResponse: vi.fn().mockResolvedValue({
      content: 'Mock LLM response for testing',
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    }),
  },
}));

// Mock database operations
vi.mock('../src/db/client.js', () => ({
  db: {
    run: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    artifact: {
      create: vi.fn(),
      findMany: vi.fn(),
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

// Mock browser client
vi.mock('../src/services/browserClient.js', () => ({
  browserClient: {
    createSession: vi.fn().mockResolvedValue({ sessionId: 'test-session-123' }),
    goto: vi.fn().mockResolvedValue({ success: true }),
    type: vi.fn().mockResolvedValue({ success: true }),
    click: vi.fn().mockResolvedValue({ success: true }),
    waitFor: vi.fn().mockResolvedValue({ success: true }),
    waitForNavigation: vi.fn().mockResolvedValue({ success: true }),
    screenshot: vi.fn().mockResolvedValue({
      success: true,
      artifactId: 'test-artifact-123',
      url: 'http://localhost:3000/artifacts/test-artifact-123',
    }),
    getText: vi.fn().mockResolvedValue({
      success: true,
      text: '$29.99',
    }),
    closeSession: vi.fn().mockResolvedValue({ success: true }),
  },
}));

// Mock authentication
vi.mock('../src/security/auth.js', () => ({
  getCurrentUserId: vi.fn().mockReturnValue('test-user-123'),
  AuthenticatedRequest: class extends Request {},
}));

describe('E2E Browser Flow Tests', () => {
  let tasksApp: express.Application;
  let tasksServer: any;
  let tasksPort: number;
  let tasksUrl: string;

  let browserApp: express.Application;
  let browserServer: any;
  let browserPort: number;
  let browserUrl: string;

  let testServer: TestServer;

  beforeAll(async () => {
    // Start test fixture server
    testServer = await startTestServer();
    console.log(`Test server started at ${testServer.url}`);

    // Create and start tasks app
    tasksApp = express();
    tasksApp.use(requestId);
    tasksApp.use(express.json());
    tasksApp.use('/v1/tasks', tasksRouter);
    tasksApp.use('/v1/flows', flowsRouter);
    tasksApp.use(notFoundHandler);
    tasksApp.use(errorHandler);

    tasksServer = createServer(tasksApp);
    await new Promise<void>(resolve => {
      tasksServer.listen(0, () => {
        const address = tasksServer.address() as AddressInfo;
        tasksPort = address.port;
        tasksUrl = `http://localhost:${tasksPort}`;
        console.log(`Tasks app started at ${tasksUrl}`);
        resolve();
      });
    });

    // Create and start browser app
    browserApp = express();
    browserApp.use(express.json());

    // Mock browser routes for testing
    browserApp.post('/v1/sessions', (req, res) => {
      res.json({ sessionId: 'test-session-123' });
    });

    browserApp.post('/v1/sessions/:sessionId/goto', (req, res) => {
      res.json({ success: true });
    });

    browserApp.post('/v1/sessions/:sessionId/type', (req, res) => {
      res.json({ success: true });
    });

    browserApp.post('/v1/sessions/:sessionId/click', (req, res) => {
      res.json({ success: true });
    });

    browserApp.post('/v1/sessions/:sessionId/wait-for', (req, res) => {
      res.json({ success: true });
    });

    browserApp.post(
      '/v1/sessions/:sessionId/wait-for-navigation',
      (req, res) => {
        res.json({ success: true });
      }
    );

    browserApp.post('/v1/sessions/:sessionId/screenshot', (req, res) => {
      res.json({
        success: true,
        artifactId: 'test-artifact-123',
        url: 'http://localhost:3000/artifacts/test-artifact-123',
      });
    });

    browserApp.post('/v1/sessions/:sessionId/get-text', (req, res) => {
      res.json({ success: true, text: '$29.99' });
    });

    browserApp.delete('/v1/sessions/:sessionId', (req, res) => {
      res.json({ success: true });
    });

    browserServer = createServer(browserApp);
    await new Promise<void>(resolve => {
      browserServer.listen(0, () => {
        const address = browserServer.address() as AddressInfo;
        browserPort = address.port;
        browserUrl = `http://localhost:${browserPort}`;
        console.log(`Browser app started at ${browserUrl}`);
        resolve();
      });
    });

    // Set environment variables for tasks app to point to browser app
    process.env.BROWSER_SERVICE_URL = browserUrl;
  });

  afterAll(async () => {
    // Cleanup servers
    await testServer.close();
    await new Promise<void>(resolve => tasksServer.close(() => resolve()));
    await new Promise<void>(resolve => browserServer.close(() => resolve()));
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
      userId: 'test-user-123',
      agent: 'BROWSER',
      status: 'COMPLETED',
      input: {},
      output: {},
      meta: {},
      artifacts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(db.run.create).mockResolvedValue(mockRun);
    vi.mocked(db.run.update).mockResolvedValue(mockRun);
    vi.mocked(db.run.findFirst).mockResolvedValue(mockRun);
    vi.mocked(db.artifact.create).mockResolvedValue({
      id: 'test-artifact-123',
      runId: 'test-run-id-123',
      type: 'screenshot',
      url: 'http://localhost:3000/artifacts/test-artifact-123',
      metadata: {},
      createdAt: new Date(),
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

  describe('Form Autofill Flow', () => {
    it('should execute form autofill flow and create artifact', async () => {
      const formUrl = `${testServer.url}/test-form`;
      const successUrl = `${testServer.url}/success`;

      const requestBody = {
        url: formUrl,
        fields: [
          { selector: '#name', value: 'John Doe' },
          { selector: '#email', value: 'john@example.com' },
          { selector: '#message', value: 'Test message' },
        ],
        submitSelector: '#submit-btn',
      };

      const response = await request(tasksApp)
        .post('/v1/flows/form-autofill')
        .set('Authorization', 'Bearer test-token')
        .send(requestBody)
        .expect(200);

      // Verify response structure
      expect(response.body).toHaveProperty('runId');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('agent', 'BROWSER');
      expect(response.body).toHaveProperty('input');
      expect(response.body).toHaveProperty('output');
      expect(response.body).toHaveProperty('artifacts');
      expect(response.body).toHaveProperty('createdAt');

      // Verify output contains final URL
      expect(response.body.output).toHaveProperty('finalUrl');
      expect(response.body.output.finalUrl).toBe(successUrl);
      expect(response.body.output).toHaveProperty('success', true);
      expect(response.body.output).toHaveProperty('fieldsFilled', 3);
      expect(response.body.output).toHaveProperty('submitted', true);

      // Verify artifact was created
      expect(response.body.artifacts).toBeInstanceOf(Array);
      expect(response.body.artifacts.length).toBeGreaterThan(0);
      expect(response.body.artifacts[0]).toHaveProperty('id');
      expect(response.body.artifacts[0]).toHaveProperty('type', 'screenshot');
      expect(response.body.artifacts[0]).toHaveProperty('url');

      // Verify database calls
      const { db } = await import('../src/db/client.js');
      expect(db.run.create).toHaveBeenCalled();
      expect(db.run.update).toHaveBeenCalled();
      expect(db.artifact.create).toHaveBeenCalled();
    }, 30000); // 30 second timeout for e2e test
  });

  describe('Price Monitor Flow', () => {
    it('should execute price monitor flow and extract price', async () => {
      const productUrl = `${testServer.url}/test-price`;

      const requestBody = {
        productUrl,
        selector: '#price',
      };

      const response = await request(tasksApp)
        .post('/v1/flows/price-monitor')
        .set('Authorization', 'Bearer test-token')
        .send(requestBody)
        .expect(200);

      // Verify response structure
      expect(response.body).toHaveProperty('runId');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('agent', 'BROWSER');
      expect(response.body).toHaveProperty('input');
      expect(response.body).toHaveProperty('output');
      expect(response.body).toHaveProperty('createdAt');

      // Verify output contains price information
      expect(response.body.output).toHaveProperty('price');
      expect(response.body.output).toHaveProperty('currency');
      expect(response.body.output).toHaveProperty('url');
      expect(response.body.output).toHaveProperty('ts');

      // Verify price extraction
      expect(response.body.output.price).toBe(29.99);
      expect(response.body.output.currency).toBe('USD');
      expect(response.body.output.url).toBe(productUrl);

      // Verify database calls
      const { db } = await import('../src/db/client.js');
      expect(db.run.create).toHaveBeenCalled();
      expect(db.run.update).toHaveBeenCalled();
    }, 30000); // 30 second timeout for e2e test
  });

  describe('Error Handling', () => {
    it('should handle invalid form URL gracefully', async () => {
      const requestBody = {
        url: 'http://invalid-url-that-does-not-exist.com/form',
        fields: [{ selector: '#name', value: 'John Doe' }],
      };

      const response = await request(tasksApp)
        .post('/v1/flows/form-autofill')
        .set('Authorization', 'Bearer test-token')
        .send(requestBody)
        .expect(200); // Should still return 200 as the run is created

      // Verify the run was created but may have failed status
      expect(response.body).toHaveProperty('runId');
      expect(response.body).toHaveProperty('status');
    });

    it('should handle missing authentication', async () => {
      const requestBody = {
        url: `${testServer.url}/test-form`,
        fields: [{ selector: '#name', value: 'John Doe' }],
      };

      await request(tasksApp)
        .post('/v1/flows/form-autofill')
        .send(requestBody)
        .expect(401);
    });
  });
});
