import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database';
import ApprovalRequest from '../models/ApprovalRequest';
import ApprovalStep from '../models/ApprovalStep';
import UserRole from '../models/UserRole';
import User from '../models/User';
import TransactionDeletionReason from '../models/TransactionDeletionReason';
import TransactionAuditTrail from '../models/TransactionAuditTrail';
import TransactionImpactAnalysisService from './TransactionImpactAnalysisService';
import  transactionDeletionService  from './TransactionDeletionService.refactored';
import { BaseService } from '../core/BaseService';
import { ValidationError, NotFoundError, BusinessLogicError } from '../core/AppError';
import crypto from 'crypto';

interface CreateApprovalRequestData {
  entityType: string;
  entityId: number;
  requestedBy: number;
  reason: string;
  deletionReasonCode: string;
  customMemo?: string;
  ipAddress?: string;
  userAgent?: string;
  selectedApproverId?: number; // ✅ NEW: User-selected approver
}

interface ProcessApprovalStepData {
  stepId: number;
  approverId: number;
  decision: 'APPROVED' | 'REJECTED';
  notes?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Approval Workflow Service
 * 
 * Manages the complete approval workflow for transaction deletions.
 * Handles request creation, routing, processing, and execution.
 */
class ApprovalWorkflowService extends BaseService {
  private impactAnalysisService: TransactionImpactAnalysisService;

  constructor() {
    super();
    this.impactAnalysisService = new TransactionImpactAnalysisService();
  }

  /**
   * Create a new approval request for transaction deletion
   */
  async createApprovalRequest(data: CreateApprovalRequestData): Promise<ApprovalRequest> {
    return this.executeWithTransaction(async (transaction) => {
      // Validate input
      this.validateNumeric(data.entityId, 'Entity ID', { min: 1 });
      this.validateNumeric(data.requestedBy, 'Requested By', { min: 1 });
      this.validateRequired(data, ['reason'], 'Approval Request');
      this.validateRequired(data, ['deletionReasonCode'], 'Approval Request');

      // Check if deletion reason exists and requires memo
      const deletionReason = await TransactionDeletionReason.findOne({
        where: { reason_code: data.deletionReasonCode, is_active: true },
        transaction
      });

      if (!deletionReason) {
        throw new ValidationError(`Invalid deletion reason code: ${data.deletionReasonCode}`);
      }

      if (deletionReason.requires_memo && !data.customMemo?.trim()) {
        throw new ValidationError(`Deletion reason "${deletionReason.reason_name}" requires a custom memo`);
      }

      // Check if there's already a pending request for this entity
      const existingRequest = await ApprovalRequest.findOne({
        where: {
          entity_type: data.entityType,
          entity_id: data.entityId,
          status: 'Pending'
        },
        transaction
      });

      if (existingRequest) {
        throw new BusinessLogicError(`There is already a pending deletion request for this ${data.entityType}`);
      }

      // Generate impact analysis
      const impactAnalysis = await this.impactAnalysisService.analyzeTransactionDeletion(
        data.entityType, 
        data.entityId
      );

      // Generate request number
      const requestNumber = await this.generateRequestNumber(transaction);

      // Create approval request
      const approvalRequest = await ApprovalRequest.create({
        request_number: requestNumber,
        workflow_id: 1, // Default workflow
        entity_type: data.entityType,
        entity_id: data.entityId,
        requested_by: data.requestedBy,
        request_reason: data.reason,
        deletion_reason_code: data.deletionReasonCode,
        custom_memo: data.customMemo,
        impact_analysis: impactAnalysis,
        current_step: 1,
        status: 'Pending'
      }, { transaction });

      // Create approval steps based on required approvals
      await this.createApprovalSteps(
        approvalRequest.id, 
        impactAnalysis.requiredApprovals,
        data.selectedApproverId, // ✅ NEW: Pass selected approver
        transaction
      );

      // Create audit trail entry
      await this.createAuditTrailEntry({
        entity_type: data.entityType,
        entity_id: data.entityId,
        action_type: 'DELETION_REQUEST_CREATED',
        action_data: {
          request_id: approvalRequest.id,
          request_number: requestNumber,
          reason: data.reason,
          deletion_reason_code: data.deletionReasonCode,
          impact_analysis: impactAnalysis
        },
        user_id: data.requestedBy,
        ip_address: data.ipAddress,
        user_agent: data.userAgent,
        approval_id: approvalRequest.id
      }, transaction);

      // Send notifications to first approver
      await this.notifyNextApprover(approvalRequest.id, transaction);

      return approvalRequest;
    });
  }

