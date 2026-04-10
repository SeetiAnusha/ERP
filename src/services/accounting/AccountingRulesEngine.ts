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
   * Get GL entries for Purchase transaction (CASH/BANK payment)
   */
  getPurchaseGLEntries(amount: number, paymentType: string): GLEntry[] {
    if (paymentType === 'CASH') {
      return [
        {
          accountCode: '5000', // Inventory/Purchases
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
    } else if (paymentType === 'BANK' || paymentType === 'BANK_TRANSFER') {
      return [
        {
          accountCode: '5000', // Inventory/Purchases
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
      // Default to bank
      return this.getPurchaseGLEntries(amount, 'BANK');
    }
  }
  
  /**
   * Get GL entries for Purchase on Credit
   */
  getPurchaseOnCreditGLEntries(amount: number): GLEntry[] {
    return [
      {
        accountCode: '5000', // Inventory/Purchases
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
   * Get GL entries for Sale transaction (CASH payment)
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
