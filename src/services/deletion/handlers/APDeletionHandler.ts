/**
 * Accounts Payable Deletion Handler
 * 
 * Extracted from TransactionDeletionService to improve maintainability
 * Handles all AP-specific deletion logic with complex scenarios
 */

import { Transaction, Op } from 'sequelize';
import AccountsPayable from '../../../models/AccountsPayable';
import BankRegister from '../../../models/BankRegister';
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

export class APDeletionHandler extends BaseService {

  /**
   * Generate reversal operations for AP deletion
   * 
   * EXACT COPY of generateAPReversalOperations from TransactionDeletionService
   * Handles 4 complex scenarios based on payment type and status
   */
  async generateReversalOperations(
    node: TransactionNode,
    approvalRequest: ApprovalRequest,
    executedBy: number,
    transaction: Transaction
  ): Promise<ReversalOperation[]> {
    const ap = await AccountsPayable.findByPk(node.id, { transaction });
    if (!ap) return [];

    // 🎯 DETERMINE AP DELETION SCENARIO
    const scenario = this.determineAPDeletionScenario(ap);
    console.log(`🔍 [AP Scenario] ${ap.registrationNumber}: ${scenario.type} - ${scenario.description}`);

    // 🚀 EXECUTE SCENARIO-SPECIFIC DELETION
    switch (scenario.type) {
      case 'CREDIT_CARD_UNPAID':
        return await this.handleCreditCardUnpaidDeletion(ap, approvalRequest, executedBy, transaction);
      case 'CREDIT_CARD_PAID':
        return await this.handleCreditCardPaidDeletion(ap, approvalRequest, executedBy, transaction);
      case 'CREDIT_PAYMENT_UNPAID':
        return await this.handleCreditPaymentUnpaidDeletion(ap, approvalRequest, executedBy, transaction);
      case 'CREDIT_PAYMENT_PAID':
        return await this.handleCreditPaymentPaidDeletion(ap, approvalRequest, executedBy, transaction);
      default:
        console.warn(`⚠️ [Unknown Scenario] ${scenario.type} - falling back to generic deletion`);
        return await this.handleGenericAPDeletion(ap, approvalRequest, executedBy, transaction);
    }
  }

  /**
   * Determine AP deletion scenario based on payment type and status
   * EXACT COPY from TransactionDeletionService
   */
  private determineAPDeletionScenario(ap: AccountsPayable): { type: string; description: string } {
    const isCardPayment = ap.paymentType === 'CREDIT_CARD' || ap.type === 'CREDIT_CARD_PURCHASE' || ap.type === 'CREDIT_CARD_EXPENSE' || ap.cardId;
    const isCreditPayment = ap.paymentType === 'CREDIT' || ap.type === 'CREDIT' || ap.type === 'EXPENSE_MANAGEMENT' || ap.type === 'SUPPLIER_CREDIT_EXPENSE';
    const isPaid = parseFloat(ap.paidAmount.toString()) > 0;

    console.log(`🔍 [AP Analysis] ${ap.registrationNumber}: paymentType=${ap.paymentType}, type=${ap.type}, cardId=${ap.cardId}, paidAmount=${ap.paidAmount}`);
    console.log(`🔍 [AP Analysis] isCardPayment=${isCardPayment}, isCreditPayment=${isCreditPayment}, isPaid=${isPaid}`);

    if (isCardPayment && !isPaid) {
      return {
        type: 'CREDIT_CARD_UNPAID',
        description: 'Credit card payment not yet charged - Simple deletion'
      };
    }

    if (isCardPayment && isPaid) {
      return {
        type: 'CREDIT_CARD_PAID',
        description: 'Credit card payment already charged - Requires card company dispute'
      };
    }

    if (isCreditPayment && !isPaid) {
      return {
        type: 'CREDIT_PAYMENT_UNPAID',
        description: 'Credit payment not yet made - Simple deletion'
      };
    }

    if (isCreditPayment && isPaid) {
      return {
        type: 'CREDIT_PAYMENT_PAID',
        description: 'Credit payment completed - Requires bank reversal and supplier negotiation'
      };
    }

    // Handle other payment types (cash, check, etc.)
    if (!isPaid) {
      return {
        type: 'GENERIC_UNPAID',
        description: 'Unpaid transaction - Simple deletion'
      };
    }

    return {
      type: 'GENERIC_PAID',
      description: 'Paid transaction - Requires reversal handling'
    };
  }

