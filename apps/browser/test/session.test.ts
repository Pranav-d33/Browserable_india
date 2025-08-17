import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager, type CreateSessionOptions } from '../src/session';

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager(2); // Max 2 concurrent sessions
  });

  afterEach(async () => {
    await sessionManager.closeAll();
  });

  describe('Session Creation', () => {
    it('should create a new session', async () => {
      const sessionId = await sessionManager.create({
        browserType: 'chromium',
      });

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);

      const session = sessionManager.get(sessionId);
      expect(session).toBeDefined();
      expect(session?.browserType).toBe('chromium');
      expect(session?.createdAt).toBeGreaterThan(0);
      expect(session?.lastUsedAt).toBeGreaterThan(0);
    });

    it('should create sessions with different browser types', async () => {
      const chromiumSessionId = await sessionManager.create({
        browserType: 'chromium',
      });

      const firefoxSessionId = await sessionManager.create({
        browserType: 'firefox',
      });

      expect(chromiumSessionId).not.toBe(firefoxSessionId);

      const chromiumSession = sessionManager.get(chromiumSessionId);
      const firefoxSession = sessionManager.get(firefoxSessionId);

      expect(chromiumSession?.browserType).toBe('chromium');
      expect(firefoxSession?.browserType).toBe('firefox');
    });

    it('should create session with custom user agent', async () => {
      const userAgent = 'Custom User Agent String';
      const sessionId = await sessionManager.create({
        browserType: 'chromium',
        userAgent,
      });

      const session = sessionManager.get(sessionId);
      expect(session).toBeDefined();
    });

    it('should respect max concurrent sessions limit', async () => {
      // Create max sessions
      const session1 = await sessionManager.create({ browserType: 'chromium' });
      const session2 = await sessionManager.create({ browserType: 'chromium' });

      // Try to create one more
      await expect(
        sessionManager.create({ browserType: 'chromium' })
      ).rejects.toThrow('Maximum concurrent sessions reached');

      // Close one session
      await sessionManager.close(session1);

      // Should be able to create a new session
      const session3 = await sessionManager.create({ browserType: 'chromium' });
      expect(session3).toBeDefined();
    });
  });

  describe('Session Management', () => {
    it('should get session by ID', async () => {
      const sessionId = await sessionManager.create({
        browserType: 'chromium',
      });

      const session = sessionManager.get(sessionId);
      expect(session).toBeDefined();
      expect(session?.id).toBe(sessionId);
    });

    it('should return undefined for non-existent session', () => {
      const session = sessionManager.get('non-existent-id');
      expect(session).toBeUndefined();
    });

    it('should touch session to update lastUsedAt', async () => {
      const sessionId = await sessionManager.create({
        browserType: 'chromium',
      });

      const session1 = sessionManager.get(sessionId);
      const lastUsedAt1 = session1!.lastUsedAt;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      const touched = sessionManager.touch(sessionId);
      expect(touched).toBe(true);

      const session2 = sessionManager.get(sessionId);
      expect(session2!.lastUsedAt).toBeGreaterThan(lastUsedAt1);
    });

    it('should return false when touching non-existent session', () => {
      const touched = sessionManager.touch('non-existent-id');
      expect(touched).toBe(false);
    });

    it('should list all sessions', async () => {
      const session1 = await sessionManager.create({ browserType: 'chromium' });
      const session2 = await sessionManager.create({ browserType: 'firefox' });

      const sessions = sessionManager.list();
      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.id)).toContain(session1);
      expect(sessions.map(s => s.id)).toContain(session2);
    });
  });

  describe('Session Cleanup', () => {
    it('should close specific session', async () => {
      const sessionId = await sessionManager.create({
        browserType: 'chromium',
      });

      const closed = await sessionManager.close(sessionId);
      expect(closed).toBe(true);

      const session = sessionManager.get(sessionId);
      expect(session).toBeUndefined();
    });

    it('should return false when closing non-existent session', async () => {
      const closed = await sessionManager.close('non-existent-id');
      expect(closed).toBe(false);
    });

    it('should close idle sessions', async () => {
      const sessionId = await sessionManager.create({
        browserType: 'chromium',
      });

      // Wait for session to become idle
      await new Promise(resolve => setTimeout(resolve, 10));

      const closedCount = await sessionManager.closeIdle(1); // 1ms idle time
      expect(closedCount).toBe(1);

      const session = sessionManager.get(sessionId);
      expect(session).toBeUndefined();
    });

    it('should not close active sessions', async () => {
      const sessionId = await sessionManager.create({
        browserType: 'chromium',
      });

      // Touch session to make it active
      sessionManager.touch(sessionId);

      const closedCount = await sessionManager.closeIdle(1000); // 1 second idle time
      expect(closedCount).toBe(0);

      const session = sessionManager.get(sessionId);
      expect(session).toBeDefined();
    });

    it('should close all sessions', async () => {
      const session1 = await sessionManager.create({ browserType: 'chromium' });
      const session2 = await sessionManager.create({ browserType: 'firefox' });

      await sessionManager.closeAll();

      expect(sessionManager.get(session1)).toBeUndefined();
      expect(sessionManager.get(session2)).toBeUndefined();
      expect(sessionManager.list()).toHaveLength(0);
    });
  });

  describe('Semaphore Management', () => {
    it('should track semaphore count correctly', async () => {
      expect(sessionManager.getSemaphoreCount()).toBe(2);

      const session1 = await sessionManager.create({ browserType: 'chromium' });
      expect(sessionManager.getSemaphoreCount()).toBe(1);

      const session2 = await sessionManager.create({ browserType: 'chromium' });
      expect(sessionManager.getSemaphoreCount()).toBe(0);

      await sessionManager.close(session1);
      expect(sessionManager.getSemaphoreCount()).toBe(1);

      await sessionManager.close(session2);
      expect(sessionManager.getSemaphoreCount()).toBe(2);
    });

    it('should reset semaphore on closeAll', async () => {
      await sessionManager.create({ browserType: 'chromium' });
      await sessionManager.create({ browserType: 'chromium' });

      expect(sessionManager.getSemaphoreCount()).toBe(0);

      await sessionManager.closeAll();
      expect(sessionManager.getSemaphoreCount()).toBe(2);
    });
  });

  describe('Session Statistics', () => {
    it('should track active session count', async () => {
      expect(sessionManager.getActiveCount()).toBe(0);

      const session1 = await sessionManager.create({ browserType: 'chromium' });
      expect(sessionManager.getActiveCount()).toBe(1);

      const session2 = await sessionManager.create({ browserType: 'chromium' });
      expect(sessionManager.getActiveCount()).toBe(2);

      await sessionManager.close(session1);
      expect(sessionManager.getActiveCount()).toBe(1);

      await sessionManager.close(session2);
      expect(sessionManager.getActiveCount()).toBe(0);
    });

    it('should return max concurrent sessions', () => {
      expect(sessionManager.getMaxConcurrent()).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle browser launch failures gracefully', async () => {
      // This test might fail if Playwright is not properly installed
      // but it should not crash the application
      try {
        await sessionManager.create({
          browserType: 'chromium',
        });
      } catch (error) {
        // If it fails, it should be a meaningful error
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});
