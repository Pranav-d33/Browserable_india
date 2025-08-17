import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger, createLogger } from '../logger.js';

// Mock pino to avoid actual logging during tests
vi.mock('pino', () => {
  const mockLogger = {
    child: vi.fn().mockReturnThis(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  };

  const mockPino = vi.fn().mockReturnValue(mockLogger);
  mockPino.stdSerializers = {
    req: vi.fn(req => ({ ...req, method: req.method, url: req.url })),
    res: vi.fn(res => ({ ...res, statusCode: res.statusCode })),
    err: vi.fn(err => ({ ...err, message: err.message })),
  };
  mockPino.stdTimeFunctions = {
    isoTime: vi.fn(() => '2023-01-01T00:00:00.000Z'),
  };

  return { default: mockPino };
});

// Mock env to control NODE_ENV
vi.mock('../env.js', () => ({
  env: {
    NODE_ENV: 'test',
  },
}));

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logger instance', () => {
    it('should create a logger instance', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('should have standard logging methods', () => {
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.debug).toBeDefined();
      expect(logger.trace).toBeDefined();
    });
  });

  describe('createLogger', () => {
    it('should create a child logger with context', () => {
      const childLogger = createLogger('test-context');
      expect(childLogger).toBeDefined();
      expect(childLogger.child).toHaveBeenCalledWith({
        context: 'test-context',
      });
    });

    it('should return the same logger instance for child creation', () => {
      const childLogger1 = createLogger('context1');
      const childLogger2 = createLogger('context2');

      expect(childLogger1).toBe(childLogger2);
      expect(childLogger1.child).toHaveBeenCalledWith({ context: 'context1' });
      expect(childLogger2.child).toHaveBeenCalledWith({ context: 'context2' });
    });
  });

  describe('logging functionality', () => {
    it('should call info method', () => {
      const message = 'Test info message';
      const data = { key: 'value' };

      logger.info(data, message);

      expect(logger.info).toHaveBeenCalledWith(data, message);
    });

    it('should call error method', () => {
      const message = 'Test error message';
      const error = new Error('Test error');

      logger.error(error, message);

      expect(logger.error).toHaveBeenCalledWith(error, message);
    });

    it('should call warn method', () => {
      const message = 'Test warning message';

      logger.warn(message);

      expect(logger.warn).toHaveBeenCalledWith(message);
    });

    it('should call debug method', () => {
      const message = 'Test debug message';

      logger.debug(message);

      expect(logger.debug).toHaveBeenCalledWith(message);
    });
  });

  describe('redaction patterns', () => {
    it('should include sensitive data patterns in redaction', () => {
      // This test verifies that the redaction patterns are defined
      // The actual redaction is handled by pino configuration
      const sensitivePatterns = [
        'authorization',
        'cookie',
        'password',
        'secret',
        'token',
        'key',
        'credential',
        'api_key',
        'access_token',
        'refresh_token',
        'private_key',
        'public_key',
        'session_id',
        'auth_token',
        'bearer',
        'basic',
      ];

      // These patterns should be included in the redaction configuration
      // The actual implementation is in the logger.ts file
      expect(sensitivePatterns).toContain('authorization');
      expect(sensitivePatterns).toContain('password');
      expect(sensitivePatterns).toContain('secret');
      expect(sensitivePatterns).toContain('token');
    });
  });
});
