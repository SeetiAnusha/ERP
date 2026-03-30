import { Transaction } from 'sequelize';
import BankRegister from '../../../models/BankRegister';
import ApprovalRequest from '../../../models/ApprovalRequest';

/**
 * Reversal Operation for batch processing
 */
interface ReversalOperation {
  type: 'BANK_REVERSAL' | 'CASH_REVERSAL' | 'CC_REGISTER_REVERSAL' | 'STATUS_UPDATE' | 'SOFT_DELETE' | 'CREATE_REVERSAL_AP' | 'CREATE_MANUAL_TASK' | 'RESTORE_CREDIT_LIMIT' | 'BANK_BALANCE_UPDATE';
  targetTable: string;
  targetId: number;
  data: any;
  priority: number;
}

/**
 * Bank Register Deletion Handler
 * 
 * Handles Bank Register deletion with automatic reversal entry creation
 * Creates opposite transaction to maintain bank balance integrity
 * 
 * NOTE: Bank account balance updates are handled by BatchProcessor.executeBankReversalBatch()
 */
export class BankDeletionHandler {
  /**
   * Generate Bank Register reversal operations
   * 
   * Creates a reversal entry (opposite transaction type) and soft deletes original
   * The BatchProcessor will handle:
   * 1. Creating the reversal record in BankRegister table
   * 2. Updating the bank account balance automatically
   * 3. Soft deleting the original record
   */
  async generateBankRegisterReversalOperations(
    nodeId: number,
    approvalRequest: ApprovalRequest,
    executedBy: number,
    transaction: Transaction
  ): Promise<ReversalOperation[]> {
    const operations: ReversalOperation[] = [];
    
    const br = await BankRegister.findByPk(nodeId, { transaction });
    if (!br) return operations;
    
    console.log(`🏦 [Bank Register Analysis] ${br.registrationNumber}: ${br.transactionType} ${br.amount} - Account: ${br.bankAccountId} - Method: ${br.paymentMethod}`);
    
    // Create reversal entry (BatchProcessor will create opposite transaction and update bank balance)
    operations.push({
      type: 'BANK_REVERSAL',
      targetTable: 'bank_registers',
      targetId: br.id,
      data: {
        originalEntry: br,
        reversalType: br.transactionType === 'INFLOW' ? 'OUTFLOW' : 'INFLOW',
        amount: br.amount,
        description: `Reversal of ${br.registrationNumber} - ${approvalRequest.deletion_reason_code}`,
        deletion_approval_id: approvalRequest.id
      },
      priority: 1
    });
    
    // Soft delete original bank register entry
    operations.push({
      type: 'SOFT_DELETE',
      targetTable: 'bank_registers',
      targetId: br.id,
      data: {
        deletion_status: 'EXECUTED',
        deleted_at: new Date(),
        deleted_by: executedBy,
        deletion_reason_code: approvalRequest.deletion_reason_code,
        deletion_memo: approvalRequest.custom_memo,
        deletion_approval_id: approvalRequest.id
      },
      priority: 2
    });
    
    console.log(`✅ [Bank Register Operations] Generated ${operations.length} operations for ${br.registrationNumber} - Bank balance will be updated by BatchProcessor`);
    return operations;
  }
}

export default BankDeletionHandler;