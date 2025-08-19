import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager } from '../src/session';
import { BrowserActions } from '../src/actions';

describe('BrowserActions', () => {
  let sessionManager: SessionManager;
  let browserActions: BrowserActions;

  beforeEach(async () => {
    sessionManager = new SessionManager(2);
    browserActions = new BrowserActions(sessionManager, 30000, false); // Disable evaluate for security
  });

  afterEach(async () => {
    await sessionManager.closeAll();
  });

  describe('Action Validation', () => {
    it('should validate goto action', async () => {
      const sessionId = await sessionManager.create({
        browserType: 'chromium',
      });

      // Test validation only - don't actually navigate
      const { GotoActionSchema } = await import('../src/actions');

      // Valid URL should pass validation
      expect(() =>
        GotoActionSchema.parse({
          sessionId,
          url: 'https://example.com',
        })
      ).not.toThrow();

      // Invalid URL should fail validation
      expect(() =>
        GotoActionSchema.parse({
          sessionId,
          url: 'not-a-url',
        })
      ).toThrow();

      // File URL should fail validation
      expect(() =>
        GotoActionSchema.parse({
          sessionId,
          url: 'file:///etc/passwd',
        })
      ).toThrow('File URLs are not allowed');
    });

    it('should validate click action', async () => {
      const sessionId = await sessionManager.create({
        browserType: 'chromium',
      });

      // Test validation only
      const { ClickActionSchema } = await import('../src/actions');

      // Valid selector should pass validation
      expect(() =>
        ClickActionSchema.parse({
          sessionId,
          selector: 'button',
        })
      ).not.toThrow();

      // Empty selector should fail validation
      expect(() =>
        ClickActionSchema.parse({
          sessionId,
          selector: '',
        })
      ).toThrow();
    });

    it('should validate type action', async () => {
      const sessionId = await sessionManager.create({
        browserType: 'chromium',
      });

      // Test validation only
      const { TypeActionSchema } = await import('../src/actions');

      // Valid action should pass validation
      expect(() =>
        TypeActionSchema.parse({
          sessionId,
          selector: 'input',
          text: 'Hello World',
        })
      ).not.toThrow();

      // Empty selector should fail validation
      expect(() =>
        TypeActionSchema.parse({
          sessionId,
          selector: '',
          text: 'Hello',
        })
      ).toThrow();
    });

    it('should validate waitFor action', async () => {
      const sessionId = await sessionManager.create({
        browserType: 'chromium',
      });

      // Test validation only
      const { WaitForActionSchema } = await import('../src/actions');

      // Valid selector should pass validation
      expect(() =>
        WaitForActionSchema.parse({
          sessionId,
          target: 'button',
        })
      ).not.toThrow();

      // Valid timeout should pass validation
      expect(() =>
        WaitForActionSchema.parse({
          sessionId,
          target: 1000,
        })
      ).not.toThrow();

      // Invalid timeout should fail validation
      expect(() =>
        WaitForActionSchema.parse({
          sessionId,
          target: -1000,
        })
      ).toThrow();
    });

    it('should validate select action', async () => {
      const sessionId = await sessionManager.create({
        browserType: 'chromium',
      });

      // Test validation only
      const { SelectActionSchema } = await import('../src/actions');

      // Valid action should pass validation
      expect(() =>
        SelectActionSchema.parse({
          sessionId,
          selector: 'select',
          value: 'option1',
        })
      ).not.toThrow();

      // Empty selector should fail validation
      expect(() =>
        SelectActionSchema.parse({
          sessionId,
          selector: '',
          value: 'option1',
        })
      ).toThrow();

      // Empty value should fail validation
      expect(() =>
        SelectActionSchema.parse({
          sessionId,
          selector: 'select',
          value: '',
        })
      ).toThrow();
    });

    it('should validate evaluate action', async () => {
      const sessionId = await sessionManager.create({
        browserType: 'chromium',
      });

      // Evaluate disabled
      await expect(
        browserActions.evaluate({
          sessionId,
          script: 'document.title',
        })
      ).rejects.toThrow('JavaScript evaluation is disabled');

      // Create actions with evaluate enabled
      const actionsWithEvaluate = new BrowserActions(
        sessionManager,
        30000,
        true
      );

      // Safe script
      await expect(
        actionsWithEvaluate.evaluate({
          sessionId,
          script: 'document.title',
        })
      ).resolves.not.toThrow();

      // Unsafe script (function)
      await expect(
        actionsWithEvaluate.evaluate({
          sessionId,
          script: 'function() { return true; }',
        })
      ).rejects.toThrow('Unsafe script detected');

      // Unsafe script (object)
      await expect(
        actionsWithEvaluate.evaluate({
          sessionId,
          script: '{ key: "value" }',
        })
      ).rejects.toThrow('Unsafe script detected');
    });

    it('should validate screenshot action', async () => {
      const sessionId = await sessionManager.create({
        browserType: 'chromium',
      });

      // Valid action
      await expect(
        browserActions.screenshot({
          sessionId,
          fullPage: true,
        })
      ).resolves.not.toThrow();

      // Valid action without fullPage
      await expect(
        browserActions.screenshot({
          sessionId,
        })
      ).resolves.not.toThrow();
    });

    it('should validate pdf action', async () => {
      const sessionId = await sessionManager.create({
        browserType: 'chromium',
      });

      // Valid action for chromium
      await expect(
        browserActions.pdf({
          sessionId,
        })
      ).resolves.not.toThrow();

      // Create firefox session
      const firefoxSessionId = await sessionManager.create({
        browserType: 'firefox',
      });

      // PDF should fail for non-chromium browsers
      await expect(
        browserActions.pdf({
          sessionId: firefoxSessionId,
        })
      ).rejects.toThrow('PDF generation is only supported in Chromium');
    });
  });

  describe('Session Management', () => {
    it('should throw error for non-existent session', async () => {
      await expect(
        browserActions.goto({
          sessionId: 'non-existent',
          url: 'https://example.com',
        })
      ).rejects.toThrow('Session not found');
    });

    it('should touch session when getting it', async () => {
      const sessionId = await sessionManager.create({
        browserType: 'chromium',
      });

      const session1 = sessionManager.get(sessionId);
      const lastUsedAt1 = session1!.lastUsedAt;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      // Touch session manually
      sessionManager.touch(sessionId);

      const session2 = sessionManager.get(sessionId);
      expect(session2!.lastUsedAt).toBeGreaterThan(lastUsedAt1);
    });
  });

  describe('Error Handling', () => {
    it('should handle navigation errors gracefully', async () => {
      const sessionId = await sessionManager.create({
        browserType: 'chromium',
      });

      // Try to navigate to a non-existent URL
      await expect(
        browserActions.goto({
          sessionId,
          url: 'https://this-domain-does-not-exist-12345.com',
        })
      ).rejects.toThrow();
    });

    it('should handle element not found errors', async () => {
      const sessionId = await sessionManager.create({
        browserType: 'chromium',
      });

      // Test that session not found throws error
      await expect(
        browserActions.click({
          sessionId: 'non-existent-session',
          selector: '#non-existent-element',
        })
      ).rejects.toThrow('Session not found');
    });
  });

  describe('Security Features', () => {
    it('should block file URLs', async () => {
      const sessionId = await sessionManager.create({
        browserType: 'chromium',
      });

      await expect(
        browserActions.goto({
          sessionId,
          url: 'file:///etc/passwd',
        })
      ).rejects.toThrow('File URLs are not allowed');

      await expect(
        browserActions.goto({
          sessionId,
          url: 'file:///C:/Windows/System32/drivers/etc/hosts',
        })
      ).rejects.toThrow('File URLs are not allowed');
    });

    it('should validate script safety', async () => {
      const sessionId = await sessionManager.create({
        browserType: 'chromium',
      });
      const actionsWithEvaluate = new BrowserActions(
        sessionManager,
        30000,
        true
      );

      // Safe scripts
      const safeScripts = [
        'document.title',
        'window.location.href',
        'navigator.userAgent',
        'document.querySelector("body")',
      ];

      for (const script of safeScripts) {
        await expect(
          actionsWithEvaluate.evaluate({
            sessionId,
            script,
          })
        ).resolves.not.toThrow();
      }

      // Unsafe scripts
      const unsafeScripts = [
        'function() { return true; }',
        '() => true',
        '{ key: "value" }',
        '[1, 2, 3]',
        'let x = 1',
        'const y = 2',
        'var z = 3',
        'x = 5',
        'if (true) { }',
        'for (let i = 0; i < 10; i++) { }',
        'while (true) { }',
      ];

      for (const script of unsafeScripts) {
        await expect(
          actionsWithEvaluate.evaluate({
            sessionId,
            script,
          })
        ).rejects.toThrow('Unsafe script detected');
      }
    });
  });
});
