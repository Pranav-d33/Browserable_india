import { logger } from '@bharat-agents/shared';
import {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  BrowserType,
  chromium,
  firefox,
  webkit,
} from 'playwright';
import { v4 as uuidv4 } from 'uuid';

import { SessionStore, createSessionStore } from './sessionStore.js';

export interface Session {
  id: string;
  browserType: 'chromium' | 'firefox' | 'webkit';
  browser: Browser;
  context: BrowserContext;
  createdAt: number;
  lastUsedAt: number;
  tags?: string[];
}

export interface CreateSessionOptions {
  browserType: 'chromium' | 'firefox' | 'webkit';
  userAgent?: string;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
}

export class SessionManager {
  private sessionStore: SessionStore;
  private semaphore: number;
  private maxConcurrent: number;

  constructor(
    maxConcurrent: number = 4,
    sessionStoreType: 'memory' | 'redis' = 'memory'
  ) {
    this.maxConcurrent = maxConcurrent;
    this.semaphore = maxConcurrent;
    this.sessionStore = createSessionStore(sessionStoreType);
  }

  /**
   * Create a new browser session
   */
  async create(options: CreateSessionOptions): Promise<string> {
    // Check semaphore
    if (this.semaphore <= 0) {
      throw new Error('Maximum concurrent sessions reached');
    }

    try {
      this.semaphore--;

      const browserType = this.getBrowserType(options.browserType);

      // Launch browser with security flags
      const browser = await browserType.launch({
        args: [
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
        ],
        headless: true,
      });

      // Create context with options
      const contextOptions: BrowserContextOptions = {
        userAgent: options.userAgent,
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true,
        bypassCSP: true,
      };

      if (options.proxy) {
        contextOptions.proxy = options.proxy;
      }

      const context = await browser.newContext(contextOptions);

      // Set up security restrictions
      await context.addInitScript(() => {
        // Block file:// URLs
        if (window.location.protocol === 'file:') {
          throw new Error('File URLs are not allowed');
        }

        // Block about:blank navigations
        if (window.location.href === 'about:blank') {
          throw new Error('about:blank navigations are not allowed');
        }
      });

      const sessionId = uuidv4();
      const session: Session = {
        id: sessionId,
        browserType: options.browserType,
        browser,
        context,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        tags: [],
      };

      this.sessionStore.set(sessionId, session);

      logger.info('Browser session created', {
        sessionId,
        browserType: options.browserType,
        activeSessions: this.sessionStore.size(),
      });

      return sessionId;
    } catch (error) {
      this.semaphore++;
      throw error;
    }
  }

  /**
   * Get a session by ID
   */
  get(id: string): Session | undefined {
    const session = this.sessionStore.get(id);
    if (session) {
      session.lastUsedAt = Date.now();
      this.sessionStore.set(id, session); // Update lastUsedAt
    }
    return session;
  }

  /**
   * Close a specific session
   */
  async close(id: string): Promise<boolean> {
    const session = this.sessionStore.get(id);
    if (!session) {
      return false;
    }

    try {
      await session.context.close();
      await session.browser.close();
      this.sessionStore.delete(id);
      this.semaphore++;

      logger.info('Browser session closed', { sessionId: id });
      return true;
    } catch (error) {
      logger.error('Error closing session', { sessionId: id, error });
      return false;
    }
  }

  /**
   * Touch a session to update lastUsedAt
   */
  touch(id: string): boolean {
    const session = this.sessionStore.get(id);
    if (session) {
      session.lastUsedAt = Date.now();
      this.sessionStore.set(id, session);
      return true;
    }
    return false;
  }

  /**
   * List all sessions
   */
  list(): Session[] {
    return this.sessionStore.list();
  }

  /**
   * Close idle sessions
   */
  async closeIdle(maxIdleMs: number): Promise<number> {
    const now = Date.now();
    const toClose: string[] = [];

    for (const session of this.sessionStore.list()) {
      if (now - session.lastUsedAt > maxIdleMs) {
        toClose.push(session.id);
      }
    }

    let closedCount = 0;
    for (const id of toClose) {
      if (await this.close(id)) {
        closedCount++;
      }
    }

    if (closedCount > 0) {
      logger.info('Closed idle sessions', {
        closedCount,
        remainingSessions: this.sessionStore.size(),
      });
    }

    return closedCount;
  }

  /**
   * Close all sessions
   */
  async closeAll(): Promise<void> {
    const sessionIds = this.sessionStore.list().map(session => session.id);

    logger.info('Closing all sessions', { count: sessionIds.length });

    await Promise.all(sessionIds.map(id => this.close(id)));

    // Reset semaphore
    this.semaphore = this.maxConcurrent;
  }

  /**
   * Get current semaphore count
   */
  getSemaphoreCount(): number {
    return this.semaphore;
  }

  /**
   * Get max concurrent sessions
   */
  getMaxConcurrent(): number {
    return this.maxConcurrent;
  }

  /**
   * Get active session count
   */
  getActiveCount(): number {
    return this.sessionStore.size();
  }

  /**
   * Get browser type instance
   */
  private getBrowserType(type: 'chromium' | 'firefox' | 'webkit'): BrowserType {
    switch (type) {
      case 'chromium':
        return chromium;
      case 'firefox':
        return firefox;
      case 'webkit':
        return webkit;
      default:
        throw new Error(`Unsupported browser type: ${type}`);
    }
  }
}
