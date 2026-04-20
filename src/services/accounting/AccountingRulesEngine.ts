import { EntryType, SourceModule } from '../../models/accounting/GeneralLedger';
import { GLEntry } from './GLPostingService';

/**
 * Accounting Rules Engine
 * 
 * Defines debit/credit rules for each transaction type.
 * Maps business transactions to GL account codes.
 */

export interface TransactionMapping {
  debitAccount: string;
  creditAccount: string;
  description: string;
}

class AccountingRulesEngine {
  
  /**
   * Get GL entries for Purchase transaction (CASH/BANK payment ONLY)
   * ✅ FIXED: Now throws error for unsupported payment types
   * 
   * NOTE: For credit card purchases, use getPurchaseWithCreditCardGLEntries()
   *       For credit purchases, use getPurchaseOnCreditGLEntries()
   */
  getPurchaseGLEntries(amount: number, paymentType: string): GLEntry[] {
    const type = paymentType.toUpperCase();
    
    if (type === 'CASH') {
      return [
        {
          accountCode: '1100', // ✅ Inventory Asset
          entryType: EntryType.DEBIT,
          amount,
          description: 'Purchase of inventory',
        },
        {
          accountCode: '1010', // Cash
          entryType: EntryType.CREDIT,
          amount,
          description: 'Cash payment for purchase',
        },
      ];
    } else if (type === 'BANK' || type === 'BANK_TRANSFER' || type === 'CHEQUE' || type === 'CHECK') {
      return [
        {
          accountCode: '1100', // ✅ Inventory Asset
          entryType: EntryType.DEBIT,
          amount,
          description: 'Purchase of inventory',
        },
        {
          accountCode: '1020', // Bank Account
          entryType: EntryType.CREDIT,
          amount,
          description: 'Bank payment for purchase',
        },
      ];
    } else {
      // ✅ FIX: Throw error instead of defaulting to bank
      // This prevents incorrect GL entries for unsupported payment types
      throw new Error(
        `Invalid payment type "${paymentType}" for getPurchaseGLEntries(). ` +
        `Use getPurchaseWithCreditCardGLEntries() for credit card or ` +
        `getPurchaseOnCreditGLEntries() for credit purchases.`
      );
    }
  }
  
  /**
   * Get GL entries for Purchase on Credit (Supplier Invoice)
   * ✅ FIXED: Now uses Inventory (1100) instead of COGS (5000)
   */
  getPurchaseOnCreditGLEntries(amount: number): GLEntry[] {
    return [
      {
        accountCode: '1100', // ✅ Inventory Asset
        entryType: EntryType.DEBIT,
        amount,
        description: 'Purchase of inventory on credit',
      },
      {
        accountCode: '2100', // Accounts Payable
        entryType: EntryType.CREDIT,
        amount,
        description: 'Accounts payable for purchase',
      },
    ];
  }

  /**
   * ✅ NEW: Get GL entries for Purchase with Credit Card
   * Credit card purchases create a liability until settlement
   */
  getPurchaseWithCreditCardGLEntries(amount: number): GLEntry[] {
    return [
      {
        accountCode: '1100', // Inventory Asset
        entryType: EntryType.DEBIT,
        amount,
        description: 'Purchase of inventory with credit card',
      },
      {
        accountCode: '2200', // Credit Card Payable
        entryType: EntryType.CREDIT,
        amount,
        description: 'Credit card payable for purchase',
      },
    ];
  }

  /**
   * ✅ NEW: Get GL entries for Credit Card Payment Settlement
   * When credit card company debits your bank account
   */
  getCreditCardSettlementGLEntries(amount: number, paymentMethod: string = 'BANK'): GLEntry[] {
    const creditAccount = paymentMethod === 'CASH' ? '1010' : '1020';
    const description = paymentMethod === 'CASH' ? 'Cash payment for credit card' : 'Bank payment for credit card settlement';
    
    return [
      {
        accountCode: '2200', // Credit Card Payable
        entryType: EntryType.DEBIT,
        amount,
        description: 'Payment of credit card liability',
      },
      {
        accountCode: creditAccount, // Cash or Bank
        entryType: EntryType.CREDIT,
        amount,
        description,
      },
    ];
  }

  
  /**
   * Get GL entries for Sale transaction (CASH payment)
   * ✅ NOTE: This only records Revenue. COGS must be posted separately using getSaleCOGSEntries()
   */
  getSaleCashGLEntries(amount: number): GLEntry[] {
    return [
      {
        accountCode: '1010', // Cash
        entryType: EntryType.DEBIT,
        amount,
        description: 'Cash received from sale',
      },
      {
        accountCode: '4000', // Sales Revenue
        entryType: EntryType.CREDIT,
        amount,
        description: 'Revenue from sale',
      },
    ];
  }
  
