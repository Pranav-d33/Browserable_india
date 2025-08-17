// Vitest setup file for browser tests
import { vi } from 'vitest';

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  // Suppress console output during tests unless there's an error
  console.log = vi.fn();
  console.error = originalConsoleError; // Keep error logging
});

afterAll(() => {
  // Restore console methods
  console.log = originalConsoleLog;
});
