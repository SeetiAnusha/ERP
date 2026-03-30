import { Transaction, Op } from 'sequelize';
import AccountsReceivable from '../../../models/AccountsReceivable';
import BankRegister from '../../../models/BankRegister';
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
 * AR Deletion Handler
 * 
 * Handles Accounts Receivable deletion with automatic collection reversal
 * Supports both unpaid and paid AR scenarios with proper cash/bank reversals
 */
export class ARDeletionHandler {
  /**
   * Generate AR reversal operations with scenario-based handling
   * 
   * Handles 2 scenarios:
   * 1. AR Credit (Unpaid) - Simple soft delete
   * 2. AR Credit (Paid) - Complex reversal with cash/bank register updates
   */
  async generateARReversalOperations(
    nodeId: number,
    approvalRequest: ApprovalRequest,
    executedBy: number,
    transaction: Transaction
  ): Promise<ReversalOperation[]> {
    const operations: ReversalOperation[] = [];
    
    // Get full AR data
    const ar = await AccountsReceivable.findByPk(nodeId, { transaction });
    if (!ar) return operations;
    
    const receivedAmount = parseFloat(ar.receivedAmount?.toString() || '0');
    
    console.log(`💰 [AR Analysis] ${ar.registrationNumber}: Total=${ar.amount}, Received=${receivedAmount}, Status=${ar.status}`);
    
    // ✅ Scenario 1: AR Credit (Unpaid) - Simple deletion
    if (receivedAmount === 0) {
      console.log(`📝 [AR Unpaid] Simple deletion for ${ar.registrationNumber} - No collections to reverse`);
      
      operations.push({
        type: 'SOFT_DELETE',
        targetTable: 'accounts_receivables',
        targetId: ar.id,
        data: {
          deletion_status: 'EXECUTED',
          deleted_at: new Date(),
          deleted_by: executedBy,
          deletion_reason_code: approvalRequest.deletion_reason_code,
          deletion_memo: approvalRequest.custom_memo,
          deletion_approval_id: approvalRequest.id
        },
        priority: 1
      });
      
      return operations;
    }
    
    // ✅ Scenario 2: AR Credit (Paid) - Check payment method and reverse accordingly
    console.log(`💰 [AR Paid] AR has been collected ${receivedAmount}. Checking payment methods...`);
    
    // Find all related cash register entries (CASH payments)
    const cashEntries = await CashRegister.findAll({
      where: { 
        relatedDocumentNumber: ar.registrationNumber,
        deletion_status: { [Op.ne]: 'EXECUTED' }
      },
      transaction
    });
    
    // Find all related bank register entries (BANK/CHEQUE/DEPOSIT/DEBIT payments)
    const bankEntries = await BankRegister.findAll({
      where: { 
        relatedDocumentNumber: ar.registrationNumber,
        deletion_status: { [Op.ne]: 'EXECUTED' }
      },
      transaction
    });
    
    // ✅ Handle CASH payments - Update Cash Register Master (reduce store balance)
    for (const cashEntry of cashEntries) {
      console.log(`💵 [AR Cash Reversal] Found cash payment: ${cashEntry.registrationNumber} (${cashEntry.transactionType} ${cashEntry.amount})`);
      
      operations.push({
        type: 'CASH_REVERSAL',
        targetTable: 'cash_registers',
        targetId: cashEntry.id,
        data: {
          originalEntry: cashEntry,
          reversalType: cashEntry.transactionType === 'INFLOW' ? 'OUTFLOW' : 'INFLOW',
          amount: cashEntry.amount,
          description: `Reversal of AR collection ${ar.registrationNumber} - ${ar.clientName || 'Customer'} (${approvalRequest.deletion_reason_code})`,
          deletion_approval_id: approvalRequest.id
        },
        priority: 1
      });
    }
    
    // ✅ Handle BANK payments - Update Bank Account (reduce bank balance)
    for (const bankEntry of bankEntries) {
      console.log(`🏦 [AR Bank Reversal] Found bank payment: ${bankEntry.registrationNumber} (${bankEntry.transactionType} ${bankEntry.amount}) - Method: ${bankEntry.paymentMethod}`);
      
      operations.push({
        type: 'BANK_REVERSAL',
        targetTable: 'bank_registers',
        targetId: bankEntry.id,
        data: {
          originalEntry: bankEntry,
          reversalType: bankEntry.transactionType === 'INFLOW' ? 'OUTFLOW' : 'INFLOW',
          amount: bankEntry.amount,
          description: `Reversal of AR collection ${ar.registrationNumber} - ${ar.clientName || 'Customer'} (${approvalRequest.deletion_reason_code})`,
          deletion_approval_id: approvalRequest.id
        },
        priority: 1
      });
    }
    
    // Reset AR collection status
    operations.push({
      type: 'STATUS_UPDATE',
      targetTable: 'accounts_receivables',
      targetId: ar.id,
      data: {
        receivedAmount: 0,
        balanceAmount: parseFloat(ar.amount.toString()),
        status: 'Not Collected'
      },
      priority: 2
    });
    
    // Soft delete the AR record
    operations.push({
      type: 'SOFT_DELETE',
      targetTable: 'accounts_receivables',
      targetId: ar.id,
      data: {
        deletion_status: 'EXECUTED',
        deleted_at: new Date(),
        deleted_by: executedBy,
        deletion_reason_code: approvalRequest.deletion_reason_code,
        deletion_memo: approvalRequest.custom_memo,
        deletion_approval_id: approvalRequest.id
      },
      priority: 3
    });
    
    console.log(`✅ [AR Operations] Generated ${operations.length} operations for AR ${ar.registrationNumber}`);
    return operations;
  }
}

export default ARDeletionHandler;