import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Op } from 'sequelize';
import { User, UserCreationAttributes } from '../models/User';
import { BusinessLogicError } from '../core/AppError';

// JWT configuration
const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET: string = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN: string = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Validate JWT configuration
if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-in-production') {
  console.warn('  WARNING: Using default JWT_SECRET. Please set a secure JWT_SECRET in production!');
}

if (!JWT_REFRESH_SECRET || JWT_REFRESH_SECRET === 'your-refresh-secret-key') {
  console.warn('  WARNING: Using default JWT_REFRESH_SECRET. Please set a secure JWT_REFRESH_SECRET in production!');
}

// Interfaces
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: 'admin' | 'manager' | 'user' | 'readonly';
}

export interface AuthResponse {
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
  };
  accessToken: string;
  refreshToken: string;
}

export interface TokenPayload {
  userId: number;
  email: string;
  role: string;
  type: 'access' | 'refresh';
}

export class AuthService {
  private static readonly SALT_ROUNDS = 12;
  private static readonly PASSWORD_MIN_LENGTH = 8;
  private static readonly MAX_FAILED_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes

  // ✅ IMPROVEMENT: Single source of truth for role mapping
  private static readonly ROLE_MAPPING = {
    'admin': { roleName: 'CFO' as const, approvalLimit: 500000 },
    'manager': { roleName: 'Manager' as const, approvalLimit: 10000 }
  } as const;

