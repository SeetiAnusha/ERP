import { Op } from 'sequelize';
import User from '../models/User';
import UserRole from '../models/UserRole';
import sequelize from '../config/database';
import { BusinessLogicError, ValidationError, NotFoundError, InsufficientPermissionError } from '../core/AppError';

interface AssignRoleRequest {
  userEmail: string;
  roleName: 'Staff' | 'Manager' | 'Controller' | 'CFO' | 'Board';
  customApprovalLimit?: number;
  canDelegate?: boolean;
  assignedBy: number;
}

interface UpdateApprovalLimitRequest {
  userId: number;
  roleId: number;
  newLimit: number;
  changedBy: number;
  reason: string;
}

interface UserWithRole {
  user_id: number;
  email: string;
  full_name: string;
  basic_role: string;
  role_id: number | null;
  role_display_name: string | null;
  approval_limit: number | null;
  can_delegate: boolean | null;
  assigned_at: Date | null;
  assigned_by_name: string | null;
}

class UserRoleManagementService {
  
  // ✅ IMPROVEMENT: Define once as static constant (no recreation on each call)
  private static readonly AVAILABLE_ROLES = [
    { role_name: 'Staff', default_approval_limit: 1000, description: 'Basic staff member with limited approval authority' },
    { role_name: 'Manager', default_approval_limit: 10000, description: 'Department manager with medium approval authority' },
    { role_name: 'Controller', default_approval_limit: 50000, description: 'Financial controller with high approval authority' },
    { role_name: 'CFO', default_approval_limit: 500000, description: 'Chief Financial Officer with very high approval authority' },
    { role_name: 'Board', default_approval_limit: 999999999, description: 'Board member with unlimited approval authority' }
  ] as const;

  // ✅ IMPROVEMENT: Default limits as constant
  private static readonly DEFAULT_LIMITS = {
    'Staff': 1000,
    'Manager': 10000,
    'Controller': 50000,
    'CFO': 500000,
    'Board': 999999999
  } as const;
  
  /**
   * Get all users with their roles (for admin/manager view)
   */
  async getAllUsersWithRoles(requestingUserId: number): Promise<UserWithRole[]> {
    // Check permission
    const hasPermission = await this.canManageUsers(requestingUserId);
    if (!hasPermission) {
      throw new InsufficientPermissionError('manager', 'user', 'view user roles');
    }

    const query = `
      SELECT 
        u.id as user_id,
        u.email,
        CONCAT(u.first_name, ' ', u.last_name) as full_name,
        u.role as basic_role,
        ur.id as role_id,
        ur.role_name as role_display_name,
        ur.approval_limit,
        ur.can_delegate,
        ur.created_at as assigned_at,
        NULL as assigned_by_name
      FROM auth_users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = TRUE
      WHERE u.is_active = TRUE
      ORDER BY u.email
    `;

    const [results] = await sequelize.query(query);
    return results as UserWithRole[];
  }

  /**
   * Search users by email or name (for easy assignment)
   */
  async searchUsers(searchTerm: string, requestingUserId: number) {
    const hasPermission = await this.canManageUsers(requestingUserId);
    if (!hasPermission) {
      throw new InsufficientPermissionError('manager', 'user', 'search users');
    }

    const users = await User.findAll({
      where: {
        [Op.or]: [
          { email: { [Op.like]: `%${searchTerm}%` } },
          { firstName: { [Op.like]: `%${searchTerm}%` } },
          { lastName: { [Op.like]: `%${searchTerm}%` } }
        ],
        isActive: true
      },
      attributes: ['id', 'email', 'firstName', 'lastName'],
      limit: 20
    });

    return users.map(user => ({
      user_id: user.id,
      email: user.email,
      full_name: `${user.firstName} ${user.lastName}`
    }));
  }

