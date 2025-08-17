import { Request, Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';

import { env } from './env';

// Role definitions
export type Role = 'admin' | 'user' | 'service';

// JWT payload interface
export interface JWTPayload {
  sub: string;
  roles: Role[];
  iat: number;
  exp: number;
}

// Extended request interface with user info
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    roles: Role[];
  };
}

/**
 * Express middleware to require specific roles
 */
export function requireRole(requiredRoles: Role[]) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      // In development, allow insecure access if configured
      if (env.NODE_ENV === 'development' && env.ALLOW_INSECURE_DEV === 'true') {
        // Set default user for development
        req.user = {
          id: 'dev-user',
          roles: ['admin'],
        };
        return next();
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Missing or invalid authorization header',
        });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Verify JWT token
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(env.JWT_SECRET),
        {
          issuer: env.JWT_ISSUER || 'bharat-agents',
          audience: env.JWT_AUDIENCE || 'bharat-agents-api',
        }
      );

      // Cast payload to our custom type
      const jwtPayload = payload as unknown as JWTPayload;

      // Check if user has any of the required roles
      const hasRequiredRole = requiredRoles.some(role =>
        jwtPayload.roles.includes(role)
      );

      if (!hasRequiredRole) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Insufficient permissions. Required roles: ${requiredRoles.join(', ')}`,
        });
      }

      // Attach user info to request
      req.user = {
        id: jwtPayload.sub,
        roles: jwtPayload.roles,
      };

      next();
    } catch (error) {
      if (error instanceof Error) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or expired token',
        });
      }

      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Authentication error',
      });
    }
  };
}

/**
 * Middleware to require admin role
 */
export const requireAdmin = requireRole(['admin']);

/**
 * Middleware to require user role (admin or user)
 */
export const requireUser = requireRole(['admin', 'user']);

/**
 * Middleware to require service role
 */
export const requireService = requireRole(['service']);

/**
 * Optional authentication middleware - doesn't fail if no token
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(); // Continue without authentication
  }

  const token = authHeader.substring(7);

  jwtVerify(token, new TextEncoder().encode(env.JWT_SECRET), {
    issuer: env.JWT_ISSUER || 'bharat-agents',
    audience: env.JWT_AUDIENCE || 'bharat-agents-api',
  })
    .then(({ payload }) => {
      const jwtPayload = payload as unknown as JWTPayload;
      req.user = {
        id: jwtPayload.sub,
        roles: jwtPayload.roles,
      };
      next();
    })
    .catch(() => {
      // Token is invalid, but we continue without authentication
      next();
    });
}

/**
 * Helper to check if user has a specific role
 */
export function hasRole(userRoles: Role[], requiredRole: Role): boolean {
  return userRoles.includes(requiredRole);
}

/**
 * Helper to check if user has any of the required roles
 */
export function hasAnyRole(userRoles: Role[], requiredRoles: Role[]): boolean {
  return requiredRoles.some(role => userRoles.includes(role));
}

/**
 * Helper to check if user has all required roles
 */
export function hasAllRoles(userRoles: Role[], requiredRoles: Role[]): boolean {
  return requiredRoles.every(role => userRoles.includes(role));
}
