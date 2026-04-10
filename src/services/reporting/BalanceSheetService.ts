import ChartOfAccounts from '../../models/accounting/ChartOfAccounts';
import GeneralLedger from '../../models/accounting/GeneralLedger';
import AccountBalance from '../../models/accounting/AccountBalance';
import FiscalPeriod from '../../models/accounting/FiscalPeriod';
import ReportCacheService from './ReportCacheService';
import { BalanceSheetOptions, BalanceSheetReport, BalanceSheetRow, BalanceSheetSection } from '../../types/reporting';
import { ReportValidationError } from '../../core/AppError';
import { Op } from 'sequelize';

/**
 * Balance Sheet Service
 * 
 * Generates Balance Sheet reports with comparative periods and variance analysis.
 * Validates accounting equation: Assets = Liabilities + Equity
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 1.8
 */
class BalanceSheetService {
  /**
   * Generate Balance Sheet report
   */
  async generate(options: BalanceSheetOptions): Promise<BalanceSheetReport> {
    // Check cache first
    const cacheKey = ReportCacheService.generateCacheKey(
      'balance_sheet',
      options,
      options.asOfDate.toISOString()
    );
    const cached = await ReportCacheService.get(cacheKey);
    if (cached) return cached;

    // Get all active accounts
    const accounts = await ChartOfAccounts.findAll({
      where: { isActive: true },
      order: [['accountCode', 'ASC']],
    });

    // Calculate balances for main period
    const balances = await this.calculateBalances(accounts, options.asOfDate);

    // Calculate comparative balances if requested
    let comparativeBalances: Map<string, number[]> | undefined;
    if (options.comparativePeriods && options.comparativePeriods.length > 0) {
      comparativeBalances = new Map();
      for (const account of accounts) {
        const compBalances: number[] = [];
        for (const compDate of options.comparativePeriods) {
          const balance = await this.getAccountBalance(account.id, compDate);
          compBalances.push(balance);
        }
        comparativeBalances.set(account.accountCode, compBalances);
      }
    }

    // Group accounts by type
    const assets = this.groupAccountsByType(accounts, balances, comparativeBalances, 'ASSET', options.includeZeroBalances);
    const liabilities = this.groupAccountsByType(accounts, balances, comparativeBalances, 'LIABILITY', options.includeZeroBalances);
    const equity = this.groupAccountsByType(accounts, balances, comparativeBalances, 'EQUITY', options.includeZeroBalances);

    // Calculate totals
    const totalAssets = this.calculateSectionTotal(assets);
    const totalLiabilities = this.calculateSectionTotal(liabilities);
    const totalEquity = this.calculateSectionTotal(equity);

    // Calculate comparative totals
    let comparativeTotalAssets: number[] | undefined;
    let comparativeTotalLiabilities: number[] | undefined;
    let comparativeTotalEquity: number[] | undefined;

    if (options.comparativePeriods && options.comparativePeriods.length > 0) {
      comparativeTotalAssets = this.calculateComparativeTotals(assets, options.comparativePeriods.length);
      comparativeTotalLiabilities = this.calculateComparativeTotals(liabilities, options.comparativePeriods.length);
      comparativeTotalEquity = this.calculateComparativeTotals(equity, options.comparativePeriods.length);
    }

    // Validate accounting equation: Assets = Liabilities + Equity
    const tolerance = 0.01;
    const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < tolerance;

    if (!isBalanced) {
      throw new ReportValidationError(
        `Balance Sheet does not balance. Assets: ${totalAssets}, Liabilities + Equity: ${totalLiabilities + totalEquity}`,
        {
          totalAssets,
          totalLiabilities,
          totalEquity,
          difference: totalAssets - (totalLiabilities + totalEquity),
        }
      );
    }

    const report: BalanceSheetReport = {
      asOfDate: options.asOfDate,
      comparativeDates: options.comparativePeriods,
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      comparativeTotalAssets,
      comparativeTotalLiabilities,
      comparativeTotalEquity,
      isBalanced,
      generatedAt: new Date(),
    };

    // Cache the report
    await ReportCacheService.set(cacheKey, report);

    return report;
  }

