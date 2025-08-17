import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { executePriceMonitor, executeFormAutofill } from '../../controllers/flowsController.js';
import { authenticateToken, requireRole } from '../../security/auth.js';
import { validateRequest } from '../../middleware/validateRequest.js';
import { 
  priceMonitorInputSchema, 
  formAutofillInputSchema 
} from '../../flows/index.js';

// Mock dependencies
vi.mock('../../orchestrator/jarvis.js', () => ({
  jarvis: {
    handleCreateRun: vi.fn(),
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
app.post('/flows/price-monitor', authenticateToken, requireRole(['user', 'admin']), validateRequest({ body: priceMonitorInputSchema }), executePriceMonitor);
app.post('/flows/form-autofill', authenticateToken, requireRole(['user', 'admin']), validateRequest({ body: formAutofillInputSchema }), executeFormAutofill);

describe('Flows Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /flows/price-monitor', () => {
    it('should execute price monitor flow successfully', async () => {
      const mockResult = {
        runId: 'run-123',
        status: 'completed',
        output: { 
          result: {
            price: 29.99,
            currency: 'USD',
            url: 'https://example.com/product/123',
            ts: new Date().toISOString(),
          }
        },
      };

      const { jarvis } = await import('../../orchestrator/jarvis.js');
      vi.mocked(jarvis.handleCreateRun).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/flows/price-monitor')
        .set('Authorization', 'Bearer test-token')
        .send({
          productUrl: 'https://example.com/product/123',
          selector: '.price-selector',
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        runId: 'run-123',
        status: 'completed',
        agent: 'BROWSER',
        input: {
          productUrl: 'https://example.com/product/123',
          selector: '.price-selector',
        },
        output: {
          price: 29.99,
          currency: 'USD',
          url: 'https://example.com/product/123',
          ts: expect.any(String),
        },
        artifacts: [],
        createdAt: expect.any(String),
      });

      expect(jarvis.handleCreateRun).toHaveBeenCalledWith({
        userId: 'test-user-123',
        input: {
          prompt: 'Monitor price for product at https://example.com/product/123 using selector .price-selector',
          data: {
            productUrl: 'https://example.com/product/123',
            selector: '.price-selector',
          },
          context: {
            flowType: 'price_monitor',
            productUrl: 'https://example.com/product/123',
            selector: '.price-selector',
          },
          options: {
            flow: expect.any(Object),
            steps: expect.any(Array),
          },
        },
        agent: 'BROWSER',
        options: {
          priority: 'normal',
          tags: ['flow', 'price-monitor'],
          metadata: {
            flowType: 'price_monitor',
            productUrl: 'https://example.com/product/123',
            selector: '.price-selector',
          },
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
          input: {
            productUrl: 'https://example.com/product/123',
            selector: '.price-selector',
          },
          output: {
            price: 29.99,
            currency: 'USD',
            url: 'https://example.com/product/123',
            ts: new Date().toISOString(),
          },
          artifacts: [],
          createdAt: new Date(),
        },
      };

      const { idempotencyService } = await import('../../services/idempotency.js');
      vi.mocked(idempotencyService.validateKey).mockReturnValue(true);
      vi.mocked(idempotencyService.checkIdempotency).mockResolvedValue(mockIdempotencyResult);

      const response = await request(app)
        .post('/flows/price-monitor')
        .set('Authorization', 'Bearer test-token')
        .set('Idempotency-Key', 'test-key-123')
        .send({
          productUrl: 'https://example.com/product/123',
          selector: '.price-selector',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        runId: 'run-existing',
        status: 'completed',
        agent: 'BROWSER',
        input: {
          productUrl: 'https://example.com/product/123',
          selector: '.price-selector',
        },
        output: {
          price: 29.99,
          currency: 'USD',
          url: 'https://example.com/product/123',
          ts: expect.any(String),
        },
        artifacts: [],
      });

      expect(idempotencyService.validateKey).toHaveBeenCalledWith('test-key-123');
      expect(idempotencyService.checkIdempotency).toHaveBeenCalledWith('test-key-123');
    });

    it('should reject invalid idempotency key', async () => {
      const { idempotencyService } = await import('../../services/idempotency.js');
      vi.mocked(idempotencyService.validateKey).mockReturnValue(false);

      const response = await request(app)
        .post('/flows/price-monitor')
        .set('Authorization', 'Bearer test-token')
        .set('Idempotency-Key', 'invalid-key!')
        .send({
          productUrl: 'https://example.com/product/123',
          selector: '.price-selector',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Invalid Idempotency-Key',
        message: 'Idempotency key must be alphanumeric with hyphens/underscores only',
      });
    });

    it('should validate input schema', async () => {
      const response = await request(app)
        .post('/flows/price-monitor')
        .set('Authorization', 'Bearer test-token')
        .send({
          productUrl: 'not-a-valid-url',
          selector: '.price-selector',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Validation failed',
      });
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/flows/price-monitor')
        .set('Authorization', 'Bearer test-token')
        .send({
          productUrl: 'https://example.com/product/123',
          // Missing selector
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Validation failed',
      });
    });
  });

  describe('POST /flows/form-autofill', () => {
    it('should execute form autofill flow successfully', async () => {
      const mockResult = {
        runId: 'run-456',
        status: 'completed',
        output: { 
          result: {
            finalUrl: 'https://example.com/form/submitted',
            success: true,
            fieldsFilled: 2,
            submitted: true,
          }
        },
      };

      const { jarvis } = await import('../../orchestrator/jarvis.js');
      vi.mocked(jarvis.handleCreateRun).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/flows/form-autofill')
        .set('Authorization', 'Bearer test-token')
        .send({
          url: 'https://example.com/form',
          fields: [
            { selector: '#name', value: 'John Doe' },
            { selector: '#email', value: 'john@example.com' },
          ],
          submitSelector: '#submit',
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        runId: 'run-456',
        status: 'completed',
        agent: 'BROWSER',
        input: {
          url: 'https://example.com/form',
          fields: [
            { selector: '#name', value: 'John Doe' },
            { selector: '#email', value: 'john@example.com' },
          ],
          submitSelector: '#submit',
        },
        output: {
          finalUrl: 'https://example.com/form/submitted',
          success: true,
          fieldsFilled: 2,
          submitted: true,
        },
        artifacts: [],
        createdAt: expect.any(String),
      });

      expect(jarvis.handleCreateRun).toHaveBeenCalledWith({
        userId: 'test-user-123',
        input: {
          prompt: 'Fill form at https://example.com/form with 2 fields and submit',
          data: {
            url: 'https://example.com/form',
            fields: [
              { selector: '#name', value: 'John Doe' },
              { selector: '#email', value: 'john@example.com' },
            ],
            submitSelector: '#submit',
          },
          context: {
            flowType: 'form_autofill',
            url: 'https://example.com/form',
            fieldsCount: 2,
            hasSubmit: true,
          },
          options: {
            flow: expect.any(Object),
            steps: expect.any(Array),
          },
        },
        agent: 'BROWSER',
        options: {
          priority: 'normal',
          tags: ['flow', 'form-autofill'],
          metadata: {
            flowType: 'form_autofill',
            url: 'https://example.com/form',
            fieldsCount: 2,
            hasSubmit: true,
          },
        },
      });
    });

    it('should execute form autofill without submit selector', async () => {
      const mockResult = {
        runId: 'run-789',
        status: 'completed',
        output: { 
          result: {
            finalUrl: 'https://example.com/form',
            success: true,
            fieldsFilled: 1,
            submitted: false,
          }
        },
      };

      const { jarvis } = await import('../../orchestrator/jarvis.js');
      vi.mocked(jarvis.handleCreateRun).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/flows/form-autofill')
        .set('Authorization', 'Bearer test-token')
        .send({
          url: 'https://example.com/form',
          fields: [
            { selector: '#name', value: 'John Doe' },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        runId: 'run-789',
        status: 'completed',
        agent: 'BROWSER',
        input: {
          url: 'https://example.com/form',
          fields: [
            { selector: '#name', value: 'John Doe' },
          ],
        },
        output: {
          finalUrl: 'https://example.com/form',
          success: true,
          fieldsFilled: 1,
          submitted: false,
        },
      });

      expect(jarvis.handleCreateRun).toHaveBeenCalledWith({
        userId: 'test-user-123',
        input: {
          prompt: 'Fill form at https://example.com/form with 1 fields',
          data: {
            url: 'https://example.com/form',
            fields: [
              { selector: '#name', value: 'John Doe' },
            ],
          },
          context: {
            flowType: 'form_autofill',
            url: 'https://example.com/form',
            fieldsCount: 1,
            hasSubmit: false,
          },
          options: {
            flow: expect.any(Object),
            steps: expect.any(Array),
          },
        },
        agent: 'BROWSER',
        options: {
          priority: 'normal',
          tags: ['flow', 'form-autofill'],
          metadata: {
            flowType: 'form_autofill',
            url: 'https://example.com/form',
            fieldsCount: 1,
            hasSubmit: false,
          },
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
          input: {
            url: 'https://example.com/form',
            fields: [{ selector: '#name', value: 'John Doe' }],
          },
          output: {
            finalUrl: 'https://example.com/form',
            success: true,
            fieldsFilled: 1,
            submitted: false,
          },
          artifacts: [],
          createdAt: new Date(),
        },
      };

      const { idempotencyService } = await import('../../services/idempotency.js');
      vi.mocked(idempotencyService.validateKey).mockReturnValue(true);
      vi.mocked(idempotencyService.checkIdempotency).mockResolvedValue(mockIdempotencyResult);

      const response = await request(app)
        .post('/flows/form-autofill')
        .set('Authorization', 'Bearer test-token')
        .set('Idempotency-Key', 'test-key-123')
        .send({
          url: 'https://example.com/form',
          fields: [{ selector: '#name', value: 'John Doe' }],
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        runId: 'run-existing',
        status: 'completed',
        agent: 'BROWSER',
        input: {
          url: 'https://example.com/form',
          fields: [{ selector: '#name', value: 'John Doe' }],
        },
        output: {
          finalUrl: 'https://example.com/form',
          success: true,
          fieldsFilled: 1,
          submitted: false,
        },
        artifacts: [],
      });
    });

    it('should validate input schema', async () => {
      const response = await request(app)
        .post('/flows/form-autofill')
        .set('Authorization', 'Bearer test-token')
        .send({
          url: 'not-a-valid-url',
          fields: [{ selector: '#name', value: 'John Doe' }],
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Validation failed',
      });
    });

    it('should reject empty fields array', async () => {
      const response = await request(app)
        .post('/flows/form-autofill')
        .set('Authorization', 'Bearer test-token')
        .send({
          url: 'https://example.com/form',
          fields: [],
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Validation failed',
      });
    });

    it('should reject invalid field data', async () => {
      const response = await request(app)
        .post('/flows/form-autofill')
        .set('Authorization', 'Bearer test-token')
        .send({
          url: 'https://example.com/form',
          fields: [
            { selector: '', value: 'John Doe' }, // Empty selector
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Validation failed',
      });
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication', async () => {
      // Create app without auth middleware
      const unauthApp = express();
      unauthApp.use(express.json());
      unauthApp.post('/flows/price-monitor', executePriceMonitor);

      const response = await request(unauthApp)
        .post('/flows/price-monitor')
        .send({
          productUrl: 'https://example.com/product/123',
          selector: '.price-selector',
        });

      expect(response.status).toBe(401);
    });

    it('should require proper role', async () => {
      // Create app with user having insufficient role
      const restrictedApp = express();
      restrictedApp.use(express.json());
      restrictedApp.use((req, res, next) => {
        req.user = {
          userId: 'test-user-123',
          email: 'test@example.com',
          role: 'guest', // Insufficient role
          iat: Date.now(),
          exp: Date.now() + 3600000,
        };
        next();
      });
      restrictedApp.post('/flows/price-monitor', authenticateToken, requireRole(['user', 'admin']), executePriceMonitor);

      const response = await request(restrictedApp)
        .post('/flows/price-monitor')
        .set('Authorization', 'Bearer test-token')
        .send({
          productUrl: 'https://example.com/product/123',
          selector: '.price-selector',
        });

      expect(response.status).toBe(403);
    });
  });
});