  /**
   * Scenario 1: Credit Card Purchase - UNPAID
   * Risk: NONE (no money moved yet - just a liability record)
   * Action: Simple soft delete using deletion columns
   */
  private async handleCreditCardUnpaidDeletion(
    ap: AccountsPayable,
    approvalRequest: ApprovalRequest,
    executedBy: number,
    transaction: Transaction
  ): Promise<ReversalOperation[]> {
    console.log(`💳 [Credit Card Unpaid] Simple deletion for ${ap.registrationNumber} - No financial impact (no money moved yet)`);

    return [{
      type: 'SOFT_DELETE',
      targetTable: 'accounts_payables',
      targetId: ap.id,
      data: {
        deletion_status: 'EXECUTED',
        deleted_at: new Date(),
        deleted_by: executedBy,
        deletion_reason_code: approvalRequest.deletion_reason_code,
        deletion_memo: approvalRequest.custom_memo || 'Credit card purchase cancelled - No payment made yet',
        deletion_approval_id: approvalRequest.id
      },
      priority: 1
    }];
  }

  /**
   * Scenario 2: Credit Card Purchase - PAID
   * Risk: HIGH (credit limit used + money sent to supplier)
   * Action: Restore credit limit + reverse credit card register entry
   */
  private async handleCreditCardPaidDeletion(
    ap: AccountsPayable,
    approvalRequest: ApprovalRequest,
    executedBy: number,
    transaction: Transaction
  ): Promise<ReversalOperation[]> {
    console.log(`💳 [Credit Card Paid] Credit limit restoration + AP status reversal required for ${ap.registrationNumber}`);

    const operations: ReversalOperation[] = [];

    // 1. Find and reverse the credit card register entry
    const CreditCardRegister = (await import('../../../models/CreditCardRegister')).default;
    const ccEntry = await CreditCardRegister.findOne({
      where: {
        relatedDocumentNumber: ap.registrationNumber,
        transactionType: 'CHARGE',
        relatedDocumentType: 'Accounts Payable Payment'
      },
      transaction
    });

    if (ccEntry) {
      operations.push({
        type: 'CC_REGISTER_REVERSAL',
        targetTable: 'credit_card_registers',
        targetId: ccEntry.id,
        data: {
          originalEntry: ccEntry,
          reversalType: 'REFUND', // Reverse the CHARGE
          amount: ccEntry.amount,
          description: `Reversal of credit card payment to ${ap.supplierName} - AP deletion (${approvalRequest.deletion_reason_code})`,
          deletion_approval_id: approvalRequest.id
        },
        priority: 1
      });
      
      console.log(`💳 [Credit Card Paid] CC register reversal will automatically restore ${ccEntry.amount} credit for card ${ap.cardId}`);
    } else {
      console.warn(`⚠️ [Credit Card Paid] No CC register entry found for ${ap.registrationNumber} - Adding direct credit restoration`);
      
      // Fallback: If no CC register entry found, restore credit directly
      if (ap.cardId && parseFloat(ap.paidAmount.toString()) > 0) {
        operations.push({
          type: 'RESTORE_CREDIT_LIMIT',
          targetTable: 'cards',
          targetId: ap.cardId,
          data: {
            restoreAmount: parseFloat(ap.paidAmount.toString()),
            description: `Credit limit restored for cancelled AP ${ap.registrationNumber} (fallback)`,
            deletion_approval_id: approvalRequest.id
          },
          priority: 1
        });
      }
    }

    // 2. Update related business expense if this AP came from expense management
    if (ap.type === 'CREDIT_CARD_EXPENSE' && ap.relatedDocumentType === 'Business Expense' && ap.relatedDocumentId) {
      operations.push({
        type: 'STATUS_UPDATE',
        targetTable: 'business_expenses',
        targetId: ap.relatedDocumentId,
        data: {
          payment_status: 'REVERSED',
          paid_amount: 0,
          balance_amount: parseFloat(ap.amount.toString()),
          deletion_status: 'EXECUTED',
          deleted_at: new Date(),
          deleted_by: executedBy,
          deletion_reason_code: approvalRequest.deletion_reason_code,
          deletion_memo: approvalRequest.custom_memo || `Credit card expense reversed - AP ${ap.registrationNumber}`,
          deletion_approval_id: approvalRequest.id
        },
        priority: 2
      });
      
      console.log(`💼 [Business Expense Update] Will update expense ID ${ap.relatedDocumentId} to REVERSED status`);
    }

    // 3. Update AP status to REVERSED
    operations.push({
      type: 'STATUS_UPDATE',
      targetTable: 'accounts_payables',
      targetId: ap.id,
      data: {
        status: 'REVERSED',
        paidAmount: 0,
        balanceAmount: parseFloat(ap.amount.toString()),
        paidDate: null,
        notes: `${ap.notes || ''} | REVERSED: ${approvalRequest.deletion_reason_code}`.trim(),
        deletion_approval_id: approvalRequest.id
      },
      priority: 3
    });

    // 4. Soft delete the AP (for audit trail)
    operations.push({
      type: 'SOFT_DELETE',
      targetTable: 'accounts_payables',
      targetId: ap.id,
      data: {
        deletion_status: 'EXECUTED',
        deleted_at: new Date(),
        deleted_by: executedBy,
        deletion_reason_code: approvalRequest.deletion_reason_code,
        deletion_memo: approvalRequest.custom_memo || `Credit card payment reversed - ${ap.supplierName}`,
        deletion_approval_id: approvalRequest.id
      },
      priority: 4
    });

    console.log(`💳 [Credit Card Paid] Generated ${operations.length} operations for ${ap.registrationNumber}: CC reversal + AP status update + soft delete`);
    return operations;
  }

