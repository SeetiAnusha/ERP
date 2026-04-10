import { Request, Response } from 'express';
import authService, { LoginRequest, RegisterRequest } from '../services/authService';
import { BusinessLogicError } from '../core/AppError';

export class AuthController {
  /**
   * Register a new user
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const registerData: RegisterRequest = req.body;
      
      const { user, verificationToken } = await authService.register(registerData);

      // In production, send verification email instead of returning token
      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please check your email for verification.',
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
          },
          // Remove this in production - send via email instead
          verificationToken: process.env.NODE_ENV === 'development' ? verificationToken : undefined,
        },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Registration failed',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

  /**
   * Login user
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const loginData: LoginRequest = req.body;
      
      const authResponse = await authService.login(loginData);

      // Set refresh token as HTTP-only cookie
      res.cookie('refreshToken', authResponse.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: authResponse.user,
          accessToken: authResponse.accessToken,
        },
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: error.message || 'Login failed',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
      
      if (!refreshToken) {
        throw new BusinessLogicError('Refresh token not provided');
      }

      const tokens = await authService.refreshToken(refreshToken);

      // Set new refresh token as HTTP-only cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: tokens.accessToken,
        },
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: error.message || 'Token refresh failed',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      
      const user = await authService.verifyEmail(token);

      res.status(200).json({
        success: true,
        message: 'Email verified successfully. Your account is now active.',
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            isActive: user.isActive,
            isEmailVerified: user.isEmailVerified,
          },
        },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Email verification failed',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;
      
      if (!email) {
        throw new BusinessLogicError('Email is required');
      }

      const resetToken = await authService.requestPasswordReset(email);

      res.status(200).json({
        success: true,
        message: 'If the email exists, a password reset link has been sent.',
        data: {
          // Remove this in production - send via email instead
          resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined,
        },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Password reset request failed',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

  /**
   * Reset password
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      const { password } = req.body;
      
      if (!password) {
        throw new BusinessLogicError('New password is required');
      }

      const user = await authService.resetPassword(token, password);

      res.status(200).json({
        success: true,
        message: 'Password reset successfully',
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
        },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Password reset failed',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        throw new BusinessLogicError('Current password and new password are required');
      }

      const user = await authService.changePassword(userId, currentPassword, newPassword);

      res.status(200).json({
        success: true,
        message: 'Password changed successfully',
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
        },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Password change failed',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

  /**
   * Logout user
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      res.status(200).json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Logout failed',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      
      if (!userId) {
        throw new BusinessLogicError('User not authenticated');
      }

      // Get user from database to ensure fresh data
      const User = require('../models/User').default;
      const user = await User.findByPk(userId, {
        attributes: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive', 'lastLoginAt', 'createdAt'],
      });

      if (!user) {
        throw new BusinessLogicError('User not found');
      }

      res.status(200).json({
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          user,
        },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to get profile',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { firstName, lastName } = req.body;
      
      if (!userId) {
        throw new BusinessLogicError('User not authenticated');
      }

      const User = require('../models/User').default;
      const user = await User.findByPk(userId);

      if (!user) {
        throw new BusinessLogicError('User not found');
      }

      // Update allowed fields
      if (firstName) user.firstName = firstName;
      if (lastName) user.lastName = lastName;

      await user.save();

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
          },
        },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Profile update failed',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

  /**
   * Sync all admin/manager roles (one-time setup)
   * This endpoint syncs all existing admin and manager users to user_roles table
   */
  async syncAdminManagerRoles(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      
      if (!userId) {
        throw new BusinessLogicError('User not authenticated');
      }

      // Check if user is admin
      const User = require('../models/User').default;
      const user = await User.findByPk(userId);

      if (!user || user.role !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'Only admins can sync user roles',
        });
        return;
      }

      const result = await authService.syncAllAdminManagerRoles();

      res.status(200).json({
        success: true,
        message: 'Admin and manager roles synced successfully',
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to sync roles',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }
}

export default new AuthController();