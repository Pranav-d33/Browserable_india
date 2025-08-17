// Export all shared types and utilities
export * from './types';
export * from './utils';
export * from './constants';
export * from './logger';
export * from './errors';
export * from './browserClient';
export * from './agents';

// Export new modules (avoiding conflicts with existing types)
export {
  newId,
  newTypedId,
  newRunId,
  newNodeId,
  newUserId,
  isId,
  isTypedId,
  isRunId,
  isNodeId,
  isUserId,
  toTypedId,
  toRunId,
  toNodeId,
  toUserId,
  type Id,
} from './ids';

export {
  requireRole,
  requireAdmin,
  requireUser,
  requireService,
  optionalAuth,
  hasRole,
  hasAnyRole,
  hasAllRoles,
  type AuthenticatedRequest,
  type JWTPayload,
} from './rbac';

export * from './metrics';
export * from './otel';
export * from './costs';

// Export environment configuration only when explicitly requested
// This prevents automatic loading of environment validation
export { env, envSchema, type Env } from './env';