  /**
   * Scenario 3: Credit Payment (Bank Transfer) - UNPAID
   * Risk: LOW (no bank transfer made yet)
   * Action: Simple soft delete using deletion columns
   */
  private async handleCreditPaymentUnpaidDeletion(
    ap: AccountsPayable,
    approvalRequest: ApprovalRequest,
    executedBy: number,
    transaction: Transaction
  ): Promise<ReversalOperation[]> {
    console.log(`🏦 [Credit Payment Unpaid] Simple deletion for ${ap.registrationNumber} - No bank impact`);

    return [{
      type: 'SOFT_DELETE',
      targetTable: 'accounts_payables',
      targetId: ap.id,
      data: {
        deletion_status: 'EXECUTED',
        deleted_at: new Date(),
        deleted_by: executedBy,
        deletion_reason_code: approvalRequest.deletion_reason_code,
        deletion_memo: approvalRequest.custom_memo || 'Credit payment cancelled before bank transfer',
        deletion_approval_id: approvalRequest.id
      },
      priority: 1
    }];
  }

  /**
   * Scenario 4: Credit Payment (Bank Transfer) - PAID
   * Risk: MEDIUM-HIGH (bank transfer completed, reversal required)
   * Action: Bank register reversal + AP reversal + supplier negotiation task
   */
  private async handleCreditPaymentPaidDeletion(
    ap: AccountsPayable,
    approvalRequest: ApprovalRequest,
    executedBy: number,
    transaction: Transaction
  ): Promise<ReversalOperation[]> {
    console.log(`🏦 [Credit Payment Paid] Bank reversal + balance restoration required for ${ap.registrationNumber} - Amount: ${ap.paidAmount}`);

    const operations: ReversalOperation[] = [];

    // 1. Find related bank register entry (more flexible search)
    const bankEntry = await BankRegister.findOne({
      where: {
        relatedDocumentNumber: ap.registrationNumber,
        relatedDocumentType: 'Accounts Payable Payment'
      },
      transaction
    });

    if (bankEntry) {
      console.log(`🏦 [Credit Payment Paid] Found bank entry ${bankEntry.registrationNumber} - Will reverse and restore ${bankEntry.amount} to account ${bankEntry.bankAccountId}`);
      
      // 2. Create bank register reversal (this will restore bank balance)
      operations.push({
        type: 'BANK_REVERSAL',
        targetTable: 'bank_registers',
        targetId: bankEntry.id,
        data: {
          originalEntry: bankEntry,
          reversalType: bankEntry.transactionType === 'INFLOW' ? 'OUTFLOW' : 'INFLOW',
          amount: bankEntry.amount,
          description: `Reversal of payment to ${ap.supplierName} - AP deletion (${approvalRequest.deletion_reason_code})`,
          deletion_approval_id: approvalRequest.id,
          apRegistrationNumber: ap.registrationNumber // Pass AP number for proper reference
        },
        priority: 1
      });

      // 3. Soft delete original bank entry
      operations.push({
        type: 'SOFT_DELETE',
        targetTable: 'bank_registers',
        targetId: bankEntry.id,
        data: {
          deletion_status: 'EXECUTED',
          deleted_at: new Date(),
          deleted_by: executedBy,
          deletion_reason_code: approvalRequest.deletion_reason_code,
          deletion_memo: `Bank entry deleted due to AP reversal - ${approvalRequest.custom_memo}`,
          deletion_approval_id: approvalRequest.id
        },
        priority: 2
      });
    } else {
      console.warn(`⚠️ [Credit Payment Paid] No bank entry found for ${ap.registrationNumber} - Payment may have been made through different method`);
    }

    // 4. Update related business expense if this AP came from expense management
    if (ap.type === 'SUPPLIER_CREDIT_EXPENSE' && ap.relatedDocumentType === 'Business Expense' && ap.relatedDocumentId) {
      operations.push({
        type: 'STATUS_UPDATE',
        targetTable: 'business_expenses',
        targetId: ap.relatedDocumentId,
        data: {
          payment_status: 'REVERSED',
          paid_amount: 0,
          balance_amount: parseFloat(ap.amount.toString()),
          deletion_status: 'EXECUTED',
          deleted_at: new Date(),
          deleted_by: executedBy,
          deletion_reason_code: approvalRequest.deletion_reason_code,
          deletion_memo: approvalRequest.custom_memo || `Credit expense reversed - AP ${ap.registrationNumber}`,
          deletion_approval_id: approvalRequest.id
        },
        priority: 3
      });
      
      console.log(`💼 [Business Expense Update] Will update expense ID ${ap.relatedDocumentId} to REVERSED status`);
    }

    // 5. Update AP status to REVERSED (not just soft delete)
    operations.push({
      type: 'STATUS_UPDATE',
      targetTable: 'accounts_payables',
      targetId: ap.id,
      data: {
        status: 'REVERSED',
        paidAmount: 0,
        balanceAmount: parseFloat(ap.amount.toString()),
        paidDate: null,
        notes: `${ap.notes || ''} | REVERSED: ${approvalRequest.deletion_reason_code}`.trim(),
        deletion_approval_id: approvalRequest.id
      },
      priority: 4
    });

    // 6. Soft delete the AP (for audit trail)
    operations.push({
      type: 'SOFT_DELETE',
      targetTable: 'accounts_payables',
      targetId: ap.id,
      data: {
        deletion_status: 'EXECUTED',
        deleted_at: new Date(),
        deleted_by: executedBy,
        deletion_reason_code: approvalRequest.deletion_reason_code,
        deletion_memo: approvalRequest.custom_memo || `Credit payment reversed - ${ap.supplierName}`,
        deletion_approval_id: approvalRequest.id
      },
      priority: 5
    });

    console.log(`🏦 [Credit Payment Paid] Generated ${operations.length} operations for ${ap.registrationNumber}`);
    return operations;
  }

