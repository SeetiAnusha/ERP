import { Router } from 'express';
import userRoleController from '../controllers/userRoleController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get all users with their roles (admin/manager only)
router.get('/users-with-roles', userRoleController.getAllUsersWithRoles);

// Search users by email or name
router.get('/search-users', userRoleController.searchUsers);

// Get available roles with default limits
router.get('/roles', userRoleController.getAvailableRoles);

// Assign role to user (by email)
router.post('/assign-role', userRoleController.assignRole);

// Update approval limit
router.put('/update-approval-limit', userRoleController.updateApprovalLimit);

// Remove role from user
router.delete('/remove-role', userRoleController.removeRole);

// Get current user's roles
router.get('/my-roles', userRoleController.getMyRoles);

// ✅ NEW: Get available approvers for deletion requests
router.get('/available-approvers', userRoleController.getAvailableApprovers);

export default router;
