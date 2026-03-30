import { Transaction, Op } from 'sequelize';
import ApprovalRequest from '../../../models/ApprovalRequest';
import BankRegister from '../../../models/BankRegister';
import CashRegister from '../../../models/CashRegister';

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
 * Business Expense Deletion Handler
 * 
 * Handles Business Expense deletion with automatic payment reversal
 * Supports both paid and unpaid business expenses with proper register reversals
 */
export class BusinessExpenseDeletionHandler {
  /**
   * Generate reversal operations for business expenses
   * 
   * Handles paid business expenses by reversing all related payments
   * Updates expense status and creates proper audit trail
   */
  async generateBusinessExpenseReversalOperations(
    nodeId: number,
    approvalRequest: ApprovalRequest,
    executedBy: number,
    transaction: Transaction
  ): Promise<ReversalOperation[]> {
    const operations: ReversalOperation[] = [];
    
    // Get full business expense data
    const BusinessExpense = (await import('../../../models/BusinessExpense')).default;
    const expense = await BusinessExpense.findByPk(nodeId, { transaction });
    if (!expense) return operations;
    
    const paidAmount = parseFloat(expense.paidAmount?.toString() || '0');
    
    console.log(`💼 [Business Expense Analysis] ${expense.registrationNumber}: Total=${expense.amount}, Paid=${paidAmount}, Status=${expense.paymentStatus}`);
    
    // ✅ Handle paid business expenses - reverse payments
    if (paidAmount > 0) {
      console.log(`🔄 [Auto-Reversal] Business expense has been paid ${paidAmount}. Generating automatic payment reversals...`);
      
      // Find and reverse all related bank register entries
      const bankEntries = await BankRegister.findAll({
        where: { 
          relatedDocumentNumber: expense.registrationNumber,
          deletion_status: { [Op.ne]: 'EXECUTED' }
        },
        transaction
      });
      
      for (const bankEntry of bankEntries) {
        operations.push({
          type: 'BANK_REVERSAL',
          targetTable: 'bank_registers',
          targetId: bankEntry.id,
          data: {
            originalEntry: bankEntry,
            reversalType: bankEntry.transactionType === 'OUTFLOW' ? 'INFLOW' : 'OUTFLOW',
            amount: bankEntry.amount,
            description: `Reversal of ${bankEntry.registrationNumber} - Business expense deletion (${approvalRequest.deletion_reason_code})`,
            deletion_approval_id: approvalRequest.id,
            apRegistrationNumber: expense.registrationNumber
          },
          priority: 1
        });
        
        console.log(`🏦 [Bank Reversal] Queued reversal for ${bankEntry.registrationNumber} (${bankEntry.transactionType} ${bankEntry.amount})`);
      }
      
      // Find and reverse cash register entries
      const cashEntries = await CashRegister.findAll({
        where: { 
          relatedDocumentNumber: expense.registrationNumber,
          deletion_status: { [Op.ne]: 'EXECUTED' }
        },
        transaction
      });
      
      for (const cashEntry of cashEntries) {
        operations.push({
          type: 'CASH_REVERSAL',
          targetTable: 'cash_registers',
          targetId: cashEntry.id,
          data: {
            originalEntry: cashEntry,
            reversalType: cashEntry.transactionType === 'INFLOW' ? 'OUTFLOW' : 'INFLOW',
            amount: cashEntry.amount,
            description: `Reversal of ${cashEntry.registrationNumber} - Business expense deletion (${approvalRequest.deletion_reason_code})`,
            deletion_approval_id: approvalRequest.id
          },
          priority: 1
        });
        
        console.log(`💰 [Cash Reversal] Queued reversal for ${cashEntry.registrationNumber} (${cashEntry.transactionType} ${cashEntry.amount})`);
      }
    }
    
    // ✅ Update business expense status to REVERSED
    operations.push({
      type: 'STATUS_UPDATE',
      targetTable: 'business_expenses',
      targetId: expense.id,
      data: {
        paymentStatus: 'REVERSED',
        paidAmount: 0,
        balanceAmount: parseFloat(expense.amount.toString()),
        paidDate: null,
        description: `${expense.description || ''} | REVERSED: ${approvalRequest.deletion_reason_code}`.trim(),
        deletion_approval_id: approvalRequest.id
      },
      priority: 2
    });
    
    // Update related AP records (mark as reversed)
    operations.push({
      type: 'SOFT_DELETE',
      targetTable: 'accounts_payables',
      targetId: 0, // Will be resolved by related document number
      data: {
        relatedDocumentNumber: expense.registrationNumber,
        deletion_status: 'EXECUTED',
        deleted_at: new Date(),
        deleted_by: executedBy,
        deletion_reason_code: approvalRequest.deletion_reason_code,
        deletion_memo: approvalRequest.custom_memo,
        deletion_approval_id: approvalRequest.id
      },
      priority: 3
    });
    
    // ✅ Soft delete the business expense (for audit trail)
    operations.push({
      type: 'SOFT_DELETE',
      targetTable: 'business_expenses',
      targetId: expense.id,
      data: {
        deletion_status: 'EXECUTED',
        deleted_at: new Date(),
        deleted_by: executedBy,
        deletion_reason_code: approvalRequest.deletion_reason_code,
        deletion_memo: approvalRequest.custom_memo || `Business expense reversed - ${expense.supplier?.name || 'Unknown Supplier'}`,
        deletion_approval_id: approvalRequest.id
      },
      priority: 4
    });
    
    console.log(`✅ [Business Expense Operations] Generated ${operations.length} operations for ${expense.registrationNumber}`);
    return operations;
  }
}

export default BusinessExpenseDeletionHandler;