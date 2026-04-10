import ChartOfAccounts, { AccountType, AccountSubType } from '../../models/accounting/ChartOfAccounts';
import { BaseService } from '../../core/BaseService';
import { ValidationError, NotFoundError } from '../../core/AppError';

/**
 * Chart of Accounts Service
 * 
 * Manages GL account structure and hierarchy
 */

interface CreateAccountRequest {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  accountSubType: AccountSubType;
  parentAccountId?: number;
  level?: number;
  description?: string;
}

class ChartOfAccountsService extends BaseService {
  
  /**
   * Get all accounts
   */
  async getAllAccounts(): Promise<ChartOfAccounts[]> {
    return await ChartOfAccounts.findAll({
      order: [['accountCode', 'ASC']],
    });
  }
  
  /**
   * Get account by ID
   */
  async getAccountById(id: number): Promise<ChartOfAccounts> {
    const account = await ChartOfAccounts.findByPk(id);
    if (!account) {
      throw new NotFoundError(`Account not found: ${id}`);
    }
    return account;
  }
  
  /**
   * Get account by code
   */
  async getAccountByCode(accountCode: string): Promise<ChartOfAccounts> {
    const account = await ChartOfAccounts.findOne({
      where: { accountCode },
    });
    if (!account) {
      throw new NotFoundError(`Account not found: ${accountCode}`);
    }
    return account;
  }
  
  /**
   * Create new account
   */
  async createAccount(data: CreateAccountRequest): Promise<ChartOfAccounts> {
    // Validate account code uniqueness
    const existing = await ChartOfAccounts.findOne({
      where: { accountCode: data.accountCode },
    });
    
    if (existing) {
      throw new ValidationError(`Account code already exists: ${data.accountCode}`);
    }
    
    // Determine normal balance based on account type
    const normalBalance = this.getNormalBalance(data.accountType);
    
    return await ChartOfAccounts.create({
      ...data,
      level: data.level || 1,
      isActive: true,
      isSystemAccount: false,
      normalBalance,
    });
  }
  
  /**
   * Get normal balance for account type
   */
  private getNormalBalance(accountType: AccountType): 'DEBIT' | 'CREDIT' {
    switch (accountType) {
      case AccountType.ASSET:
      case AccountType.EXPENSE:
        return 'DEBIT';
      case AccountType.LIABILITY:
      case AccountType.EQUITY:
      case AccountType.REVENUE:
        return 'CREDIT';
      default:
        return 'DEBIT';
    }
  }
  
  /**
   * Initialize default chart of accounts
   */
  async initializeDefaultAccounts(): Promise<void> {
    const defaultAccounts = this.getDefaultAccounts();
    
    for (const account of defaultAccounts) {
      const existing = await ChartOfAccounts.findOne({
        where: { accountCode: account.accountCode },
      });
      
      if (!existing) {
        await ChartOfAccounts.create({
          ...account,
          isActive: true,
          isSystemAccount: true,
        });
      }
    }
  }

  /**
   * Update account
   */
  async updateAccount(id: number, data: Partial<CreateAccountRequest>): Promise<ChartOfAccounts> {
    const account = await this.getAccountById(id);
    
    // Prevent updating system accounts' critical fields
    if (account.isSystemAccount) {
      const { accountCode, accountType, ...safeData } = data;
      await account.update(safeData);
    } else {
      await account.update(data);
    }
    
    return account;
  }
  
