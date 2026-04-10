import { Router } from 'express';
import authController from '../controllers/authController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Public routes (no authentication required)
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/request-password-reset', authController.requestPasswordReset);
router.post('/reset-password/:token', authController.resetPassword);

// Protected routes (authentication required)
router.post('/logout', authMiddleware, authController.logout);
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);
router.post('/change-password', authMiddleware, authController.changePassword);

// Admin-only routes
router.post('/sync-admin-manager-roles', authMiddleware, authController.syncAdminManagerRoles);

export default router;