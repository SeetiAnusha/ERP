/**
 * Sale Deletion Handler
 * 
 * Extracted from TransactionDeletionService to improve maintainability
 * Handles all sale-specific deletion logic without changing business rules
 */

import { Transaction, Op } from 'sequelize';
import Sale from '../../../models/Sale';
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
  type: 'BANK_REVERSAL' | 'CASH_REVERSAL' | 'CC_REGISTER_REVERSAL' | 'STATUS_UPDATE' | 'SOFT_DELETE' | 'CREATE_REVERSAL_AP' | 'CREATE_MANUAL_TASK' | 'RESTORE_CREDIT_LIMIT' | 'BANK_BALANCE_UPDATE' | 'INVENTORY_RESTORE';
  targetTable: string;
  targetId: number;
  data: any;
  priority: number;
}

export class SaleDeletionHandler extends BaseService {

  /**
   * Generate reversal operations for sale deletion
   * 
   * FIXED: Removed duplicate bank/cash reversal logic (handled by separate handlers)
   * ADDED: Product inventory restoration logic
   */
  async generateReversalOperations(
    node: TransactionNode,
    approvalRequest: ApprovalRequest,
    executedBy: number,
    transaction: Transaction
  ): Promise<ReversalOperation[]> {
    const operations: ReversalOperation[] = [];
    
    const sale = await Sale.findByPk(node.id, { 
      include: [
        {
          model: (await import('../../../models/SaleItem')).default,
          as: 'items',
          include: [
            {
              model: (await import('../../../models/Product')).default,
              as: 'product'
            }
          ]
        }
      ],
      transaction 
    });
    if (!sale) return operations;
    
    const collectedAmount = parseFloat(sale.collectedAmount?.toString() || '0');
    
    console.log(`💰 [Sale Analysis] ${sale.registrationNumber}: Total=${sale.total}, Collected=${collectedAmount}, Status=${sale.collectionStatus}`);
    
    // ✅ CRITICAL FIX: Restore products back to inventory
    const saleItems = (sale as any).items; // Type assertion for included items
    if (saleItems && saleItems.length > 0) {
      console.log(`📦 [Inventory Restoration] Restoring ${saleItems.length} products back to inventory...`);
      
      for (const item of saleItems) {
        operations.push({
          type: 'INVENTORY_RESTORE',
          targetTable: 'products',
          targetId: item.productId,
          data: {
            productId: item.productId,
            quantityToRestore: item.quantity,
            saleRegistrationNumber: sale.registrationNumber,
            originalSalePrice: item.unitPrice,
            description: `Inventory restoration for sale deletion ${sale.registrationNumber}`,
            deletion_approval_id: approvalRequest.id
          },
          priority: 1 // High priority - restore inventory first
        });
        
        console.log(`📦 [Inventory Restore] Queued restoration for Product ${item.productId}: +${item.quantity} units`);
      }
    }
    
    // ✅ REMOVED: Bank and cash reversal logic (now handled by BankDeletionHandler and CashDeletionHandler)
    // This prevents DOUBLE REVERSALS that were causing money to come out twice
    
    // Reset sale collection status if it was collected
    if (collectedAmount > 0) {
      operations.push({
        type: 'STATUS_UPDATE',
        targetTable: 'sales',
        targetId: sale.id,
        data: {
          collectedAmount: 0,
          balanceAmount: parseFloat(sale.total.toString()),
          collectionStatus: 'Not Collected'
        },
        priority: 2
      });
      
      console.log(`📝 [Status Reset] Sale collection status will be reset to 'Not Collected'`);
    }
    
    // Update related AR records
    operations.push({
      type: 'SOFT_DELETE',
      targetTable: 'accounts_receivables',
      targetId: 0,
      data: {
        relatedDocumentNumber: sale.registrationNumber,
        deletion_status: 'EXECUTED',
        deleted_at: new Date(),
        deleted_by: executedBy,
        deletion_reason_code: approvalRequest.deletion_reason_code,
        deletion_memo: approvalRequest.custom_memo,
        deletion_approval_id: approvalRequest.id
      },
      priority: 3
    });
    
    // Soft delete the sale
    operations.push({
      type: 'SOFT_DELETE',
      targetTable: 'sales',
      targetId: sale.id,
      data: {
        deletion_status: 'EXECUTED',
        deleted_at: new Date(),
        deleted_by: executedBy,
        deletion_reason_code: approvalRequest.deletion_reason_code,
        deletion_memo: approvalRequest.custom_memo,
        deletion_approval_id: approvalRequest.id
      },
      priority: 4
    });
    
    console.log(`✅ [Sale Operations] Generated ${operations.length} operations for ${sale.registrationNumber} - Fixed double reversal issue + Added inventory restoration`);
    return operations;
  }

  /**
   * Validate sale-specific deletion requirements
   */
  async validateSaleDeletion(saleId: number, transaction: Transaction): Promise<void> {
    const sale = await Sale.findByPk(saleId, { transaction });
    
    if (!sale) {
      throw new Error(`Sale with ID ${saleId} not found`);
    }

    // Add any sale-specific validation rules here
    console.log(`✅ [Sale Validation] Sale ${sale.registrationNumber} validated for deletion`);
  }

  /**
   * Get sale deletion impact summary
   */
  async getSaleDeletionImpact(saleId: number, transaction: Transaction): Promise<any> {
    const sale = await Sale.findByPk(saleId, { transaction });
    if (!sale) return null;

    // Count related records that will be affected
    const bankEntries = await BankRegister.count({
      where: { 
        relatedDocumentNumber: sale.registrationNumber,
        deletion_status: { [Op.ne]: 'EXECUTED' }
      },
      transaction
    });

    const cashEntries = await CashRegister.count({
      where: { 
        relatedDocumentNumber: sale.registrationNumber,
        deletion_status: { [Op.ne]: 'EXECUTED' }
      },
      transaction
    });

    return {
      saleId: sale.id,
      registrationNumber: sale.registrationNumber,
      amount: sale.total,
      collectedAmount: sale.collectedAmount,
      collectionStatus: sale.collectionStatus,
      affectedRecords: {
        bankEntries,
        cashEntries,
        accountsReceivable: 1 // The sale itself creates AR records
      },
      estimatedOperations: bankEntries + cashEntries + 2 // +2 for status update and soft delete
    };
  }
}