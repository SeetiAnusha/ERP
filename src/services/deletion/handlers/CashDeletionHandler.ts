import { Transaction } from 'sequelize';
import CashRegister from '../../../models/CashRegister';
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
 * Cash Register Deletion Handler
 * 
 * Handles Cash Register deletion with automatic reversal entry creation
 * Creates opposite transaction and updates Cash Register Master balance
 * 
 * NOTE: Store balance updates are handled by BatchProcessor.executeCashReversalBatch()
 */
export class CashDeletionHandler {
  /**
   * Generate Cash Register reversal operations
   * 
   * Creates a reversal entry (opposite transaction type) and soft deletes original
   * The BatchProcessor will handle:
   * 1. Creating the reversal record in CashRegister table
   * 2. Updating the Cash Register Master balance automatically
   * 3. Soft deleting the original record
   * 
   * Cash Flow Logic:
   * - If original was INFLOW (money came into store), reversal is OUTFLOW (remove money from store)
   * - If original was OUTFLOW (money left store), reversal is INFLOW (add money back to store)
   */
  async generateCashRegisterReversalOperations(
    nodeId: number,
    approvalRequest: ApprovalRequest,
    executedBy: number,
    transaction: Transaction
  ): Promise<ReversalOperation[]> {
    const operations: ReversalOperation[] = [];
    
    const cr = await CashRegister.findByPk(nodeId, { transaction });
    if (!cr) return operations;
    
    // ✅ DEBUG: Log cash register deletion details
    console.log(`💵 [DEBUG] CashDeletionHandler called for: ${cr.registrationNumber}`);
    console.log(`   - Transaction Type: ${cr.transactionType}`);
    console.log(`   - Amount: ${cr.amount}`);
    console.log(`   - Store ID: ${cr.cashRegisterId}`);
    console.log(`   - Related Document: ${cr.relatedDocumentNumber}`);
    console.log(`   - Is Reversal: ${cr.is_reversal}`);
    console.log(`   - Deletion Status: ${cr.deletion_status}`);
    
    console.log(`💵 [Cash Register Analysis] ${cr.registrationNumber}: ${cr.transactionType} ${cr.amount} - Store: ${cr.cashRegisterId}`);
    
    // Create reversal entry (BatchProcessor will create opposite transaction and update store balance)
    operations.push({
      type: 'CASH_REVERSAL',
      targetTable: 'cash_registers',
      targetId: cr.id,
      data: {
        originalEntry: cr,
        reversalType: cr.transactionType === 'INFLOW' ? 'OUTFLOW' : 'INFLOW',
        amount: cr.amount,
        description: `Reversal of ${cr.registrationNumber} - ${approvalRequest.deletion_reason_code}`,
        deletion_approval_id: approvalRequest.id
      },
      priority: 1
    });
    
    // Soft delete original cash register entry
    operations.push({
      type: 'SOFT_DELETE',
      targetTable: 'cash_registers',
      targetId: cr.id,
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
    
    console.log(`✅ [Cash Register Operations] Generated ${operations.length} operations for ${cr.registrationNumber} - Store balance will be updated by BatchProcessor`);
    return operations;
  }
}

export default CashDeletionHandler;