import { Op } from 'sequelize';
import AccountBalance from '../../models/accounting/AccountBalance';
import ChartOfAccounts from '../../models/accounting/ChartOfAccounts';
import FiscalPeriod from '../../models/accounting/FiscalPeriod';
import { BaseService } from '../../core/BaseService';
import { NotFoundError, ValidationError } from '../../core/AppError';

/**
 * Account Balance Service
 * 
 * Manages account balance queries and operations
 */

class AccountBalanceService extends BaseService {
  
  /**
   * Get all account balances with pagination
   */
  async getAllAccountBalances(options: any = {}): Promise<any> {
    return this.executeWithRetry(async () => {
      if (options.page || options.limit) {
        return await this.getAllWithPagination(
          AccountBalance,
          {
            ...options,
            searchFields: [],
            dateField: 'lastUpdated'
          },
          {},
          [
            {
              model: ChartOfAccounts,
              as: 'account',
              attributes: ['accountCode', 'accountName', 'accountType', 'normalBalance'],
            },
            {
              model: FiscalPeriod,
              as: 'fiscalPeriod',
              attributes: ['periodName', 'fiscalYear', 'status'],
              required: false,
            },
          ]
        );
      }
      
      // Return all balances
      return await AccountBalance.findAll({
        include: [
          {
            model: ChartOfAccounts,
            as: 'account',
            attributes: ['accountCode', 'accountName', 'accountType', 'normalBalance'],
          },
          {
            model: FiscalPeriod,
            as: 'fiscalPeriod',
            attributes: ['periodName', 'fiscalYear', 'status'],
            required: false,
          },
        ],
        order: [['accountId', 'ASC']],
      });
    });
  }
  
  /**
   * Get balance by account ID
   */
  async getBalanceByAccountId(accountId: number, fiscalPeriodId?: number): Promise<AccountBalance | null> {
    const whereClause: any = {
      accountId,
    };
    
    if (fiscalPeriodId) {
      whereClause.fiscalPeriodId = fiscalPeriodId;
    } else {
      whereClause.fiscalPeriodId = { [Op.is]: null };
    }
    
    return await AccountBalance.findOne({
      where: whereClause,
      include: [
        {
          model: ChartOfAccounts,
          as: 'account',
        },
      ],
    });
  }
  
  /**
   * Get balances by account type
   */
  async getBalancesByAccountType(accountType: string): Promise<AccountBalance[]> {
    return await AccountBalance.findAll({
      include: [
        {
          model: ChartOfAccounts,
          as: 'account',
          where: { accountType },
        },
      ],
      order: [['accountId', 'ASC']],
    });
  }
  
  /**
   * Get current period balances
   */
  async getCurrentPeriodBalances(): Promise<AccountBalance[]> {
    const whereClause: any = {
      fiscalPeriodId: { [Op.is]: null },
    };
    
    return await AccountBalance.findAll({
      where: whereClause,
      include: [
        {
          model: ChartOfAccounts,
          as: 'account',
        },
      ],
      order: [['accountId', 'ASC']],
    });
  }
  
  /**
   * Get balance summary by account type
   */
  async getBalanceSummaryByType(): Promise<any> {
    const balances = await this.getCurrentPeriodBalances();
    
    const summary: any = {
      ASSET: { debitTotal: 0, creditTotal: 0, closingBalance: 0, count: 0 },
      LIABILITY: { debitTotal: 0, creditTotal: 0, closingBalance: 0, count: 0 },
      EQUITY: { debitTotal: 0, creditTotal: 0, closingBalance: 0, count: 0 },
      REVENUE: { debitTotal: 0, creditTotal: 0, closingBalance: 0, count: 0 },
      EXPENSE: { debitTotal: 0, creditTotal: 0, closingBalance: 0, count: 0 },
    };
    
    for (const balance of balances) {
      if (balance.account) {
        const type = balance.account.accountType;
        summary[type].debitTotal += parseFloat(balance.debitTotal.toString());
        summary[type].creditTotal += parseFloat(balance.creditTotal.toString());
        summary[type].closingBalance += parseFloat(balance.closingBalance.toString());
        summary[type].count++;
      }
    }
    
    return summary;
  }
}

export default new AccountBalanceService();