  /**
   * Generic AP deletion for unknown scenarios
   */
  private async handleGenericAPDeletion(
    ap: AccountsPayable,
    approvalRequest: ApprovalRequest,
    executedBy: number,
    transaction: Transaction
  ): Promise<ReversalOperation[]> {
    console.log(`❓ [Generic AP] Fallback deletion for ${ap.registrationNumber}`);

    const operations: ReversalOperation[] = [];
    const paidAmount = parseFloat(ap.paidAmount.toString());

    // If paid, try to find and reverse related entries
    if (paidAmount > 0) {
      // Find bank register entries
      const bankEntries = await BankRegister.findAll({
        where: { 
          relatedDocumentNumber: ap.registrationNumber,
          relatedDocumentType: 'Accounts Payable Payment'
        },
        transaction
      });

      // Create bank reversal operations
      for (const bankEntry of bankEntries) {
        operations.push({
          type: 'BANK_REVERSAL',
          targetTable: 'bank_registers',
          targetId: bankEntry.id,
          data: {
            originalEntry: bankEntry,
            reversalType: bankEntry.transactionType === 'OUTFLOW' ? 'INFLOW' : 'OUTFLOW',
            amount: bankEntry.amount,
            description: `Generic reversal of AP payment ${ap.registrationNumber}`,
            deletion_approval_id: approvalRequest.id
          },
          priority: 1
        });
      }
    }

    // Soft delete the AP record
    operations.push({
      type: 'SOFT_DELETE',
      targetTable: 'accounts_payables',
      targetId: ap.id,
      data: {
        deletion_status: 'EXECUTED',
        deleted_at: new Date(),
        deleted_by: executedBy,
        deletion_reason_code: approvalRequest.deletion_reason_code,
        deletion_memo: approvalRequest.custom_memo || 'Generic AP deletion',
        deletion_approval_id: approvalRequest.id
      },
      priority: 2
    });

    return operations;
  }

