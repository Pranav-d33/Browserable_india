import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { env } from '../env.js';
import { logger } from '@bharat-agents/shared';

// =============================================================================
// Types
// =============================================================================

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'admin' | 'user';
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

// =============================================================================
// JWT Utilities
// =============================================================================

export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '24h',
    issuer: 'bharat-agents',
    audience: 'bharat-agents-api',
  });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET, {
      issuer: 'bharat-agents',
      audience: 'bharat-agents-api',
    }) as JWTPayload;
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : 'Unknown error' }, 'JWT verification failed');
    return null;
  }
}

// =============================================================================
// Authentication Middleware
// =============================================================================

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'Authorization header with Bearer token is required',
    });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({
      error: 'Invalid token',
      message: 'The provided token is invalid or expired',
    });
    return;
  }

  req.user = payload;
  next();
}

// =============================================================================
// Authorization Middleware
// =============================================================================

export function requireRole(allowedRoles: ('admin' | 'user')[]): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User must be authenticated',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
        userRole: req.user.role,
      });
      return;
    }

    next();
  };
}

export const requireAdmin = requireRole(['admin']);
export const requireUser = requireRole(['admin', 'user']);

// =============================================================================
// Route Protection Helpers
// =============================================================================

export function isAdmin(req: AuthenticatedRequest): boolean {
  return req.user?.role === 'admin';
}

export function isUser(req: AuthenticatedRequest): boolean {
  return req.user?.role === 'user' || req.user?.role === 'admin';
}

export function getCurrentUserId(req: AuthenticatedRequest): string | null {
  return req.user?.userId || null;
}

// =============================================================================
// Development Authentication (for testing)
// =============================================================================

export function createDevToken(userId: string, email: string, role: 'admin' | 'user' = 'user'): string {
  if (env.NODE_ENV !== 'development') {
    throw new Error('Dev tokens can only be created in development mode');
  }

  return generateToken({
    userId,
    email,
    role,
  });
}
