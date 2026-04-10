import { Request, Response } from 'express';
import UserRoleManagementService from '../services/UserRoleManagementService';
import { BusinessLogicError } from '../core/AppError';

export class UserRoleController {
  /**
   * Get all users with their roles (admin/manager only)
   */
  async getAllUsersWithRoles(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      
      if (!userId) {
        // If auth is disabled, use a default admin user ID (1)
        const defaultUserId = process.env.AUTH_ENABLED === 'true' ? undefined : 1;
        
        if (!defaultUserId) {
          throw new BusinessLogicError('User not authenticated');
        }
        
        const users = await UserRoleManagementService.getAllUsersWithRoles(defaultUserId);
        
        res.status(200).json({
          success: true,
          message: 'Users retrieved successfully',
          data: users,
        });
        return;
      }

      const users = await UserRoleManagementService.getAllUsersWithRoles(userId);

      res.status(200).json({
        success: true,
        message: 'Users retrieved successfully',
        data: users,
      });
    } catch (error: any) {
      res.status(error.statusCode || 400).json({
        success: false,
        message: error.message || 'Failed to retrieve users',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

  /**
   * Search users by email or name
   */
  async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId || 1; // Default to user ID 1 if auth disabled
      const { q } = req.query;
      
      if (!q || typeof q !== 'string') {
        throw new BusinessLogicError('Search term is required');
      }

      const users = await UserRoleManagementService.searchUsers(q, userId);

      res.status(200).json({
        success: true,
        message: 'Search completed successfully',
        data: users,
      });
    } catch (error: any) {
      res.status(error.statusCode || 400).json({
        success: false,
        message: error.message || 'Search failed',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

  /**
   * Get available roles with default limits
   */
  async getAvailableRoles(req: Request, res: Response): Promise<void> {
    try {
      const roles = await UserRoleManagementService.getAvailableRoles();

      res.status(200).json({
        success: true,
        message: 'Roles retrieved successfully',
        data: roles,
      });
    } catch (error: any) {
      res.status(error.statusCode || 400).json({
        success: false,
        message: error.message || 'Failed to retrieve roles',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

  /**
   * Assign role to user (by email)
   */
  async assignRole(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId || 1; // Default to user ID 1 if auth disabled
      const { userEmail, roleName, customApprovalLimit, canDelegate } = req.body;
      
      if (!userEmail || !roleName) {
        throw new BusinessLogicError('User email and role name are required');
      }

      const result = await UserRoleManagementService.assignRole({
        userEmail,
        roleName,
        customApprovalLimit,
        canDelegate,
        assignedBy: userId,
      });

      res.status(201).json({
        success: true,
        message: result.message,
        data: result.userRole,
      });
    } catch (error: any) {
      res.status(error.statusCode || 400).json({
        success: false,
        message: error.message || 'Failed to assign role',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

  /**
   * Update approval limit for a user role
   */
  async updateApprovalLimit(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId || 1; // Default to user ID 1 if auth disabled
      const { targetUserId, roleId, newLimit, reason } = req.body;
      
      if (!targetUserId || !roleId || newLimit === undefined || !reason) {
        throw new BusinessLogicError('Target user ID, role ID, new limit, and reason are required');
      }

      const result = await UserRoleManagementService.updateApprovalLimit({
        userId: targetUserId,
        roleId,
        newLimit,
        changedBy: userId,
        reason,
      });

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error: any) {
      res.status(error.statusCode || 400).json({
        success: false,
        message: error.message || 'Failed to update approval limit',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

  /**
   * Remove role from user
   */
  async removeRole(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId || 1; // Default to user ID 1 if auth disabled
      const { targetUserId, roleId, reason } = req.body;
      
      if (!targetUserId || !roleId || !reason) {
        throw new BusinessLogicError('Target user ID, role ID, and reason are required');
      }

      const result = await UserRoleManagementService.removeRole(
        targetUserId,
        roleId,
        userId,
        reason
      );

      res.status(200).json({
        success: true,
        message: 'Role removed successfully',
      });
    } catch (error: any) {
      res.status(error.statusCode || 400).json({
        success: false,
        message: error.message || 'Failed to remove role',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

  /**
   * Get current user's roles
   */
  async getMyRoles(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId || 1; // Default to user ID 1 if auth disabled

      const roles = await UserRoleManagementService.getUserRoles(userId);
      
      // Also get basic user info
      const User = require('../models/User').default;
      const user = await User.findByPk(userId, {
        attributes: ['id', 'email', 'firstName', 'lastName', 'role']
      });

      res.status(200).json({
        success: true,
        message: 'Your roles retrieved successfully',
        data: {
          user: user ? {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            basicRole: user.role, // admin, manager, user, readonly
          } : null,
          approvalRoles: roles, // Staff, Manager, Controller, CFO, Board
        },
      });
    } catch (error: any) {
      res.status(error.statusCode || 400).json({
        success: false,
        message: error.message || 'Failed to retrieve roles',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

  /**
   * Get available approvers for deletion requests
   * ✅ PROFESSIONAL: Returns list of users filtered by SPECIFIC required role
   * - If requiredRole='Manager', shows only Managers
   * - If requiredRole='CFO', shows only CFOs
   * - This prevents user confusion and provides clarity
   */
  async getAvailableApprovers(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId || 1; // Default to user ID 1 if auth disabled
      const { amount, requiredRole } = req.query;

      const requiredAmount = amount ? parseFloat(amount as string) : undefined;
      const roleFilter = requiredRole ? (requiredRole as string) : undefined;

      const approvers = await UserRoleManagementService.getAvailableApprovers(
        userId, 
        requiredAmount,
        roleFilter // ✅ NEW: Filter by specific role
      );

      res.status(200).json({
        success: true,
        message: 'Available approvers retrieved successfully',
        data: approvers,
      });
    } catch (error: any) {
      res.status(error.statusCode || 400).json({
        success: false,
        message: error.message || 'Failed to retrieve approvers',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }
}

export default new UserRoleController();
