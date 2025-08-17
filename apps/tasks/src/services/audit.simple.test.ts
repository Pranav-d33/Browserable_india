import { describe, it, expect } from 'vitest';
import { type AuditEvent } from './audit.js';

describe('Audit Service - Simple Tests', () => {
  it('should have correct AuditEvent interface', () => {
    const event: AuditEvent = {
      runId: 'run-123',
      nodeId: 'node-456',
      userId: 'user-789',
      action: 'test_action',
      payload: { test: 'data' },
      result: { success: true },
      status: 'OK',
      durationMs: 150,
    };

    expect(event.runId).toBe('run-123');
    expect(event.action).toBe('test_action');
    expect(event.status).toBe('OK');
    expect(event.durationMs).toBe(150);
  });

  it('should allow optional fields', () => {
    const minimalEvent: AuditEvent = {
      runId: 'run-123',
      action: 'test_action',
      status: 'ERR',
      durationMs: 100,
    };

    expect(minimalEvent.runId).toBe('run-123');
    expect(minimalEvent.nodeId).toBeUndefined();
    expect(minimalEvent.userId).toBeUndefined();
    expect(minimalEvent.payload).toBeUndefined();
    expect(minimalEvent.result).toBeUndefined();
  });

  it('should only allow valid status values', () => {
    // This test ensures TypeScript compilation works correctly
    const validStatuses: Array<'OK' | 'ERR'> = ['OK', 'ERR'];
    
    validStatuses.forEach(status => {
      const event: AuditEvent = {
        runId: 'run-123',
        action: 'test_action',
        status,
        durationMs: 100,
      };
      expect(event.status).toBe(status);
    });
  });
});