  /**
   * Process an approval step (approve or reject)
   */
  async processApprovalStep(data: ProcessApprovalStepData): Promise<void> {
    return this.executeWithTransaction(async (transaction) => {
      console.log('🔍 ApprovalWorkflowService.processApprovalStep - Input data:', data);

      // Get the approval step
      const step = await ApprovalStep.findByPk(data.stepId, {
        include: [
          { model: ApprovalRequest, as: 'request' }
        ],
        transaction
      });

      console.log('🔍 Found approval step:', step ? `ID: ${step.id}, Status: ${step.status}` : 'Not found');

      if (!step) {
        throw new NotFoundError(`Approval step with ID ${data.stepId} not found`);
      }

      if (step.status !== 'Pending') {
        throw new BusinessLogicError(`Approval step has already been processed`);
      }

      console.log('🔍 Validating approver permission for user:', data.approverId, 'role:', step.approver_role);

      // Validate approver has permission
      await this.validateApproverPermission(data.approverId, step.approver_role, transaction);

      console.log('✅ Approver permission validated');

      // Update the step
      await step.update({
        approved_by: data.approverId,
        approved_at: new Date(),
        approval_notes: data.notes,
        status: data.decision === 'APPROVED' ? 'Approved' : 'Rejected' // Convert to title case for database
      }, { transaction });

      console.log('✅ Approval step updated');

      const request = step.request;

      // Create audit trail entry
      await this.createAuditTrailEntry({
        entity_type: request.entity_type,
        entity_id: request.entity_id,
        action_type: `APPROVAL_STEP_${data.decision.toUpperCase()}`,
        action_data: {
          step_id: data.stepId,
          step_number: step.step_number,
          approver_role: step.approver_role,
          notes: data.notes
        },
        user_id: data.approverId,
        ip_address: data.ipAddress,
        user_agent: data.userAgent,
        approval_id: request.id
      }, transaction);

      console.log('✅ Audit trail entry created');

      if (data.decision === 'REJECTED') {
        // Reject the entire request
        await request.update({ status: 'Rejected' }, { transaction });
        
        await this.createAuditTrailEntry({
          entity_type: request.entity_type,
          entity_id: request.entity_id,
          action_type: 'DELETION_REQUEST_REJECTED',
          action_data: {
            rejected_by: data.approverId,
            rejection_reason: data.notes,
            rejected_at_step: step.step_number
          },
          user_id: data.approverId,
          ip_address: data.ipAddress,
          user_agent: data.userAgent,
          approval_id: request.id
        }, transaction);

        console.log('✅ Request rejected and audit trail created');
        // TODO: Send rejection notification
        return;
      }

      // Check if all steps are approved
      const allSteps = await ApprovalStep.findAll({
        where: { request_id: request.id },
        transaction
      });

      const allApproved = allSteps.every(s => s.status === 'Approved');

      console.log('🔍 All steps check:', {
        totalSteps: allSteps.length,
        approvedSteps: allSteps.filter(s => s.status === 'Approved').length,
        allApproved
      });

      if (allApproved) {
        // All steps approved - execute the deletion
        await request.update({ 
          status: 'Approved',
          approved_at: new Date()
        }, { transaction });

        await this.createAuditTrailEntry({
          entity_type: request.entity_type,
          entity_id: request.entity_id,
          action_type: 'DELETION_REQUEST_FULLY_APPROVED',
          action_data: {
            approved_steps: allSteps.length,
            final_approver: data.approverId
          },
          user_id: data.approverId,
          ip_address: data.ipAddress,
          user_agent: data.userAgent,
          approval_id: request.id
        }, transaction);

        console.log('✅ Request fully approved, executing deletion');

        // Execute the deletion automatically
        await this.executeApprovedDeletion(request.id, data.approverId, data.ipAddress, data.userAgent, transaction);
        
      } else {
        // Move to next step
        console.log('📋 Moving to next approval step');
        await this.notifyNextApprover(request.id, transaction);
      }

      console.log('✅ ProcessApprovalStep completed successfully');
    });
  }