  /**
   * Assign role to user (by email, not manual user_id)
   */
  async assignRole(request: AssignRoleRequest) {
    // Verify assigner has permission
    const canAssign = await this.canManageUsers(request.assignedBy);
    if (!canAssign) {
      throw new InsufficientPermissionError('manager', 'user', 'assign roles');
    }

    // Get user by email
    const user = await User.findOne({
      where: { email: request.userEmail, isActive: true }
    });

    if (!user) {
      throw new NotFoundError('User not found with that email');
    }

    // Check if user already has this role
    const existing = await UserRole.findOne({
      where: {
        user_id: user.id,
        role_name: request.roleName,
        is_active: true
      }
    });

    if (existing) {
      throw new ValidationError('User already has this role');
    }

    // Get default approval limit based on role
    const defaultLimit = UserRoleManagementService.DEFAULT_LIMITS[request.roleName];

    // Create role assignment
    const userRole = await UserRole.create({
      user_id: user.id,
      role_name: request.roleName,
      approval_limit: request.customApprovalLimit || defaultLimit,
      can_delegate: request.canDelegate || false,
      is_active: true
    });

    // Log audit trail
    await this.logAudit({
      userId: user.id,
      roleId: userRole.id,
      actionType: 'assigned',
      newApprovalLimit: userRole.approval_limit,
      changedBy: request.assignedBy,
      changeReason: `Role ${request.roleName} assigned`
    });

    return { success: true, message: 'Role assigned successfully', userRole };
  }

  /**
   * Update approval limit (admin/manager can change)
   */
  async updateApprovalLimit(request: UpdateApprovalLimitRequest) {
    // Check permission
    const canModify = await this.canModifyLimits(request.changedBy);
    if (!canModify) {
      throw new InsufficientPermissionError('admin', 'user', 'modify approval limits');
    }

    // Get current role
    const currentRole = await UserRole.findOne({
      where: {
        user_id: request.userId,
        id: request.roleId,
        is_active: true
      }
    });

    if (!currentRole) {
      throw new NotFoundError('User role not found');
    }

    const oldLimit = currentRole.approval_limit;

    // Update limit
    currentRole.approval_limit = request.newLimit;
    await currentRole.save();

    // Audit log
    await this.logAudit({
      userId: request.userId,
      roleId: request.roleId,
      actionType: 'limit_changed',
      oldApprovalLimit: oldLimit,
      newApprovalLimit: request.newLimit,
      changedBy: request.changedBy,
      changeReason: request.reason
    });

    return { success: true, message: 'Approval limit updated successfully' };
  }

  /**
   * Get available roles (for dropdown)
   */
  async getAvailableRoles() {
    // ✅ IMPROVEMENT: Return reference to constant (no recreation)
    return UserRoleManagementService.AVAILABLE_ROLES;
  }

  /**
   * Check if user can manage other users
   */
  async canManageUsers(userId: number): Promise<boolean> {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        // If user not found, allow access for development (when auth is disabled)
        if (process.env.AUTH_ENABLED !== 'true') {
          return true;
        }
        return false;
      }

      // Admin and manager roles can manage users
      if (user.role === 'admin' || user.role === 'manager') {
        return true;
      }

      // Check if user has Manager, Controller, CFO, or Board role in user_roles
      const userRole = await UserRole.findOne({
        where: {
          user_id: userId,
          role_name: { [Op.in]: ['Manager', 'Controller', 'CFO', 'Board'] },
          is_active: true
        }
      });

