import { Request, Response, NextFunction } from 'express';
import { InsufficientPermissionError } from '../core/AppError';
import AuditLogService from '../services/reporting/AuditLogService';

/**
 * Role-Based Access Control (RBAC) Middleware
 * 
 * Defines roles and permissions for financial reporting operations.
 * Requirements: 13.1-13.12
 */

// Role definitions
export enum UserRole {
  VIEWER = 'VIEWER',
  ACCOUNTANT = 'ACCOUNTANT',
  ADMINISTRATOR = 'ADMINISTRATOR',
}

// Permission definitions
export enum Permission {
  VIEW_REPORTS = 'VIEW_REPORTS',
  EXPORT_REPORTS = 'EXPORT_REPORTS',
  CLOSE_PERIODS = 'CLOSE_PERIODS',
  REOPEN_PERIODS = 'REOPEN_PERIODS',
  REOPEN_LOCKED_PERIODS = 'REOPEN_LOCKED_PERIODS',
  VIEW_AUDIT_LOG = 'VIEW_AUDIT_LOG',
}

// Role-Permission mapping
const rolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.VIEWER]: [
    Permission.VIEW_REPORTS,
  ],
  [UserRole.ACCOUNTANT]: [
    Permission.VIEW_REPORTS,
    Permission.EXPORT_REPORTS,
    Permission.CLOSE_PERIODS,
    Permission.REOPEN_PERIODS,
  ],
  [UserRole.ADMINISTRATOR]: [
    Permission.VIEW_REPORTS,
    Permission.EXPORT_REPORTS,
    Permission.CLOSE_PERIODS,
    Permission.REOPEN_PERIODS,
    Permission.REOPEN_LOCKED_PERIODS,
    Permission.VIEW_AUDIT_LOG,
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = rolePermissions[role];
  return permissions ? permissions.includes(permission) : false;
}

/**
 * Middleware to check if user has required permission
 */
export function requirePermission(permission: Permission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get user from request (set by authentication middleware)
      const user = (req as any).user;

      if (!user) {
        throw new InsufficientPermissionError('VIEWER', 'NONE', 'access this resource');
      }

      const userRole = user.role as UserRole;

      // Check permission
      if (!hasPermission(userRole, permission)) {
        // Log authorization failure
        await AuditLogService.log({
          userId: user.id,
          actionType: 'AUTHORIZATION_FAILURE',
          resourceType: 'API_ENDPOINT',
          resourceId: req.path,
          details: {
            requiredPermission: permission,
            userRole,
            method: req.method,
          },
          ipAddress: req.ip,
          success: false,
        });

        throw new InsufficientPermissionError(
          permission,
          userRole,
          `access ${req.path}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to check if user has required role
 */
export function requireRole(requiredRole: UserRole) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if (!user) {
        throw new InsufficientPermissionError(requiredRole, 'NONE', 'access this resource');
      }

      const userRole = user.role as UserRole;

      // Check role hierarchy
      const roleHierarchy: Record<UserRole, number> = {
        [UserRole.VIEWER]: 1,
        [UserRole.ACCOUNTANT]: 2,
        [UserRole.ADMINISTRATOR]: 3,
      };

      const userLevel = roleHierarchy[userRole] || 0;
      const requiredLevel = roleHierarchy[requiredRole] || 0;

      if (userLevel < requiredLevel) {
        // Log authorization failure
        await AuditLogService.log({
          userId: user.id,
          actionType: 'AUTHORIZATION_FAILURE',
          resourceType: 'API_ENDPOINT',
          resourceId: req.path,
          details: {
            requiredRole,
            userRole,
            method: req.method,
          },
          ipAddress: req.ip,
          success: false,
        });

        throw new InsufficientPermissionError(requiredRole, userRole, `access ${req.path}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Get user role from request
 */
export function getUserRole(req: Request): UserRole {
  const user = (req as any).user;
  return user?.role || UserRole.VIEWER;
}

/**
 * Get user ID from request
 */
export function getUserId(req: Request): number {
  const user = (req as any).user;
  return user?.id;
}
