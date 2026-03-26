import { Router } from 'express';
import TransactionDeletionController from '../controllers/transactionDeletionController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();
const controller = new TransactionDeletionController();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route GET /api/transaction-deletion/reasons
 * @desc Get all available deletion reasons
 * @access Private
 */
router.get('/reasons', controller.getDeletionReasons);

/**
 * @route GET /api/transaction-deletion/available-transactions/:entityType
 * @desc Get available transactions for deletion by entity type
 * @access Private
 * @params entityType: string
 */
router.get('/available-transactions/:entityType', controller.getAvailableTransactions);

/**
 * @route POST /api/transaction-deletion/analyze-impact
 * @desc Analyze impact of deleting a transaction
 * @access Private
 * @body { entityType: string, entityId: number }
 */
router.post('/analyze-impact', controller.analyzeImpact);

/**
 * @route POST /api/transaction-deletion/request-approval
 * @desc Create a new deletion approval request
 * @access Private
 * @body { entityType: string, entityId: number, reason: string, deletionReasonCode: string, customMemo?: string }
 */
router.post('/request-approval', controller.createApprovalRequest);

/**
 * @route GET /api/transaction-deletion/pending-approvals
 * @desc Get pending approvals for current user
 * @access Private
 */
router.get('/pending-approvals', controller.getPendingApprovals);

/**
 * @route GET /api/transaction-deletion/test-auth
 * @desc Test authentication and user data
 * @access Private
 */
router.get('/test-auth', controller.testAuth);

/**
 * @route GET /api/transaction-deletion/my-requests
 * @desc Get approval requests created by current user
 * @access Private
 */
router.get('/my-requests', controller.getMyRequests);

/**
 * @route POST /api/transaction-deletion/process-step/:stepId
 * @desc Process an approval step (approve or reject)
 * @access Private
 * @params stepId: number
 * @body { decision: 'APPROVED' | 'REJECTED', notes?: string }
 */
router.post('/process-step/:stepId', controller.processApprovalStep);

/**
 * @route POST /api/transaction-deletion/execute/:requestId
 * @desc Execute an approved deletion request
 * @access Private
 * @params requestId: number
 */
router.post('/execute/:requestId', controller.executeApprovedDeletion);

/**
 * @route GET /api/transaction-deletion/statistics
 * @desc Get deletion statistics for dashboard
 * @access Private
 */
router.get('/statistics', controller.getDeletionStatistics);

export default router;