  /**
   * Get account balance as of a specific date
   */
  private async getAccountBalance(accountId: number, asOfDate: Date): Promise<number> {
    // Try to get from account_balances table first (fast path)
    // Get account balance for the period
    const accountBalance = await AccountBalance.findOne({
      where: { accountId },
      include: [{
        model: FiscalPeriod,
        where: {
          startDate: { [Op.lte]: asOfDate },
          endDate: { [Op.gte]: asOfDate }
        },
        required: false
      }]
    });
    if (accountBalance !== null) {
      return accountBalance.closingBalance || 0;
    }

    // Fallback: Calculate from GL entries
    const entries = await GeneralLedger.findAll({
      where: {
        accountId,
        entryDate: { [Op.lte]: asOfDate },
        isPosted: true,
        isReversed: false,
      },
    });

    let balance = 0;
    for (const entry of entries) {
      if (entry.entryType === 'DEBIT') {
        balance += parseFloat(entry.amount.toString());
      } else {
        balance -= parseFloat(entry.amount.toString());
      }
    }

    return balance;
  }

  /**
   * Calculate balances for all accounts
   */
  private async calculateBalances(
    accounts: ChartOfAccounts[],
    asOfDate: Date
  ): Promise<Map<string, number>> {
    const balances = new Map<string, number>();

    for (const account of accounts) {
      const balance = await this.getAccountBalance(account.id, asOfDate);
      balances.set(account.accountCode, balance);
    }

    return balances;
  }

  /**
   * Group accounts by type and create sections
   */
  private groupAccountsByType(
    accounts: ChartOfAccounts[],
    balances: Map<string, number>,
    comparativeBalances: Map<string, number[]> | undefined,
    accountType: string,
    includeZeroBalances?: boolean
  ): BalanceSheetSection[] {
    const sections = new Map<string, BalanceSheetRow[]>();

    for (const account of accounts) {
      if (account.accountType !== accountType) continue;

      const balance = balances.get(account.accountCode) || 0;

      // Skip zero balances if requested
      if (!includeZeroBalances && Math.abs(balance) < 0.01) continue;

      const subtype = account.accountSubType || 'Other';
      if (!sections.has(subtype)) {
        sections.set(subtype, []);
      }

      const row: BalanceSheetRow = {
        accountCode: account.accountCode,
        accountName: account.accountName,
        balance,
      };

      // Add comparative balances if available
      if (comparativeBalances) {
        const compBalances = comparativeBalances.get(account.accountCode);
        if (compBalances) {
          row.comparativeBalances = compBalances;
          // Calculate variance from first comparative period
          if (compBalances.length > 0) {
            row.variance = balance - compBalances[0];
            row.variancePercent = compBalances[0] !== 0 
              ? ((balance - compBalances[0]) / Math.abs(compBalances[0])) * 100 
              : 0;
          }
        }
      }

      sections.get(subtype)!.push(row);
    }

    // Convert to array of sections
    const result: BalanceSheetSection[] = [];
    for (const [sectionName, rows] of sections) {
      const total = rows.reduce((sum, row) => sum + row.balance, 0);
      const comparativeTotals = rows[0]?.comparativeBalances
        ? rows[0].comparativeBalances.map((_, index) =>
            rows.reduce((sum, row) => sum + (row.comparativeBalances?.[index] || 0), 0)
          )
        : undefined;

      result.push({
        sectionName,
        rows,
        total,
        comparativeTotals,
      });
    }

    return result;
  }

  /**
   * Calculate total for all sections
   */
  private calculateSectionTotal(sections: BalanceSheetSection[]): number {
    return sections.reduce((sum, section) => sum + section.total, 0);
  }

  /**
   * Calculate comparative totals across all sections
   */
  private calculateComparativeTotals(sections: BalanceSheetSection[], periodCount: number): number[] {
    const totals: number[] = new Array(periodCount).fill(0);

    for (const section of sections) {
      if (section.comparativeTotals) {
        section.comparativeTotals.forEach((total, index) => {
          totals[index] += total;
        });
      }
    }

    return totals;
  }
}

export default new BalanceSheetService();
