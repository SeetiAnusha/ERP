import { Request, Response } from 'express';
import TransactionImpactAnalysisService from '../services/TransactionImpactAnalysisService';
import ApprovalWorkflowService from '../services/ApprovalWorkflowService';
import TransactionDeletionService from '../services/TransactionDeletionService';
import TransactionDeletionReason from '../models/TransactionDeletionReason';
import { ValidationError, NotFoundError, BusinessLogicError } from '../core/AppError';

/**
 * Transaction Deletion Controller
 * 
 * Handles HTTP requests for transaction deletion workflow
 */
class TransactionDeletionController {
  private impactAnalysisService: TransactionImpactAnalysisService;
  private approvalWorkflowService: ApprovalWorkflowService;
  private transactionDeletionService: TransactionDeletionService;

  constructor() {
    this.impactAnalysisService = new TransactionImpactAnalysisService();
    this.approvalWorkflowService = new ApprovalWorkflowService();
    this.transactionDeletionService = new TransactionDeletionService();
  }

  /**
   * Get all available deletion reasons
   */
  getDeletionReasons = async (req: Request, res: Response): Promise<void> => {
    try {
      const reasons = await TransactionDeletionReason.findAll({
        where: { is_active: true },
        order: [['is_standard', 'DESC'], ['reason_name', 'ASC']]
      });

      res.json({
        success: true,
        data: reasons
      });
    } catch (error) {
      console.error('Error fetching deletion reasons:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch deletion reasons',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get available transactions for deletion by entity type
   */
  getAvailableTransactions = async (req: Request, res: Response): Promise<void> => {
    try {
      const { entityType } = req.params;

      if (!entityType) {
        res.status(400).json({
          success: false,
          message: 'Entity type is required'
        });
        return;
      }

      const transactions = await this.impactAnalysisService.getAvailableTransactions(entityType);

      res.json({
        success: true,
        data: transactions
      });
    } catch (error) {
      console.error('Error fetching available transactions:', error);
      
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        res.status(400).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to fetch available transactions',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  };

  /**
   * Analyze impact of deleting a transaction
   */
  analyzeImpact = async (req: Request, res: Response): Promise<void> => {
    try {
      const { entityType, entityId } = req.body;

      if (!entityType || !entityId) {
        res.status(400).json({
          success: false,
          message: 'Entity type and ID are required'
        });
        return;
      }

      const analysis = await this.impactAnalysisService.analyzeTransactionDeletion(
        entityType,
        parseInt(entityId)
      );

      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      console.error('Error analyzing impact:', error);
      
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        res.status(400).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to analyze impact',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  };

  /**
   * Create a new deletion approval request
   */
  createApprovalRequest = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        entityType,
        entityId,
        reason,
        deletionReasonCode,
        customMemo
      } = req.body;

      if (!entityType || !entityId || !reason || !deletionReasonCode) {
        res.status(400).json({
          success: false,
          message: 'Entity type, ID, reason, and deletion reason code are required'
        });
        return;
      }

      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
        return;
      }

      const approvalRequest = await this.approvalWorkflowService.createApprovalRequest({
        entityType,
        entityId: parseInt(entityId),
        requestedBy: userId,
        reason,
        deletionReasonCode,
        customMemo,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(201).json({
        success: true,
        message: 'Deletion approval request created successfully',
        data: {
          requestId: approvalRequest.id,
          requestNumber: approvalRequest.request_number,
          status: approvalRequest.status
        }
      });
    } catch (error) {
      console.error('Error creating approval request:', error);
      
      if (error instanceof ValidationError || error instanceof BusinessLogicError) {
        res.status(400).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to create approval request',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  };

  /**
   * Get pending approvals for current user
   */
  getPendingApprovals = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
        return;
      }

      const pendingApprovals = await this.approvalWorkflowService.getPendingApprovalsForUser(userId);

      res.json({
        success: true,
        data: pendingApprovals
      });
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch pending approvals',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get approval requests created by current user
   */
  getMyRequests = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
        return;
      }

      const myRequests = await this.approvalWorkflowService.getApprovalRequestsByUser(userId);

      res.json({
        success: true,
        data: myRequests
      });
    } catch (error) {
      console.error('Error fetching user requests:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user requests',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Process an approval step (approve or reject)
   */
  processApprovalStep = async (req: Request, res: Response): Promise<void> => {
    try {
      const { stepId } = req.params;
      const { decision, notes } = req.body;

      console.log('🔍 ProcessApprovalStep - Request data:', {
        stepId,
        decision,
        notes,
        userId: (req as any).user?.userId
      });

      if (!stepId || !decision) {
        console.log('❌ Missing stepId or decision');
        res.status(400).json({
          success: false,
          message: 'Step ID and decision are required'
        });
        return;
      }

      if (!['APPROVED', 'REJECTED'].includes(decision)) {
        console.log('❌ Invalid decision value:', decision);
        res.status(400).json({
          success: false,
          message: 'Decision must be either "APPROVED" or "REJECTED"'
        });
        return;
      }

      const userId = (req as any).user?.userId;
      if (!userId) {
        console.log('❌ No user ID found in request. Auth enabled?', process.env.AUTH_ENABLED);
        
        // If auth is disabled, use a default user ID for testing
        if (process.env.AUTH_ENABLED !== 'true') {
          console.log('🔧 Auth disabled, using default user ID 1 for testing');
          const defaultUserId = 1;
          
          await this.approvalWorkflowService.processApprovalStep({
            stepId: parseInt(stepId),
            approverId: defaultUserId,
            decision,
            notes,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          });

          console.log('✅ Approval step processed successfully with default user');
          res.json({
            success: true,
            message: `Approval step ${decision.toLowerCase()} successfully`
          });
          return;
        }
        
        res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
        return;
      }

      console.log('✅ Calling approvalWorkflowService.processApprovalStep');
      await this.approvalWorkflowService.processApprovalStep({
        stepId: parseInt(stepId),
        approverId: userId,
        decision,
        notes,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      console.log('✅ Approval step processed successfully');
      res.json({
        success: true,
        message: `Approval step ${decision.toLowerCase()} successfully`
      });
    } catch (error) {
      console.error('❌ Error processing approval step:', error);
      
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof BusinessLogicError) {
        console.log('📋 Business logic error:', error.message);
        res.status(400).json({
          success: false,
          message: error.message
        });
      } else {
        console.log('💥 Unexpected error:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to process approval step',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  };

  /**
   * Execute an approved deletion request
   */
  executeApprovedDeletion = async (req: Request, res: Response): Promise<void> => {
    try {
      const { requestId } = req.params;

      if (!requestId) {
        res.status(400).json({
          success: false,
          message: 'Request ID is required'
        });
        return;
      }

      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
        return;
      }

      await this.transactionDeletionService.executeApprovedDeletion({
        approvalRequestId: parseInt(requestId),
        executedBy: userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: 'Deletion executed successfully'
      });
    } catch (error) {
      console.error('Error executing deletion:', error);
      
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof BusinessLogicError) {
        res.status(400).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to execute deletion',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  };

  /**
   * Get deletion statistics for dashboard
   */
  getDeletionStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      // This would typically include various statistics
      // For now, return a placeholder response
      res.json({
        success: true,
        data: {
          totalRequests: 0,
          pendingRequests: 0,
          approvedRequests: 0,
          rejectedRequests: 0,
          executedDeletions: 0
        }
      });
    } catch (error) {
      console.error('Error fetching deletion statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch deletion statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Test authentication and user data
   */
  testAuth = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.userId;
      const userEmail = (req as any).user?.email;
      const userRole = (req as any).user?.role;
      
      console.log('🔍 Test Auth - Request user data:', {
        userId,
        userEmail,
        userRole,
        authEnabled: process.env.AUTH_ENABLED
      });

      res.json({
        success: true,
        data: {
          userId,
          userEmail,
          userRole,
          authEnabled: process.env.AUTH_ENABLED,
          hasUser: !!userId
        }
      });
    } catch (error) {
      console.error('Test auth error:', error);
      res.status(500).json({
        success: false,
        message: 'Test auth failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}

export default TransactionDeletionController;