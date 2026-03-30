/**
 * Purchase Deletion Handler
 * 
 * Extracted from TransactionDeletionService to improve maintainability
 * Handles all purchase-specific deletion logic without changing business rules
 */

import { Transaction, Op } from 'sequelize';
import Purchase from '../../../models/Purchase';
import BankRegister from '../../../models/BankRegister';
import CashRegister from '../../../models/CashRegister';
import ApprovalRequest from '../../../models/ApprovalRequest';
import { BaseService } from '../../../core/BaseService';

// Import interfaces from parent service
interface TransactionNode {
  id: number;
  type: 'PURCHASE' | 'SALE' | 'PAYMENT' | 'BANK_REGISTER' | 'CASH_REGISTER' | 'AP' | 'AR' | 'BUSINESS_EXPENSE';
  registrationNumber: string;
  amount: number;
  status: string;
  dependencies: TransactionNode[];
  dependents: TransactionNode[];
  processed: boolean;
  entityType?: string;
}

interface ReversalOperation {
  type: 'BANK_REVERSAL' | 'CASH_REVERSAL' | 'CC_REGISTER_REVERSAL' | 'STATUS_UPDATE' | 'SOFT_DELETE' | 'CREATE_REVERSAL_AP' | 'CREATE_MANUAL_TASK' | 'RESTORE_CREDIT_LIMIT' | 'BANK_BALANCE_UPDATE';
  targetTable: string;
  targetId: number;
  data: any;
  priority: number;
}

export class PurchaseDeletionHandler extends BaseService {

  /**
   * Generate reversal operations for purchase deletion
   * 
   * EXACT COPY of generatePurchaseReversalOperations from TransactionDeletionService
   * NO LOGIC CHANGES - just extracted for better organization
   */
  async generateReversalOperations(
    node: TransactionNode,
    approvalRequest: ApprovalRequest,
    executedBy: number,
    transaction: Transaction
  ): Promise<ReversalOperation[]> {
    const operations: ReversalOperation[] = [];
    
    // Get full purchase data
    const purchase = await Purchase.findByPk(node.id, { transaction });
    if (!purchase) return operations;
    
    const paidAmount = parseFloat(purchase.paidAmount.toString());
    
    console.log(`💰 [Purchase Analysis] ${purchase.registrationNumber}: Total=${purchase.total}, Paid=${paidAmount}, Status=${purchase.paymentStatus}`);
    
    // ✅ ENHANCED: Automatically handle paid purchases
    if (paidAmount > 0) {
      console.log(`🔄 [Auto-Reversal] Purchase has been paid ${paidAmount}. Generating automatic payment reversals...`);
      
      // Find and reverse all related bank register entries
      const bankEntries = await BankRegister.findAll({
        where: { 
          relatedDocumentNumber: purchase.registrationNumber,
          deletion_status: { [Op.ne]: 'EXECUTED' }
        },
        transaction
      });
      
      for (const bankEntry of bankEntries) {
        // Generate bank reversal operation
        operations.push({
          type: 'BANK_REVERSAL',
          targetTable: 'bank_registers',
          targetId: bankEntry.id,
          data: {
            originalEntry: bankEntry,
            reversalType: bankEntry.transactionType === 'OUTFLOW' ? 'INFLOW' : 'OUTFLOW',
            amount: bankEntry.amount,
            description: `Reversal of ${bankEntry.registrationNumber} - Purchase deletion (${approvalRequest.deletion_reason_code})`,
            deletion_approval_id: approvalRequest.id
          },
          priority: 1 // High priority - reverse payments first
        });
        
        console.log(`🏦 [Bank Reversal] Queued reversal for ${bankEntry.registrationNumber} (${bankEntry.transactionType} ${bankEntry.amount})`);
      }
      
      // Find and reverse cash register entries
      const cashEntries = await CashRegister.findAll({
        where: { 
          relatedDocumentNumber: purchase.registrationNumber,
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
            description: `Reversal of ${cashEntry.registrationNumber} - Purchase deletion (${approvalRequest.deletion_reason_code})`,
            deletion_approval_id: approvalRequest.id
          },
          priority: 1
        });
        
        console.log(`💰 [Cash Reversal] Queued reversal for ${cashEntry.registrationNumber} (${cashEntry.transactionType} ${cashEntry.amount})`);
      }
      
      // Reset purchase payment status
      operations.push({
        type: 'STATUS_UPDATE',
        targetTable: 'purchases',
        targetId: purchase.id,
        data: {
          paidAmount: 0,
          balanceAmount: parseFloat(purchase.total.toString()),
          paymentStatus: 'Unpaid'
        },
        priority: 2
      });
      
      console.log(`📝 [Status Reset] Purchase will be reset to unpaid status`);
    }
    