      return !!userRole;
    } catch (error: any) {
      console.error('Error checking user permissions:', error.message);
      // If auth is disabled, allow access
      if (process.env.AUTH_ENABLED !== 'true') {
        return true;
      }
      return false;
    }
  }

  /**
   * Check if user can modify approval limits
   */
  async canModifyLimits(userId: number): Promise<boolean> {
    const user = await User.findByPk(userId);
    if (!user) return false;

    // Admin role can always modify limits
    if (user.role === 'admin') {
      return true;
    }

    // Check if user has Controller, CFO, or Board role
    const userRole = await UserRole.findOne({
      where: {
        user_id: userId,
        role_name: { [Op.in]: ['Controller', 'CFO', 'Board'] },
        is_active: true
      }
    });

    return !!userRole;
  }

  /**
   * Get user's effective approval limit
   */
  async getUserApprovalLimit(userId: number): Promise<number> {
    const userRole = await UserRole.findOne({
      where: { user_id: userId, is_active: true },
      order: [['approval_limit', 'DESC']] // Get highest limit if multiple roles
    });

    return userRole?.approval_limit || 0;
  }

  /**
   * Get user's roles
   */
  async getUserRoles(userId: number) {
    const userRoles = await UserRole.findAll({
      where: { user_id: userId, is_active: true },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'email', 'firstName', 'lastName']
      }]
    });

    return userRoles;
  }

  /**
   * Get available approvers for deletion requests
   * ✅ PROFESSIONAL FIX: Returns users who can approve based on their approval roles and limits
   * - Shows each person ONCE with their HIGHEST role only
   * - Excludes the requesting user completely
   * - Filters by approval limit if amount provided
   * - ✅ NEW: Filters by SPECIFIC required role for clarity (Manager shows only Managers, CFO shows only CFOs)
   */
  async getAvailableApprovers(requestingUserId: number, requiredAmount?: number, requiredRole?: string) {
    try {
      // ✅ Build role filter condition
      let roleFilterCondition = "AND role_name IN ('Manager', 'Controller', 'CFO', 'Board')";
      
      if (requiredRole) {
        // ✅ PROFESSIONAL: If specific role required, show only users with that EXACT role
        // Example: If CFO required, show only CFOs (not Managers or Controllers)
        roleFilterCondition = `AND role_name = '${requiredRole}'`;
      }

      // ✅ Get all active users with approval roles, showing HIGHEST role per user
      const query = `
        SELECT 
          u.id as user_id,
          u.email,
          CONCAT(u.first_name, ' ', u.last_name) as full_name,
          u.role as basic_role,
          ur.id as role_id,
          ur.role_name,
          ur.approval_limit,
          ur.can_delegate
        FROM auth_users u
        INNER JOIN (
          -- ✅ Subquery: Get HIGHEST approval limit per user (one role per person)
          SELECT 
            user_id,
            MAX(approval_limit) as max_approval_limit
          FROM user_roles
          WHERE is_active = TRUE
            ${roleFilterCondition}
          GROUP BY user_id
        ) max_roles ON u.id = max_roles.user_id
        INNER JOIN user_roles ur ON u.id = ur.user_id 
          AND ur.approval_limit = max_roles.max_approval_limit
          AND ur.is_active = TRUE
        WHERE u.is_active = TRUE
          AND u.id != ?  -- ✅ Exclude requesting user
        ORDER BY ur.approval_limit DESC, u.first_name ASC
      `;

      const [results] = await sequelize.query(query, {
        replacements: [requestingUserId] // Exclude requesting user
      });

      const approvers = results as any[];

      // ✅ If amount is provided, filter by approval limit
      if (requiredAmount !== undefined && requiredAmount > 0) {
        return approvers.filter(approver => approver.approval_limit >= requiredAmount);
      }

      return approvers;
    } catch (error: any) {
      console.error('Error getting available approvers:', error.message);
      return [];
    }
  }

  /**
   * Remove role from user
   */
  async removeRole(userId: number, roleId: number, removedBy: number, reason: string) {
    const canRemove = await this.canManageUsers(removedBy);
    if (!canRemove) {
      throw new InsufficientPermissionError('manager', 'user', 'remove roles');
    }

    const userRole = await UserRole.findOne({
      where: { id: roleId, user_id: userId }
    });

    if (!userRole) {
      throw new NotFoundError('Role not found');
    }

    userRole.is_active = false;
    await userRole.save();

    await this.logAudit({
      userId,
      roleId,
      actionType: 'removed',
      changedBy: removedBy,
      changeReason: reason
    });

    return { success: true };
  }

  /**
   * Audit logging
   */
  private async logAudit(data: {
    userId: number;
    roleId: number;
    actionType: 'assigned' | 'removed' | 'limit_changed' | 'role_modified';
    oldApprovalLimit?: number;
    newApprovalLimit?: number;
    changedBy: number;
    changeReason: string;
  }) {
    try {
      // Insert into audit_log table
      await sequelize.query(`
        INSERT INTO user_role_audit 
        (user_id, role_id, action_type, old_approval_limit, new_approval_limit, changed_by, change_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, {
        replacements: [
          data.userId,
          data.roleId,
          data.actionType,
          data.oldApprovalLimit || null,
          data.newApprovalLimit || null,
          data.changedBy,
          data.changeReason
        ]
      });

      console.log('✅ User Role Audit logged:', {
        timestamp: new Date().toISOString(),
        ...data
      });
    } catch (error: any) {
      // Log error but don't fail the operation
      console.error('❌ Failed to log audit:', error.message);
    }
  }
}

export default new UserRoleManagementService();