  /**
   * Get pending approval requests for a specific user
   * ✅ UPDATED: Now checks both approver_id (specific assignment) and approver_role (general)
   */
  async getPendingApprovalsForUser(userId: number): Promise<any[]> {
    return this.executeWithRetry(async () => {
      // Get user roles
      const userRoles = await UserRole.findAll({
        where: { user_id: userId, is_active: true }
      });

      if (userRoles.length === 0) {
        return [];
      }

      const roleNames = userRoles.map(role => role.role_name);

      // ✅ IMPROVED: Get pending approval steps where:
      // 1. User is specifically assigned (approver_id = userId), OR
      // 2. User has the required role AND no specific approver assigned
      const pendingSteps = await ApprovalStep.findAll({
        where: {
          status: 'Pending',
          [Op.or]: [
            { approver_id: userId }, // ✅ Specifically assigned to this user
            {
              [Op.and]: [
                { approver_role: { [Op.in]: roleNames } }, // Has required role
                { approver_id: { [Op.is]: null } as any } // ✅ FIXED: Type cast for null check
              ]
            }
          ]
        },
        include: [
          {
            model: ApprovalRequest,
            as: 'request',
            where: { status: 'Pending' },
            include: [
              { model: User, as: 'requester', attributes: ['id', 'email', 'firstName', 'lastName'] },
              { model: TransactionDeletionReason, as: 'deletionReason' }
            ]
          }
        ],
        order: [['created_at', 'ASC']]
      });

      return pendingSteps.map(step => ({
        step_id: step.id,
        request_id: step.request.id,
        request_number: step.request.request_number,
        entity_type: step.request.entity_type,
        entity_id: step.request.entity_id,
        amount: step.request.impact_analysis?.entityData?.amount || 
                step.request.impact_analysis?.entityData?.total ||
                step.request.impact_analysis?.entityData?.paymentAmount || 0,
        requester_name: step.request.requester 
          ? `${step.request.requester.firstName || ''} ${step.request.requester.lastName || ''}`.trim() || step.request.requester.email || 'Unknown User'
          : 'Unknown User',
        requester_email: step.request.requester?.email,
        request_reason: step.request.request_reason,
        deletion_reason: step.request.deletionReason?.reason_name,
        custom_memo: step.request.custom_memo,
        step_number: step.step_number,
        approver_role: step.approver_role,
        approver_id: step.approver_id, // ✅ NEW: Show if specifically assigned
        is_assigned_to_me: step.approver_id === userId, // ✅ NEW: Flag if assigned to current user
        required_by: step.required_by,
        risk_level: step.request.impact_analysis?.riskLevel,
        impact_analysis: step.request.impact_analysis,
        created_at: step.request.createdAt
      }));
    });
  }