    // Update related AP records
    operations.push({
      type: 'SOFT_DELETE',
      targetTable: 'accounts_payables',
      targetId: 0, // Will be resolved by related document number
      data: {
        relatedDocumentNumber: purchase.registrationNumber,
        deletion_status: 'EXECUTED',
        deleted_at: new Date(),
        deleted_by: executedBy,
        deletion_reason_code: approvalRequest.deletion_reason_code,
        deletion_memo: approvalRequest.custom_memo,
        deletion_approval_id: approvalRequest.id
      },
      priority: 3
    });
    
    // Soft delete the purchase
    operations.push({
      type: 'SOFT_DELETE',
      targetTable: 'purchases',
      targetId: purchase.id,
      data: {
        deletion_status: 'EXECUTED',
        deleted_at: new Date(),
        deleted_by: executedBy,
        deletion_reason_code: approvalRequest.deletion_reason_code,
        deletion_memo: approvalRequest.custom_memo,
        deletion_approval_id: approvalRequest.id
      },
      priority: 4 // Lowest priority - delete main record last
    });
    
    console.log(`✅ [Purchase Operations] Generated ${operations.length} operations for ${purchase.registrationNumber}`);
    return operations;
  }

  /**
   * Validate purchase-specific deletion requirements
   * Can be extended with purchase-specific validation rules
   */
  async validatePurchaseDeletion(purchaseId: number, transaction: Transaction): Promise<void> {
    const purchase = await Purchase.findByPk(purchaseId, { transaction });
    
    if (!purchase) {
      throw new Error(`Purchase with ID ${purchaseId} not found`);
    }

    // Add any purchase-specific validation rules here
    // For example: check if purchase is part of a batch, has special constraints, etc.
    
    console.log(`✅ [Purchase Validation] Purchase ${purchase.registrationNumber} validated for deletion`);
  }

  /**
   * Get purchase deletion impact summary
   * Useful for approval workflow to show what will be affected
   */
  async getPurchaseDeletionImpact(purchaseId: number, transaction: Transaction): Promise<any> {
    const purchase = await Purchase.findByPk(purchaseId, { transaction });
    if (!purchase) return null;

    // Count related records that will be affected
    const bankEntries = await BankRegister.count({
      where: { 
        relatedDocumentNumber: purchase.registrationNumber,
        deletion_status: { [Op.ne]: 'EXECUTED' }
      },
      transaction
    });

    const cashEntries = await CashRegister.count({
      where: { 
        relatedDocumentNumber: purchase.registrationNumber,
        deletion_status: { [Op.ne]: 'EXECUTED' }
      },
      transaction
    });

    return {
      purchaseId: purchase.id,
      registrationNumber: purchase.registrationNumber,
      amount: purchase.total,
      paidAmount: purchase.paidAmount,
      paymentStatus: purchase.paymentStatus,
      affectedRecords: {
        bankEntries,
        cashEntries,
        accountsPayable: 1 // The purchase itself creates AP records
      },
      estimatedOperations: bankEntries + cashEntries + 2 // +2 for status update and soft delete
    };
  }
}