import { Op } from 'sequelize';
import sequelize from '../../config/database';
import GeneralLedger, { EntryType } from '../../models/accounting/GeneralLedger';
import ChartOfAccounts from '../../models/accounting/ChartOfAccounts';
import AccountBalance from '../../models/accounting/AccountBalance';
import { BaseService } from '../../core/BaseService';

/**
 * Trial Balance Service
 * 
 * Generates trial balance and validates accounting equation
 */

interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: string;
  debitBalance: number;
  creditBalance: number;
}

interface TrialBalanceReport {
  asOfDate: Date;
  rows: TrialBalanceRow[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  difference: number;
}

class TrialBalanceService extends BaseService {
  
  /**
   * Generate trial balance report
   */
  async generateTrialBalance(asOfDate?: Date): Promise<TrialBalanceReport> {
    const endDate = asOfDate || new Date();
    
    // Get all accounts with balances
    const accounts = await ChartOfAccounts.findAll({
      where: { isActive: true },
      order: [['accountCode', 'ASC']],
    });
    
    const rows: TrialBalanceRow[] = [];
    let totalDebits = 0;
    let totalCredits = 0;
    
    for (const account of accounts) {
      const balance = await this.getAccountBalance(account.id, endDate);
      
      if (balance.debitBalance > 0 || balance.creditBalance > 0) {
        rows.push({
          accountCode: account.accountCode,
          accountName: account.accountName,
          accountType: account.accountType,
          debitBalance: balance.debitBalance,
          creditBalance: balance.creditBalance,
        });
        
        totalDebits += balance.debitBalance;
        totalCredits += balance.creditBalance;
      }
    }
    
    const difference = Math.abs(totalDebits - totalCredits);
    const isBalanced = difference < 0.01;
    
    return {
      asOfDate: endDate,
      rows,
      totalDebits,
      totalCredits,
      isBalanced,
      difference,
    };
  }
  
  /**
   * Get account balance as of date
   */
  private async getAccountBalance(accountId: number, asOfDate: Date): Promise<{ debitBalance: number; creditBalance: number }> {
    const account = await ChartOfAccounts.findByPk(accountId);
    if (!account) {
      return { debitBalance: 0, creditBalance: 0 };
    }
    
    // Sum all GL entries up to date
    const entries = await GeneralLedger.findAll({
      where: {
        accountId,
        entryDate: { [Op.lte]: asOfDate },
        isPosted: true,
        isReversed: false,
      },
    });
    
    let debitTotal = 0;
    let creditTotal = 0;
    
    for (const entry of entries) {
      if (entry.entryType === EntryType.DEBIT) {
        debitTotal += parseFloat(entry.amount.toString());
      } else {
        creditTotal += parseFloat(entry.amount.toString());
      }
    }
    
    // Calculate balance based on normal balance
    if (account.normalBalance === 'DEBIT') {
      const balance = debitTotal - creditTotal;
      return {
        debitBalance: balance > 0 ? balance : 0,
        creditBalance: balance < 0 ? Math.abs(balance) : 0,
      };
    } else {
      const balance = creditTotal - debitTotal;
      return {
        debitBalance: balance < 0 ? Math.abs(balance) : 0,
        creditBalance: balance > 0 ? balance : 0,
      };
    }
  }
}

export default new TrialBalanceService();