  /**
   * Get GL entries for Sale on Credit
   * ✅ NOTE: This only records Revenue. COGS must be posted separately using getSaleCOGSEntries()
   */
  getSaleOnCreditGLEntries(amount: number): GLEntry[] {
    return [
      {
        accountCode: '1200', // Accounts Receivable
        entryType: EntryType.DEBIT,
        amount,
        description: 'Accounts receivable from sale',
      },
      {
        accountCode: '4000', // Sales Revenue
        entryType: EntryType.CREDIT,
        amount,
        description: 'Revenue from credit sale',
      },
    ];
  }
  
  /**
   * ✅ NEW: Get GL entries for COGS (Cost of Goods Sold)
   * This transfers cost from Inventory to COGS when items are sold
   * 
   * @param costAmount - The cost of inventory sold (not the selling price)
   * @returns GL entries to record COGS
   */
  getSaleCOGSEntries(costAmount: number): GLEntry[] {
    return [
      {
        accountCode: '5000', // Cost of Goods Sold (Expense)
        entryType: EntryType.DEBIT,
        amount: costAmount,
        description: 'Cost of goods sold',
      },
      {
        accountCode: '1100', // Inventory (Asset)
        entryType: EntryType.CREDIT,
        amount: costAmount,
        description: 'Inventory reduction from sale',
      },
    ];
  }
  
  /**
   * Get GL entries for AP Payment
   */
  getAPPaymentGLEntries(amount: number, paymentMethod: string): GLEntry[] {
    const creditAccount = paymentMethod === 'CASH' ? '1010' : '1020';
    const description = paymentMethod === 'CASH' ? 'Cash payment' : 'Bank payment';
    
    return [
      {
        accountCode: '2100', // Accounts Payable
        entryType: EntryType.DEBIT,
        amount,
        description: 'Payment of accounts payable',
      },
      {
        accountCode: creditAccount,
        entryType: EntryType.CREDIT,
        amount,
        description,
      },
    ];
  }
  
  /**
   * Get GL entries for AR Collection
   */
  getARCollectionGLEntries(amount: number, collectionMethod: string): GLEntry[] {
    const debitAccount = collectionMethod === 'CASH' ? '1010' : '1020';
    const description = collectionMethod === 'CASH' ? 'Cash received' : 'Bank deposit received';
    
    return [
      {
        accountCode: debitAccount,
        entryType: EntryType.DEBIT,
        amount,
        description,
      },
      {
        accountCode: '1200', // Accounts Receivable
        entryType: EntryType.CREDIT,
        amount,
        description: 'Collection of accounts receivable',
      },
    ];
  }
  
  /**
   * Get GL entries for Business Expense
   */
  getBusinessExpenseGLEntries(amount: number, expenseType: string, paymentMethod: string): GLEntry[] {
    const expenseAccount = this.getExpenseAccountCode(expenseType);
    const creditAccount = paymentMethod === 'CASH' ? '1010' : '1020';
    const description = paymentMethod === 'CASH' ? 'Cash payment' : 'Bank payment';
    
    return [
      {
        accountCode: expenseAccount,
        entryType: EntryType.DEBIT,
        amount,
        description: `Business expense: ${expenseType}`,
      },
      {
        accountCode: creditAccount,
        entryType: EntryType.CREDIT,
        amount,
        description,
      },
    ];
  }
  
  /**
   * Map expense type to GL account code
   */
  private getExpenseAccountCode(expenseType: string): string {
    const expenseMapping: Record<string, string> = {
      'OPERATING': '6000',
      'ADMINISTRATIVE': '6100',
      'FINANCIAL': '6200',
      'CREDIT_CARD_FEE': '6300',
      'BANK_FEE': '6310',
      'DEFAULT': '6000',
    };
    
    return expenseMapping[expenseType] || expenseMapping['DEFAULT'];
  }
}

export default new AccountingRulesEngine();