  /**
   * Delete account
   */
  async deleteAccount(id: number): Promise<void> {
    const account = await this.getAccountById(id);
    
    // Prevent deleting system accounts
    if (account.isSystemAccount) {
      throw new ValidationError('Cannot delete system account');
    }
    
    // Check if account has transactions (optional - add this check if needed)
    // const hasTransactions = await GeneralLedger.count({ where: { accountId: id } });
    // if (hasTransactions > 0) {
    //   throw new ValidationError('Cannot delete account with existing transactions');
    // }
    
    await account.destroy();
  }

  
  /**
   * Get default chart of accounts
   */
  private getDefaultAccounts() {
    return [
      // ASSETS
      { accountCode: '1000', accountName: 'Assets', accountType: AccountType.ASSET, accountSubType: AccountSubType.CURRENT_ASSET, level: 1, normalBalance: 'DEBIT' as const },
      { accountCode: '1010', accountName: 'Cash', accountType: AccountType.ASSET, accountSubType: AccountSubType.CASH, level: 2, normalBalance: 'DEBIT' as const },
      { accountCode: '1020', accountName: 'Bank Account', accountType: AccountType.ASSET, accountSubType: AccountSubType.BANK, level: 2, normalBalance: 'DEBIT' as const },
      { accountCode: '1100', accountName: 'Inventory', accountType: AccountType.ASSET, accountSubType: AccountSubType.INVENTORY, level: 2, normalBalance: 'DEBIT' as const },
      { accountCode: '1200', accountName: 'Accounts Receivable', accountType: AccountType.ASSET, accountSubType: AccountSubType.ACCOUNTS_RECEIVABLE, level: 2, normalBalance: 'DEBIT' as const },
      { accountCode: '1500', accountName: 'Fixed Assets', accountType: AccountType.ASSET, accountSubType: AccountSubType.FIXED_ASSET, level: 2, normalBalance: 'DEBIT' as const },
      
      // LIABILITIES
      { accountCode: '2000', accountName: 'Liabilities', accountType: AccountType.LIABILITY, accountSubType: AccountSubType.CURRENT_LIABILITY, level: 1, normalBalance: 'CREDIT' as const },
      { accountCode: '2100', accountName: 'Accounts Payable', accountType: AccountType.LIABILITY, accountSubType: AccountSubType.ACCOUNTS_PAYABLE, level: 2, normalBalance: 'CREDIT' as const },
      { accountCode: '2200', accountName: 'Credit Card Payable', accountType: AccountType.LIABILITY, accountSubType: AccountSubType.CREDIT_CARD, level: 2, normalBalance: 'CREDIT' as const },
      
      // EQUITY
      { accountCode: '3000', accountName: 'Equity', accountType: AccountType.EQUITY, accountSubType: AccountSubType.CAPITAL, level: 1, normalBalance: 'CREDIT' as const },
      { accountCode: '3100', accountName: 'Owner Capital', accountType: AccountType.EQUITY, accountSubType: AccountSubType.CAPITAL, level: 2, normalBalance: 'CREDIT' as const },
      { accountCode: '3200', accountName: 'Retained Earnings', accountType: AccountType.EQUITY, accountSubType: AccountSubType.RETAINED_EARNINGS, level: 2, normalBalance: 'CREDIT' as const },
      
      // REVENUE
      { accountCode: '4000', accountName: 'Sales Revenue', accountType: AccountType.REVENUE, accountSubType: AccountSubType.SALES_REVENUE, level: 1, normalBalance: 'CREDIT' as const },
      { accountCode: '4100', accountName: 'Service Revenue', accountType: AccountType.REVENUE, accountSubType: AccountSubType.SERVICE_REVENUE, level: 2, normalBalance: 'CREDIT' as const },
      { accountCode: '4900', accountName: 'Other Income', accountType: AccountType.REVENUE, accountSubType: AccountSubType.OTHER_INCOME, level: 2, normalBalance: 'CREDIT' as const },
      
      // EXPENSES
      { accountCode: '5000', accountName: 'Cost of Goods Sold', accountType: AccountType.EXPENSE, accountSubType: AccountSubType.COST_OF_GOODS_SOLD, level: 1, normalBalance: 'DEBIT' as const },
      { accountCode: '6000', accountName: 'Operating Expenses', accountType: AccountType.EXPENSE, accountSubType: AccountSubType.OPERATING_EXPENSE, level: 1, normalBalance: 'DEBIT' as const },
      { accountCode: '6100', accountName: 'Administrative Expenses', accountType: AccountType.EXPENSE, accountSubType: AccountSubType.ADMINISTRATIVE_EXPENSE, level: 2, normalBalance: 'DEBIT' as const },
      { accountCode: '6200', accountName: 'Financial Expenses', accountType: AccountType.EXPENSE, accountSubType: AccountSubType.FINANCIAL_EXPENSE, level: 2, normalBalance: 'DEBIT' as const },
      { accountCode: '6300', accountName: 'Credit Card Fees', accountType: AccountType.EXPENSE, accountSubType: AccountSubType.FINANCIAL_EXPENSE, level: 3, normalBalance: 'DEBIT' as const },
      { accountCode: '6310', accountName: 'Bank Fees', accountType: AccountType.EXPENSE, accountSubType: AccountSubType.FINANCIAL_EXPENSE, level: 3, normalBalance: 'DEBIT' as const },
    ];
  }
}

export default new ChartOfAccountsService();