  /**
   * Get approval requests created by a specific user
   */
  async getApprovalRequestsByUser(userId: number): Promise<any[]> {
    return this.executeWithRetry(async () => {
      const requests = await ApprovalRequest.findAll({
        where: { requested_by: userId },
        include: [
          { 
            model: ApprovalStep, 
            as: 'steps',
            include: [
              { model: User, as: 'approvedByUser', attributes: ['id', 'firstName', 'lastName'] }
            ]
          },
          { model: TransactionDeletionReason, as: 'deletionReason' }
        ],
        order: [['created_at', 'DESC']]
      });

      return requests.map(request => ({
        id: request.id,
        request_number: request.request_number,
        entity_type: request.entity_type,
        entity_id: request.entity_id,
        amount: request.impact_analysis?.entityData?.amount || 
                request.impact_analysis?.entityData?.total ||
                request.impact_analysis?.entityData?.paymentAmount || 0,
        status: request.status,
        request_reason: request.request_reason,
        deletion_reason: request.deletionReason?.reason_name,
        custom_memo: request.custom_memo,
        risk_level: request.impact_analysis?.riskLevel,
        created_at: request.createdAt,
        approved_at: request.approved_at,
        executed_at: request.executed_at,
        steps: request.steps?.map(step => ({
          id: step.id,
          step_number: step.step_number,
          approver_role: step.approver_role,
          status: step.status,
          approved_by: step.approvedByUser ? `${step.approvedByUser.firstName} ${step.approvedByUser.lastName}` : undefined,
          approved_at: step.approved_at,
          approval_notes: step.approval_notes
        })) || []
      }));
    });
  }

  /**
   * Generate unique request number
   */
  private async generateRequestNumber(transaction: Transaction): Promise<string> {
    const lastRequest = await ApprovalRequest.findOne({
      where: {
        request_number: {
          [Op.like]: 'DR%' // Deletion Request
        }
      },
      order: [['id', 'DESC']],
      transaction
    });

    let nextNumber = 1;
    if (lastRequest) {
      const lastNumber = parseInt(lastRequest.request_number.substring(2));
      nextNumber = lastNumber + 1;
    }

    return `DR${String(nextNumber).padStart(4, '0')}`;
  }

  /**
   * Create approval steps based on required approvals
   * ✅ PROFESSIONAL FIX: Creates only ONE approval step (not multiple)
   * - One person approves once with their highest authority level
   * - Assigns to specific approver if provided by user
   */
  private async createApprovalSteps(
    requestId: number, 
    requiredApprovals: string[],
    selectedApproverId?: number, // ✅ Specific approver selected by user
    transaction?: Transaction
  ): Promise<void> {
    // ✅ PROFESSIONAL: requiredApprovals now contains only ONE level (highest needed)
    // Example: ['CFO'] instead of ['Manager', 'Controller', 'CFO']
    
    if (requiredApprovals.length === 0) {
      throw new ValidationError('No approval level determined');
    }

    // ✅ Create only ONE approval step (not multiple)
    const role = requiredApprovals[0]; // Only one role needed
    
    // Calculate required by date (24-72 hours based on role)
    const hoursToAdd = this.getApprovalTimeoutHours(role);
    const requiredBy = new Date();
    requiredBy.setHours(requiredBy.getHours() + hoursToAdd);

    await ApprovalStep.create({
      request_id: requestId,
      step_number: 1, // ✅ Always step 1 (only one step)
      approver_role: role,
      approver_id: selectedApproverId, // ✅ Assign to selected approver (if provided)
      required_by: requiredBy,
      status: 'Pending'
    }, { transaction });
  }

  /**
   * Get approval timeout hours based on role
   */
  private getApprovalTimeoutHours(role: string): number {
    const timeouts: Record<string, number> = {
      'Manager': 24,
      'Controller': 48,
      'CFO': 72,
      'Board': 168 // 1 week
    };
    return timeouts[role] || 24;
  }

  /**
   * Validate approver has permission for the role
   */
  private async validateApproverPermission(
    userId: number, 
    requiredRole: string, 
    transaction: Transaction
  ): Promise<void> {
    console.log('🔍 Validating approver permission:', { userId, requiredRole });

    // If auth is disabled, skip role validation for testing
    if (process.env.AUTH_ENABLED !== 'true') {
      console.log('🔧 Auth disabled, skipping role validation');
      return;
    }

    const userRole = await UserRole.findOne({
      where: {
        user_id: userId,
        role_name: requiredRole,
        is_active: true
      },
      transaction
    });

    console.log('🔍 User role found:', userRole ? `ID: ${userRole.id}, Role: ${userRole.role_name}` : 'Not found');

    if (!userRole) {
      throw new ValidationError(`User does not have ${requiredRole} role required for this approval`);
    }

    console.log('✅ Approver permission validated successfully');
  }

