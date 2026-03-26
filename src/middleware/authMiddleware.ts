import { Request, Response, NextFunction } from 'express';
import authService from '../services/authService';

// Feature flag for authentication
const isAuthEnabled = (): boolean => {
  return process.env.AUTH_ENABLED === 'true';
};

/**
 * Authentication middleware
 * Validates JWT token and adds user info to request
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if authentication is enabled
    if (!isAuthEnabled()) {
      // If auth is disabled, skip authentication and continue
      return next();
    }

    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token is required',
      });
      return;
    }

    // Validate token
    const payload = await authService.validateToken(token);

    // Add user info to request
    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid or expired token';
    res.status(401).json({
      success: false,
      message: errorMessage,
    });
  }
};

/**
 * Optional authentication middleware
 * Adds user info to request if token is provided, but doesn't require it
 */
export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if authentication is enabled
    if (!isAuthEnabled()) {
      return next();
    }

    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (token) {
      try {
        // Validate token if provided
        const payload = await authService.validateToken(token);
        
        // Add user info to request
        req.user = {
          userId: payload.userId,
          email: payload.email,
          role: payload.role,
        };
      } catch (error) {
        // If token is invalid, continue without user info
        // Don't throw error for optional auth
      }
    }

    next();
  } catch (error: unknown) {
    // For optional auth, continue even if there's an error
    next();
  }
};

/**
 * Role-based authorization middleware
 * Requires specific roles to access the endpoint
 */
export const requireRole = (roles: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Check if authentication is enabled
      if (!isAuthEnabled()) {
        return next();
      }

      // Check if user is authenticated
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      // Convert single role to array
      const allowedRoles = Array.isArray(roles) ? roles : [roles];

      // Check if user has required role
      if (!allowedRoles.includes(req.user.role)) {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
        });
        return;
      }

      next();
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        message: 'Authorization check failed',
      });
    }
  };
};

/**
 * Admin only middleware
 */
export const requireAdmin = requireRole('admin');

/**
 * Manager or Admin middleware
 */
export const requireManagerOrAdmin = requireRole(['admin', 'manager']);

/**
 * Feature flag middleware to check if authentication is enabled
 */
export const checkAuthFeatureFlag = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!isAuthEnabled()) {
    res.status(503).json({
      success: false,
      message: 'Authentication feature is currently disabled',
    });
    return;
  }
  next();
};