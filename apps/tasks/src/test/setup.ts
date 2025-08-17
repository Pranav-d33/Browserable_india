import { beforeAll, afterAll } from 'vitest';

// Set test environment
process.env.NODE_ENV = 'test';

// Mock environment variables for testing
process.env.POSTGRES_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.S3_ENDPOINT = 'http://localhost:9000';
process.env.S3_ACCESS_KEY = 'test';
process.env.S3_SECRET_KEY = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

beforeAll(async () => {
  // Setup test environment
  console.log('Setting up test environment...');
});

afterAll(async () => {
  // Cleanup test environment
  console.log('Cleaning up test environment...');
});
