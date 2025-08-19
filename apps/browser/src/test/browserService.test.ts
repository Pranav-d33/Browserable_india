import { browserService } from '../services/browserService.js';
import { BrowserActionType } from '../types.js';

describe('BrowserService', () => {
  let sessionId: string;

  beforeEach(async () => {
    // Clean up any existing sessions before each test
    const sessions = await browserService.listSessions();
    for (const session of sessions) {
      try {
        await browserService.closeSession(session.sessionId);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  });

  afterEach(async () => {
    // Clean up after each test
    if (sessionId) {
      try {
        await browserService.closeSession(sessionId);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  });

  describe('Session Management', () => {
    it('should launch a new browser session', async () => {
      const result = await browserService.launchSession();

      expect(result).toHaveProperty('sessionId');
      expect(typeof result.sessionId).toBe('string');
      expect(result.sessionId.length).toBeGreaterThan(0);

      sessionId = result.sessionId;
    });

    it('should list active sessions', async () => {
      const result = await browserService.launchSession();
      sessionId = result.sessionId;

      const sessions = await browserService.listSessions();

      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBeGreaterThan(0);

      const session = sessions.find(s => s.sessionId === sessionId);
      expect(session).toBeDefined();
      expect(session?.isActive).toBe(true);
    });

    it('should close a browser session', async () => {
      const result = await browserService.launchSession();
      sessionId = result.sessionId;

      // Verify session exists
      const sessionsBefore = await browserService.listSessions();
      expect(sessionsBefore.find(s => s.sessionId === sessionId)).toBeDefined();

      // Close session
      await browserService.closeSession(sessionId);

      // Verify session is closed
      const sessionsAfter = await browserService.listSessions();
      expect(
        sessionsAfter.find(s => s.sessionId === sessionId)
      ).toBeUndefined();

      // Clear sessionId to prevent cleanup in afterEach
      sessionId = '';
    });

    it('should throw error when closing non-existent session', async () => {
      const nonExistentSessionId = 'non-existent-session-id';

      await expect(
        browserService.closeSession(nonExistentSessionId)
      ).rejects.toThrow('Session not found');
    });
  });

  describe('Action Execution', () => {
    beforeEach(async () => {
      const result = await browserService.launchSession();
      sessionId = result.sessionId;
    });

    it('should execute a navigate action', async () => {
      const action = await browserService.executeAction({
        sessionId,
        type: BrowserActionType.NAVIGATE,
        url: 'https://example.com',
      });

      expect(action).toHaveProperty('id');
      expect(action.type).toBe(BrowserActionType.NAVIGATE);
      expect(action.url).toBe('https://example.com');
      // The action status can be 'pending' or 'running' since it's executed asynchronously
      expect(['pending', 'running']).toContain(action.status);
    });

    it('should throw error for invalid session', async () => {
      await expect(
        browserService.executeAction({
          sessionId: 'invalid-session-id',
          type: BrowserActionType.NAVIGATE,
          url: 'https://example.com',
        })
      ).rejects.toThrow('Invalid or expired session');
    });
  });

  describe('Utility Methods', () => {
    it('should return supported browsers', () => {
      const browsers = browserService.getSupportedBrowsers();

      expect(Array.isArray(browsers)).toBe(true);
      expect(browsers).toContain('chromium');
      expect(browsers).toContain('firefox');
      expect(browsers).toContain('webkit');
    });
  });
});