  /**
   * Notify next approver (placeholder for notification system)
   */
  private async notifyNextApprover(requestId: number, transaction: Transaction): Promise<void> {
    // TODO: Implement notification system
    // This would send email/SMS to the next approver
    console.log(`Notification: Next approver needed for request ${requestId}`);
  }

  /**
   * Automatically execute approved deletion
   */
  private async executeApprovedDeletion(
    requestId: number, 
    executedBy: number, 
    ipAddress?: string, 
    userAgent?: string,
    transaction?: Transaction
  ): Promise<void> {
    try {
      // Execute the deletion using TransactionDeletionService
      await transactionDeletionService.executeApprovedDeletion({
        approvalRequestId: requestId,
        executedBy: executedBy,
        ipAddress: ipAddress,
        userAgent: userAgent
      });

      // Create audit trail entry for successful execution
      const request = await ApprovalRequest.findByPk(requestId, { transaction });
      if (request) {
        await this.createAuditTrailEntry({
          entity_type: request.entity_type,
          entity_id: request.entity_id,
          action_type: 'DELETION_EXECUTED_AUTOMATICALLY',
          action_data: {
            request_id: requestId,
            executed_by: executedBy,
            execution_method: 'AUTOMATIC_AFTER_APPROVAL'
          },
          user_id: executedBy,
          ip_address: ipAddress,
          user_agent: userAgent,
          approval_id: requestId
        }, transaction!);
      }

      console.log(`✅ Transaction deletion executed automatically for request ${requestId}`);
    } catch (error) {
      console.error(`❌ Failed to execute deletion for request ${requestId}:`, error);
      
      // Create audit trail entry for failed execution
      const request = await ApprovalRequest.findByPk(requestId, { transaction });
      if (request) {
        await this.createAuditTrailEntry({
          entity_type: request.entity_type,
          entity_id: request.entity_id,
          action_type: 'DELETION_EXECUTION_FAILED',
          action_data: {
            request_id: requestId,
            error_message: error instanceof Error ? error.message : 'Unknown error',
            execution_method: 'AUTOMATIC_AFTER_APPROVAL'
          },
          user_id: executedBy,
          ip_address: ipAddress,
          user_agent: userAgent,
          approval_id: requestId
        }, transaction!);
      }
      
      // Don't throw error to prevent approval rollback
      // The approval is valid, execution can be retried manually
    }
  }

  /**
   * Create audit trail entry with hash chain
   */
  private async createAuditTrailEntry(data: {
    entity_type: string;
    entity_id: number;
    action_type: string;
    action_data: any;
    user_id: number;
    ip_address?: string;
    user_agent?: string;
    approval_id?: number;
  }, transaction: Transaction): Promise<void> {
    // Get previous hash for chain
    const lastAudit = await TransactionAuditTrail.findOne({
      order: [['id', 'DESC']],
      transaction
    });

    // Create hash of current entry
    const entryData = JSON.stringify({
      ...data,
      timestamp: new Date().toISOString()
    });
    
    const currentHash = crypto
      .createHash('sha256')
      .update(entryData + (lastAudit?.audit_hash || ''))
      .digest('hex');

    await TransactionAuditTrail.create({
      audit_hash: currentHash,
      previous_hash: lastAudit?.audit_hash,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      action_type: data.action_type,
      action_data: data.action_data,
      user_id: data.user_id,
      ip_address: data.ip_address,
      user_agent: data.user_agent,
      approval_id: data.approval_id
    }, { transaction });
  }
}

export default ApprovalWorkflowService;