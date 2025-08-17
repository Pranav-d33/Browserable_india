import { logger } from '@bharat-agents/shared';
import { chromium, Browser, BrowserContext } from 'playwright';

import { env } from '../env.js';
import {
  BrowserAction,
  BrowserActionType,
  BrowserActionStatus,
  BrowserActionResult,
  SessionId,
} from '../types.js';
import {
  validateNavigationURL,
  isNavigationAllowed,
  getURLValidationError,
} from '../utils/urlValidation.js';
import { generateId } from '../utils.js';

// Session management
interface BrowserSession {
  sessionId: SessionId;
  browser: Browser;
  context: BrowserContext;
  createdAt: Date;
  lastUsed: Date;
  isActive: boolean;
}

// In-memory storage for sessions and actions
const sessions: Map<SessionId, BrowserSession> = new Map();
const actions: Map<string, BrowserAction> = new Map();

// Configuration from environment
const SESSION_TIMEOUT_MINUTES = env.SESSION_TIMEOUT_MINUTES || 30;
const CLEANUP_INTERVAL_MS = (env.CLEANUP_INTERVAL_MINUTES || 5) * 60 * 1000;

// Supported browsers
const SUPPORTED_BROWSERS = ['chromium', 'firefox', 'webkit'] as const;

interface ActionFilters {
  page: number;
  limit: number;
  status?: BrowserActionStatus;
  type?: BrowserActionType;
}

interface ActionListResult {
  actions: BrowserAction[];
  total: number;
}