  /**
   * Register a new user
   */
  async register(data: RegisterRequest): Promise<{ user: User; verificationToken: string }> {
    try {
      // Validate password strength
      this.validatePasswordStrength(data.password);

      // Check if user already exists
      const existingUser = await User.findOne({ where: { email: data.email } });
      if (existingUser) {
        throw new BusinessLogicError('User with this email already exists');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(data.password, AuthService.SALT_ROUNDS);

      // Generate email verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');

      // Create user
      const userData: UserCreationAttributes = {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || 'user',
        emailVerificationToken: verificationToken,
        lastPasswordChangeAt: new Date(),
      };

      const user = await User.create(userData);

      return { user, verificationToken };
    } catch (error: any) {
      throw new BusinessLogicError(`Registration failed: ${error.message}`);
    }
  }

  /**
   * Login user with email and password
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    try {
      // Find user by email
      const user = await User.findOne({ where: { email: data.email } });
      if (!user) {
        throw new BusinessLogicError('Invalid email or password');
      }

      // Check if account is locked
      if (user.isAccountLocked) {
        throw new BusinessLogicError('Account is temporarily locked due to too many failed attempts');
      }

      // Check if account is active
      if (!user.isActive) {
        throw new BusinessLogicError('Account is not activated. Please verify your email.');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
      if (!isPasswordValid) {
        // Increment failed attempts
        user.incrementFailedAttempts();
        await user.save();
        throw new BusinessLogicError('Invalid email or password');
      }

      // Reset failed attempts on successful login
      user.resetFailedAttempts();
      user.lastLoginAt = new Date();
      await user.save();

      // ✅ NEW: Auto-sync user role on login for admins and managers
      await this.syncUserRoleOnLogin(user);

      // Generate tokens
      const { accessToken, refreshToken } = this.generateTokens(user);

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
        },
        accessToken,
        refreshToken,
      };
    } catch (error: any) {
      throw new BusinessLogicError(`Login failed: ${error.message}`);
    }
  }

  /**
   * Auto-sync user role on login
   * Automatically creates/updates user_roles entry for admins and managers
   */
  private async syncUserRoleOnLogin(user: User): Promise<void> {
    try {
      // Only sync for admin and manager roles
      if (user.role !== 'admin' && user.role !== 'manager') {
        return;
      }

      // Import UserRole model
      const UserRole = (await import('../models/UserRole')).default;

      // ✅ IMPROVEMENT: Use constant instead of duplicating
      const mappedRole = AuthService.ROLE_MAPPING[user.role as keyof typeof AuthService.ROLE_MAPPING];
      if (!mappedRole) {
        return;
      }

      // Check if user already has this role in user_roles
      const existingRole = await UserRole.findOne({
        where: {
          user_id: user.id,
          role_name: mappedRole.roleName,
          is_active: true
        }
      });

      if (!existingRole) {
        // Create new role entry
        await UserRole.create({
          user_id: user.id,
          role_name: mappedRole.roleName,
          approval_limit: mappedRole.approvalLimit,
          can_delegate: user.role === 'admin', // Admins can delegate
          is_active: true
        });

        console.log(`✅ Auto-created ${mappedRole.roleName} role for ${user.email} (${user.role})`);
      } else {
        // Update existing role if needed
        let updated = false;
        
        if (existingRole.approval_limit !== mappedRole.approvalLimit) {
          existingRole.approval_limit = mappedRole.approvalLimit;
          updated = true;
        }
        
        if (existingRole.can_delegate !== (user.role === 'admin')) {
          existingRole.can_delegate = user.role === 'admin';
          updated = true;
        }

        if (updated) {
          await existingRole.save();
          console.log(`✅ Updated ${mappedRole.roleName} role for ${user.email} (${user.role})`);
        }
      }
    } catch (error: any) {
      // Log error but don't fail login
      console.error('⚠️ Failed to sync user role on login:', error.message);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // Ensure refresh secret is defined
      if (!JWT_REFRESH_SECRET) {
        throw new BusinessLogicError('JWT refresh secret is not configured');
      }

      // Verify refresh token
      const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as TokenPayload;
      
      if (payload.type !== 'refresh') {
        throw new BusinessLogicError('Invalid token type');
      }

      // Find user
      const user = await User.findByPk(payload.userId);
      if (!user || !user.isActive) {
        throw new BusinessLogicError('User not found or inactive');
      }

      // Generate new tokens
      const tokens = this.generateTokens(user);

      return tokens;
    } catch (error: any) {
      throw new BusinessLogicError(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Verify email with verification token
   */
  async verifyEmail(token: string): Promise<User> {
    try {
      const user = await User.findOne({ where: { emailVerificationToken: token } });
      if (!user) {
        throw new BusinessLogicError('Invalid verification token');
      }

      user.isEmailVerified = true;
      user.isActive = true; // Activate account after email verification
      user.emailVerificationToken = undefined;
      await user.save();

      return user;
    } catch (error: any) {
      throw new BusinessLogicError(`Email verification failed: ${error.message}`);
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<string> {
    try {
      const user = await User.findOne({ where: { email } });
      if (!user) {
        // Don't reveal if email exists
        return 'If the email exists, a password reset link has been sent';
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      user.passwordResetToken = resetToken;
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save();

      return resetToken;
    } catch (error: any) {
      throw new BusinessLogicError(`Password reset request failed: ${error.message}`);
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<User> {
    try {
      const user = await User.findOne({
        where: {
          passwordResetToken: token,
        },
      });

      if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
        throw new BusinessLogicError('Invalid or expired reset token');
      }

      // Validate new password
      this.validatePasswordStrength(newPassword);

      // Check password history
      const isPasswordReused = await this.checkPasswordHistory(user, newPassword);
      if (isPasswordReused) {
        throw new BusinessLogicError('Cannot reuse any of the last 5 passwords');
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, AuthService.SALT_ROUNDS);

      // Add old password to history
      user.addPasswordToHistory(user.passwordHash);

      // Update user
      user.passwordHash = passwordHash;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      user.lastPasswordChangeAt = new Date();
      user.resetFailedAttempts(); // Reset any lockout
      await user.save();

      return user;
    } catch (error: any) {
      throw new BusinessLogicError(`Password reset failed: ${error.message}`);
    }
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<User> {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new BusinessLogicError('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        throw new BusinessLogicError('Current password is incorrect');
      }

      // Validate new password
      this.validatePasswordStrength(newPassword);

      // Check password history
      const isPasswordReused = await this.checkPasswordHistory(user, newPassword);
      if (isPasswordReused) {
        throw new BusinessLogicError('Cannot reuse any of the last 5 passwords');
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, AuthService.SALT_ROUNDS);

      // Add old password to history
      user.addPasswordToHistory(user.passwordHash);

      // Update user
      user.passwordHash = passwordHash;
      user.lastPasswordChangeAt = new Date();
      await user.save();

      return user;
    } catch (error: any) {
      throw new BusinessLogicError(`Password change failed: ${error.message}`);
    }
  }

  /**
   * Validate JWT token
   */
  async validateToken(token: string): Promise<TokenPayload> {
    try {
      // Ensure secret is defined
      if (!JWT_SECRET) {
        throw new BusinessLogicError('JWT secret is not configured');
      }

      const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
      
      if (payload.type !== 'access') {
        throw new BusinessLogicError('Invalid token type');
      }

      // Verify user still exists and is active
      const user = await User.findByPk(payload.userId);
      if (!user || !user.isActive) {
        throw new BusinessLogicError('User not found or inactive');
      }

      return payload;
    } catch (error: any) {
      throw new BusinessLogicError(`Token validation failed: ${error.message}`);
    }
  }

  /**
   * Generate JWT tokens
   */
  private generateTokens(user: User): { accessToken: string; refreshToken: string } {
    // Ensure secrets are defined
    if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
      throw new BusinessLogicError('JWT secrets are not configured');
    }

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(
      { ...payload, type: 'access' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
      { ...payload, type: 'refresh' },
      JWT_REFRESH_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions
    );

    return { accessToken, refreshToken };
  }

  /**
   * Validate password strength
   */
  private validatePasswordStrength(password: string): void {
    if (password.length < AuthService.PASSWORD_MIN_LENGTH) {
      throw new BusinessLogicError(`Password must be at least ${AuthService.PASSWORD_MIN_LENGTH} characters long`);
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUppercase || !hasLowercase || !hasNumbers || !hasSpecialChar) {
      throw new BusinessLogicError(
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      );
    }

    // Check against common passwords (simplified check)
    const commonPasswords = ['password', '123456', 'qwerty', 'admin', 'letmein'];
    if (commonPasswords.includes(password.toLowerCase())) {
      throw new BusinessLogicError('Password is too common. Please choose a stronger password.');
    }
  }

  /**
   * Check if password was used in history
   */
  private async checkPasswordHistory(user: User, newPassword: string): Promise<boolean> {
    if (!user.passwordHistory || user.passwordHistory.length === 0) {
      return false;
    }

    for (const oldPasswordHash of user.passwordHistory) {
      const isMatch = await bcrypt.compare(newPassword, oldPasswordHash);
      if (isMatch) {
        return true;
      }
    }

    return false;
  }

  /**
   * Sync all existing admin and manager users to user_roles table
   * This is a one-time setup method to populate user_roles for existing users
   * ✅ OPTIMIZED: Uses batch processing to avoid N+1 query problem
   */
  async syncAllAdminManagerRoles(): Promise<{ synced: number; skipped: number; errors: number }> {
    try {
      const UserRole = (await import('../models/UserRole')).default;
      
      // Find all admin and manager users
      const adminManagerUsers = await User.findAll({
        where: {
          role: { [Op.in]: ['admin', 'manager'] },
          isActive: true
        }
      });

      if (adminManagerUsers.length === 0) {
        console.log('📊 No admin/manager users found to sync');
        return { synced: 0, skipped: 0, errors: 0 };
      }

      // ✅ IMPROVEMENT: Fetch ALL existing roles in ONE query (avoid N+1)
      const userIds = adminManagerUsers.map(u => u.id);
      const existingRoles = await UserRole.findAll({
        where: {
          user_id: { [Op.in]: userIds },
          is_active: true
        }
      });

      // Create a Map for O(1) lookup
      const existingRolesMap = new Map<number, Set<string>>();
      existingRoles.forEach(role => {
        if (!existingRolesMap.has(role.user_id)) {
          existingRolesMap.set(role.user_id, new Set());
        }
        existingRolesMap.get(role.user_id)!.add(role.role_name);
      });

      // Prepare bulk insert data
      const rolesToCreate: any[] = [];
      let synced = 0;
      let skipped = 0;

      for (const user of adminManagerUsers) {
        try {
          // ✅ IMPROVEMENT: Use constant instead of duplicating
          const mappedRole = AuthService.ROLE_MAPPING[user.role as keyof typeof AuthService.ROLE_MAPPING];
          if (!mappedRole) {
            skipped++;
            continue;
          }

          // O(1) lookup instead of database query
          const userRoles = existingRolesMap.get(user.id);
          if (userRoles && userRoles.has(mappedRole.roleName)) {
            skipped++;
            continue;
          }

          rolesToCreate.push({
            user_id: user.id,
            role_name: mappedRole.roleName,
            approval_limit: mappedRole.approvalLimit,
            can_delegate: user.role === 'admin',
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          });
          synced++;
        } catch (error: any) {
          console.error(`❌ Failed to prepare sync for user ${user.email}:`, error.message);
        }
      }

      // ✅ IMPROVEMENT: Bulk insert in ONE query
      if (rolesToCreate.length > 0) {
        await UserRole.bulkCreate(rolesToCreate);
        console.log(`✅ Bulk created ${rolesToCreate.length} user roles`);
      }

      console.log(`\n📊 Sync Summary: ${synced} synced, ${skipped} skipped, 0 errors`);
      return { synced, skipped, errors: 0 };
    } catch (error: any) {
      console.error('❌ Bulk sync failed:', error.message);
      throw new BusinessLogicError(`Failed to sync admin/manager roles: ${error.message}`);
    }
  }
}

export default new AuthService();