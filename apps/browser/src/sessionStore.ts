import { logger } from '@bharat-agents/shared';

import { Session } from './session.js';

export interface SessionStore {
  get(sessionId: string): Session | undefined;
  set(sessionId: string, session: Session): void;
  delete(sessionId: string): boolean;
  list(): Session[];
  clear(): void;
  size(): number;
}

/**
 * In-memory session store implementation
 * TODO: Replace with Redis-based implementation in Phase 3
 */
export class InMemorySessionStore implements SessionStore {
  private sessions = new Map<string, Session>();

  get(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  set(sessionId: string, session: Session): void {
    this.sessions.set(sessionId, session);
    logger.debug({ sessionId }, 'Session stored in memory');
  }

  delete(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      logger.debug({ sessionId }, 'Session removed from memory');
    }
    return deleted;
  }

  list(): Session[] {
    return Array.from(this.sessions.values());
  }

  clear(): void {
    const count = this.sessions.size;
    this.sessions.clear();
    logger.info({ count }, 'All sessions cleared from memory');
  }

  size(): number {
    return this.sessions.size;
  }
}

/**
 * Session store factory
 * TODO: Add Redis implementation in Phase 3
 */
export function createSessionStore(
  type: 'memory' | 'redis' = 'memory'
): SessionStore {
  switch (type) {
    case 'memory':
      return new InMemorySessionStore();
    case 'redis':
      // TODO: Implement Redis-based session store in Phase 3
      logger.warn(
        'Redis session store not yet implemented, falling back to memory'
      );
      return new InMemorySessionStore();
    default:
      throw new Error(`Unsupported session store type: ${type}`);
  }
}
