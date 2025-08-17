import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { envSchema } from '../env.js';

// Mock dotenv-flow to avoid loading actual environment
vi.mock('dotenv-flow', () => ({
  config: vi.fn(),
}));

describe('Environment Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('envSchema validation', () => {
    it('should validate required environment variables', () => {
      const validEnv = {
        POSTGRES_URL: 'postgresql://user:pass@localhost:5432/db',
        REDIS_URL: 'redis://localhost:6379',
        S3_ENDPOINT: 'https://s3.amazonaws.com',
        S3_ACCESS_KEY: 'test-access-key',
        S3_SECRET_KEY: 'test-secret-key',
        JWT_SECRET: 'this-is-a-very-long-secret-key-for-jwt-signing',
        NODE_ENV: 'development',
        PORT: '3000',
      };

      const result = envSchema.safeParse(validEnv);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.PORT).toBe(3000);
        expect(result.data.NODE_ENV).toBe('development');
      }
    });

    it('should accept optional OPENAI_API_KEY', () => {
      const envWithOpenAI = {
        POSTGRES_URL: 'postgresql://user:pass@localhost:5432/db',
        REDIS_URL: 'redis://localhost:6379',
        S3_ENDPOINT: 'https://s3.amazonaws.com',
        S3_ACCESS_KEY: 'test-access-key',
        S3_SECRET_KEY: 'test-secret-key',
        JWT_SECRET: 'this-is-a-very-long-secret-key-for-jwt-signing',
        NODE_ENV: 'development',
        PORT: '3000',
        OPENAI_API_KEY: 'sk-test-key',
      };

      const result = envSchema.safeParse(envWithOpenAI);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.OPENAI_API_KEY).toBe('sk-test-key');
      }
    });

    it('should work without OPENAI_API_KEY', () => {
      const envWithoutOpenAI = {
        POSTGRES_URL: 'postgresql://user:pass@localhost:5432/db',
        REDIS_URL: 'redis://localhost:6379',
        S3_ENDPOINT: 'https://s3.amazonaws.com',
        S3_ACCESS_KEY: 'test-access-key',
        S3_SECRET_KEY: 'test-secret-key',
        JWT_SECRET: 'this-is-a-very-long-secret-key-for-jwt-signing',
        NODE_ENV: 'development',
        PORT: '3000',
      };

      const result = envSchema.safeParse(envWithoutOpenAI);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.OPENAI_API_KEY).toBeUndefined();
      }
    });

    it('should validate URL formats', () => {
      const invalidUrls = {
        POSTGRES_URL: 'not-a-url',
        REDIS_URL: 'redis://localhost:6379',
        S3_ENDPOINT: 'https://s3.amazonaws.com',
        S3_ACCESS_KEY: 'test-access-key',
        S3_SECRET_KEY: 'test-secret-key',
        JWT_SECRET: 'this-is-a-very-long-secret-key-for-jwt-signing',
        NODE_ENV: 'development',
        PORT: '3000',
      };

      const result = envSchema.safeParse(invalidUrls);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            issue =>
              issue.path.includes('POSTGRES_URL') &&
              issue.message.includes('URL')
          )
        ).toBe(true);
      }
    });

    it('should validate JWT_SECRET minimum length', () => {
      const shortJwtSecret = {
        POSTGRES_URL: 'postgresql://user:pass@localhost:5432/db',
        REDIS_URL: 'redis://localhost:6379',
        S3_ENDPOINT: 'https://s3.amazonaws.com',
        S3_ACCESS_KEY: 'test-access-key',
        S3_SECRET_KEY: 'test-secret-key',
        JWT_SECRET: 'short',
        NODE_ENV: 'development',
        PORT: '3000',
      };

      const result = envSchema.safeParse(shortJwtSecret);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            issue =>
              issue.path.includes('JWT_SECRET') && issue.message.includes('32')
          )
        ).toBe(true);
      }
    });

    it('should validate NODE_ENV enum values', () => {
      const invalidNodeEnv = {
        POSTGRES_URL: 'postgresql://user:pass@localhost:5432/db',
        REDIS_URL: 'redis://localhost:6379',
        S3_ENDPOINT: 'https://s3.amazonaws.com',
        S3_ACCESS_KEY: 'test-access-key',
        S3_SECRET_KEY: 'test-secret-key',
        JWT_SECRET: 'this-is-a-very-long-secret-key-for-jwt-signing',
        NODE_ENV: 'invalid',
        PORT: '3000',
      };

      const result = envSchema.safeParse(invalidNodeEnv);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(issue => issue.path.includes('NODE_ENV'))
        ).toBe(true);
      }
    });

    it('should validate PORT as positive integer', () => {
      const invalidPorts = [
        { PORT: '-1' },
        { PORT: '0' },
        { PORT: 'abc' },
        { PORT: '3.14' },
        { PORT: '3000.5' },
      ];

      invalidPorts.forEach(invalidPort => {
        const envWithInvalidPort = {
          POSTGRES_URL: 'postgresql://user:pass@localhost:5432/db',
          REDIS_URL: 'redis://localhost:6379',
          S3_ENDPOINT: 'https://s3.amazonaws.com',
          S3_ACCESS_KEY: 'test-access-key',
          S3_SECRET_KEY: 'test-secret-key',
          JWT_SECRET: 'this-is-a-very-long-secret-key-for-jwt-signing',
          NODE_ENV: 'development',
          ...invalidPort,
        };

        const result = envSchema.safeParse(envWithInvalidPort);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(
            result.error.issues.some(issue => issue.path.includes('PORT'))
          ).toBe(true);
        }
      });
    });

    it('should provide default values', () => {
      const envWithoutDefaults = {
        POSTGRES_URL: 'postgresql://user:pass@localhost:5432/db',
        REDIS_URL: 'redis://localhost:6379',
        S3_ENDPOINT: 'https://s3.amazonaws.com',
        S3_ACCESS_KEY: 'test-access-key',
        S3_SECRET_KEY: 'test-secret-key',
        JWT_SECRET: 'this-is-a-very-long-secret-key-for-jwt-signing',
      };

      const result = envSchema.safeParse(envWithoutDefaults);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.NODE_ENV).toBe('development');
        expect(result.data.PORT).toBe(3000);
      }
    });
  });
});
