import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { record, getAuditLogs, getAuditStats, type AuditEvent } from './audit.js';
import { PrismaClient } from '@prisma/client';

// Mock Prisma client
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
  })),
}));

// Mock logger
vi.mock('@bharat-agents/shared', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Audit Service', () => {
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = new PrismaClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('record', () => {
    it('should record an audit event successfully', async () => {
      const mockCreate = vi.fn().mockResolvedValue({ id: 'test-id' });
      mockPrisma.auditLog.create = mockCreate;

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

      await record(event);

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          runId: 'run-123',
          nodeId: 'node-456',
          userId: 'user-789',
          action: 'test_action',
          status: 'OK',
          durationMs: 150,
          payload: { test: 'data' },
          result: { success: true },
        },
      });
    });

    it('should handle missing optional fields', async () => {
      const mockCreate = vi.fn().mockResolvedValue({ id: 'test-id' });
      mockPrisma.auditLog.create = mockCreate;

      const event: AuditEvent = {
        runId: 'run-123',
        action: 'test_action',
        status: 'ERR',
        durationMs: 100,
      };

      await record(event);

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          runId: 'run-123',
          nodeId: null,
          userId: null,
          action: 'test_action',
          status: 'ERR',
          durationMs: 100,
          payload: null,
          result: null,
        },
      });
    });

    it('should redact sensitive information from payload', async () => {
      const mockCreate = vi.fn().mockResolvedValue({ id: 'test-id' });
      mockPrisma.auditLog.create = mockCreate;

      const event: AuditEvent = {
        runId: 'run-123',
        action: 'test_action',
        payload: {
          username: 'testuser',
          password: 'secretpassword',
          api_key: 'sk-1234567890',
          token: 'jwt-token-here',
          normalData: 'should remain',
        },
        status: 'OK',
        durationMs: 100,
      };

      await record(event);

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          payload: {
            username: 'testuser',
            password: '[REDACTED]',
            api_key: '[REDACTED]',
            token: '[REDACTED]',
            normalData: 'should remain',
          },
        }),
      });
    });

    it('should truncate large payloads', async () => {
      const mockCreate = vi.fn().mockResolvedValue({ id: 'test-id' });
      mockPrisma.auditLog.create = mockCreate;

      // Create a large payload (over 1MB when stringified)
      const largeArray = new Array(100000).fill('x'.repeat(20));
      const event: AuditEvent = {
        runId: 'run-123',
        action: 'test_action',
        payload: largeArray,
        status: 'OK',
        durationMs: 100,
      };

      await record(event);

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            _truncated: true,
            _originalLength: 100000,
            _message: expect.stringContaining('Array truncated'),
          }),
        }),
      });
    });

    it('should not throw error on database failure', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Database error'));
      mockPrisma.auditLog.create = mockCreate;

      const event: AuditEvent = {
        runId: 'run-123',
        action: 'test_action',
        status: 'OK',
        durationMs: 100,
      };

      // Should not throw
      await expect(record(event)).resolves.toBeUndefined();
    });
  });

  describe('getAuditLogs', () => {
    it('should retrieve audit logs with pagination', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          runId: 'run-123',
          nodeId: 'node-456',
          userId: 'user-789',
          action: 'test_action',
          status: 'OK',
          durationMs: 150,
          payload: { test: 'data' },
          result: { success: true },
          createdAt: new Date('2023-01-01T00:00:00Z'),
        },
        {
          id: 'log-2',
          runId: 'run-123',
          nodeId: null,
          userId: null,
          action: 'another_action',
          status: 'ERR',
          durationMs: 200,
          payload: null,
          result: null,
          createdAt: new Date('2023-01-02T00:00:00Z'),
        },
      ];

      const mockFindMany = vi.fn().mockResolvedValue(mockLogs);
      mockPrisma.auditLog.findMany = mockFindMany;

      const result = await getAuditLogs('run-123', undefined, 50);

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { runId: 'run-123' },
        take: 51, // limit + 1
        cursor: undefined,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          runId: true,
          nodeId: true,
          userId: true,
          action: true,
          status: true,
          durationMs: true,
          payload: true,
          result: true,
          createdAt: true,
        },
      });

      expect(result).toEqual({
        logs: mockLogs,
        nextCursor: undefined,
        hasMore: false,
      });
    });

    it('should handle cursor-based pagination', async () => {
      const mockLogs = new Array(51).fill(null).map((_, i) => ({
        id: `log-${i}`,
        runId: 'run-123',
        action: 'test_action',
        status: 'OK',
        durationMs: 100,
        createdAt: new Date(`2023-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`),
      }));

      const mockFindMany = vi.fn().mockResolvedValue(mockLogs);
      mockPrisma.auditLog.findMany = mockFindMany;

      const result = await getAuditLogs('run-123', 'cursor-123', 50);

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { runId: 'run-123' },
        take: 51,
        cursor: { id: 'cursor-123' },
        orderBy: { createdAt: 'desc' },
        select: expect.any(Object),
      });

      expect(result).toEqual({
        logs: mockLogs.slice(0, 50),
        nextCursor: 'log-49',
        hasMore: true,
      });
    });

    it('should cap limit at 100', async () => {
      const mockFindMany = vi.fn().mockResolvedValue([]);
      mockPrisma.auditLog.findMany = mockFindMany;

      await getAuditLogs('run-123', undefined, 150);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 101, // 100 + 1
        })
      );
    });
  });

  describe('getAuditStats', () => {
    it('should retrieve audit statistics', async () => {
      const mockCount = vi.fn()
        .mockResolvedValueOnce(100) // totalEvents
        .mockResolvedValueOnce(80)  // successCount
        .mockResolvedValueOnce(20); // errorCount

      const mockAggregate = vi.fn().mockResolvedValue({
        _avg: { durationMs: 150.5 },
      });

      const mockGroupBy = vi.fn().mockResolvedValue([
        { action: 'test_action', _count: { action: 50 } },
        { action: 'another_action', _count: { action: 30 } },
      ]);

      mockPrisma.auditLog.count = mockCount;
      mockPrisma.auditLog.aggregate = mockAggregate;
      mockPrisma.auditLog.groupBy = mockGroupBy;

      const result = await getAuditStats('run-123');

      expect(result).toEqual({
        totalEvents: 100,
        successCount: 80,
        errorCount: 20,
        averageDuration: 150.5,
        actions: [
          { action: 'test_action', count: 50 },
          { action: 'another_action', count: 30 },
        ],
      });
    });
  });
});