  /**
   * Validate AP-specific deletion requirements
   */
  async validateAPDeletion(apId: number, transaction: Transaction): Promise<void> {
    const ap = await AccountsPayable.findByPk(apId, { transaction });
    
    if (!ap) {
      throw new Error(`Accounts Payable with ID ${apId} not found`);
    }

    // Add any AP-specific validation rules here
    console.log(`✅ [AP Validation] AP ${ap.registrationNumber} validated for deletion`);
  }

  /**
   * Get AP deletion impact summary
   */
  async getAPDeletionImpact(apId: number, transaction: Transaction): Promise<any> {
    const ap = await AccountsPayable.findByPk(apId, { transaction });
    if (!ap) return null;

    const scenario = this.determineAPDeletionScenario(ap);

    return {
      apId: ap.id,
      registrationNumber: ap.registrationNumber,
      amount: ap.amount,
      paidAmount: ap.paidAmount,
      status: ap.status,
      paymentType: ap.paymentType,
      scenario: scenario,
      riskLevel: this.getRiskLevel(scenario.type),
      estimatedOperations: this.getEstimatedOperations(scenario.type)
    };
  }

  private getRiskLevel(scenarioType: string): string {
    switch (scenarioType) {
      case 'CREDIT_CARD_UNPAID':
      case 'CREDIT_PAYMENT_UNPAID':
      case 'GENERIC_UNPAID':
        return 'LOW';
      case 'CREDIT_PAYMENT_PAID':
        return 'MEDIUM';
      case 'CREDIT_CARD_PAID':
        return 'HIGH';
      default:
        return 'UNKNOWN';
    }
  }

  private getEstimatedOperations(scenarioType: string): number {
    switch (scenarioType) {
      case 'CREDIT_CARD_UNPAID':
      case 'CREDIT_PAYMENT_UNPAID':
        return 1; // Just soft delete
      case 'CREDIT_CARD_PAID':
        return 4; // CC reversal + business expense update + AP update + soft delete
      case 'CREDIT_PAYMENT_PAID':
        return 6; // Bank reversal + bank soft delete + business expense + AP update + soft delete
      default:
        return 2; // Generic fallback
    }
  }
}