export const browserService = {
  // Session management methods
  async launchSession(): Promise<{ sessionId: SessionId }> {
    try {
      const sessionId = generateId() as SessionId;

      // Launch headless chromium
      const browser = await chromium.launch({
        headless: env.BROWSER_HEADLESS !== false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      });

      // Create a new context
      const context = await browser.newContext({
        viewport: {
          width: env.BROWSER_VIEWPORT_WIDTH || 1280,
          height: env.BROWSER_VIEWPORT_HEIGHT || 720,
        },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        // Security: Disable downloads by default
        acceptDownloads: env.ALLOW_DOWNLOADS,
        // Security: Enforce same-origin policy
        ignoreHTTPSErrors: false,
        // Security: Disable JavaScript evaluation unless explicitly allowed
        bypassCSP: false,
      });

      // Set up download blocking
      if (!env.ALLOW_DOWNLOADS) {
        context.on('page', page => {
          page.on('download', download => {
            logger.warn(
              {
                url: download.url(),
                filename: download.suggestedFilename(),
                sessionId,
              },
              'Download blocked by security policy'
            );
            download.cancel();
          });
        });
      }

      const session: BrowserSession = {
        sessionId,
        browser,
        context,
        createdAt: new Date(),
        lastUsed: new Date(),
        isActive: true,
      };

      sessions.set(sessionId, session);

      console.log(`🚀 Browser session launched: ${sessionId}`);
      return { sessionId };
    } catch (error) {
      console.error('Failed to launch browser session:', error);
      throw new Error(
        `Failed to launch browser session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },

  async closeSession(sessionId: SessionId): Promise<void> {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    try {
      await session.context.close();
      await session.browser.close();
      sessions.delete(sessionId);
      console.log(`🔒 Browser session closed: ${sessionId}`);
    } catch (error) {
      console.error(`Failed to close session ${sessionId}:`, error);
      throw new Error(
        `Failed to close session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },

  async getSession(sessionId: SessionId): Promise<BrowserSession | null> {
    const session = sessions.get(sessionId);
    if (session && session.isActive) {
      session.lastUsed = new Date();
      return session;
    }
    return null;
  },

  async listSessions(): Promise<
    Array<{
      sessionId: SessionId;
      createdAt: Date;
      lastUsed: Date;
      isActive: boolean;
    }>
  > {
    return Array.from(sessions.values()).map(session => ({
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      lastUsed: session.lastUsed,
      isActive: session.isActive,
    }));
  },

  // Cleanup methods
  async cleanupIdleSessions(): Promise<void> {
    const now = new Date();
    const timeoutMs = SESSION_TIMEOUT_MINUTES * 60 * 1000;

    for (const [sessionId, session] of sessions.entries()) {
      const idleTime = now.getTime() - session.lastUsed.getTime();

      if (idleTime > timeoutMs && session.isActive) {
        console.log(
          `🧹 Cleaning up idle session: ${sessionId} (idle for ${Math.round(idleTime / 60000)} minutes)`
        );
        try {
          await this.closeSession(sessionId);
        } catch (error) {
          console.error(`Failed to cleanup session ${sessionId}:`, error);
          // Mark as inactive if cleanup fails
          session.isActive = false;
        }
      }
    }
  },

  // Graceful shutdown
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down browser service...');

    const closePromises = Array.from(sessions.keys()).map(async sessionId => {
      try {
        await this.closeSession(sessionId);
      } catch (error) {
        console.error(
          `Error closing session ${sessionId} during shutdown:`,
          error
        );
      }
    });

    await Promise.allSettled(closePromises);
    console.log('✅ Browser service shutdown complete');
  },

  // Action execution methods (updated to use sessions)
  async executeAction(
    actionData: Partial<BrowserAction> & { sessionId: SessionId }
  ): Promise<BrowserAction> {
    const session = await this.getSession(actionData.sessionId);
    if (!session) {
      throw new Error(`Invalid or expired session: ${actionData.sessionId}`);
    }

    const now = new Date();
    const action: BrowserAction = {
      id: generateId(),
      type: actionData.type!,
      url: actionData.url!,
      selector: actionData.selector,
      action: actionData.action,
      data: actionData.data,
      screenshot: actionData.screenshot || false,
      createdAt: now,
      status: BrowserActionStatus.PENDING,
    };

    // Store the action
    actions.set(action.id, action);

    // Execute the action asynchronously
    this.executeActionAsync(action, session).catch(error => {
      console.error('Error executing action:', error);
      const failedAction = actions.get(action.id);
      if (failedAction) {
        failedAction.status = BrowserActionStatus.FAILED;
        failedAction.result = {
          success: false,
          error: error.message,
          timestamp: new Date(),
        };
        actions.set(action.id, failedAction);
      }
    });

    return action;
  },

  async executeActionAsync(
    action: BrowserAction,
    session: BrowserSession
  ): Promise<void> {
    let page = null;

    try {
      // Update status to running
      action.status = BrowserActionStatus.RUNNING;
      actions.set(action.id, action);

      // Create a new page in the session context
      page = await session.context.newPage();

      // Set timeout from environment
      page.setDefaultTimeout(env.BROWSER_TIMEOUT || 30000);

      const result: BrowserActionResult = {
        success: true,
        timestamp: new Date(),
      };

      // Execute action based on type
      switch (action.type) {
        case BrowserActionType.NAVIGATE: {
          // Validate URL before navigation
          const urlValidation = validateNavigationURL(action.url);
          if (!urlValidation.valid) {
            throw new Error(`Navigation blocked: ${urlValidation.reason}`);
          }

          const sanitizedUrl = urlValidation.sanitized || action.url;
          await page.goto(sanitizedUrl);
          result.data = { url: sanitizedUrl };
          break;
        }

        case BrowserActionType.CLICK:
          // Validate URL before navigation
          if (!isNavigationAllowed(action.url)) {
            throw new Error(
              `Navigation blocked: ${getURLValidationError(action.url)}`
            );
          }
          await page.goto(action.url);
          if (action.selector) {
            await page.click(action.selector);
            result.data = { selector: action.selector };
          }
          break;

        case BrowserActionType.TYPE:
          // Validate URL before navigation
          if (!isNavigationAllowed(action.url)) {
            throw new Error(
              `Navigation blocked: ${getURLValidationError(action.url)}`
            );
          }
          await page.goto(action.url);
          if (action.selector && action.data?.text) {
            await page.fill(action.selector, action.data.text as string);
            result.data = { selector: action.selector, text: action.data.text };
          }
          break;

        case BrowserActionType.SCREENSHOT: {
          // Validate URL before navigation
          if (!isNavigationAllowed(action.url)) {
            throw new Error(
              `Navigation blocked: ${getURLValidationError(action.url)}`
            );
          }
          await page.goto(action.url);
          const screenshot = await page.screenshot({ fullPage: true });
          result.screenshot = screenshot.toString('base64');
          result.data = { url: action.url };
          break;
        }

        case BrowserActionType.EXTRACT: {
          // Validate URL before navigation
          if (!isNavigationAllowed(action.url)) {
            throw new Error(
              `Navigation blocked: ${getURLValidationError(action.url)}`
            );
          }
          await page.goto(action.url);
          if (action.selector) {
            const text = await page.textContent(action.selector);
            result.data = { selector: action.selector, text };
          } else {
            const title = await page.title();
            const url = page.url();
            result.data = { title, url };
          }
          break;
        }

        case BrowserActionType.WAIT:
          // Validate URL before navigation
          if (!isNavigationAllowed(action.url)) {
            throw new Error(
              `Navigation blocked: ${getURLValidationError(action.url)}`
            );
          }
          await page.goto(action.url);
          if (action.selector) {
            await page.waitForSelector(action.selector);
            result.data = { selector: action.selector };
          } else if (action.data?.timeout) {
            await page.waitForTimeout(action.data.timeout as number);
            result.data = { timeout: action.data.timeout };
          }
          break;

        default:
          throw new Error(`Unsupported action type: ${action.type}`);
      }

      // Take screenshot if requested
      if (action.screenshot) {
        const screenshot = await page.screenshot({ fullPage: true });
        result.screenshot = screenshot.toString('base64');
      }

      // Update action with result
      action.status = BrowserActionStatus.COMPLETED;
      action.result = result;
      actions.set(action.id, action);
    } catch (error) {
      // Update action with error
      action.status = BrowserActionStatus.FAILED;
      action.result = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
      actions.set(action.id, action);
      throw error;
    } finally {
      // Clean up page but keep session alive
      if (page) await page.close();
    }
  },

  async getActions(filters: ActionFilters): Promise<ActionListResult> {
    let filteredActions = Array.from(actions.values());

    // Apply filters
    if (filters.status) {
      filteredActions = filteredActions.filter(
        action => action.status === filters.status
      );
    }

    if (filters.type) {
      filteredActions = filteredActions.filter(
        action => action.type === filters.type
      );
    }

    // Sort by creation date (newest first)
    filteredActions.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    // Apply pagination
    const total = filteredActions.length;
    const startIndex = (filters.page - 1) * filters.limit;
    const endIndex = startIndex + filters.limit;
    const paginatedActions = filteredActions.slice(startIndex, endIndex);

    return {
      actions: paginatedActions,
      total,
    };
  },

  async getAction(id: string): Promise<BrowserAction | null> {
    return actions.get(id) || null;
  },

  // Utility methods
  getSupportedBrowsers(): readonly string[] {
    return SUPPORTED_BROWSERS;
  },

  async getActionStatus(id: string): Promise<BrowserActionStatus | null> {
    const action = actions.get(id);
    return action ? action.status : null;
  },

  // Start periodic cleanup
  startCleanupScheduler(): void {
    setInterval(() => {
      this.cleanupIdleSessions().catch(error => {
        console.error('Error during cleanup:', error);
      });
    }, CLEANUP_INTERVAL_MS);

    console.log(
      `🧹 Started cleanup scheduler (runs every ${CLEANUP_INTERVAL_MS / 60000} minutes)`
    );
  },
};
