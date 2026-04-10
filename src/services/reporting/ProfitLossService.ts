import ChartOfAccounts from '../../models/accounting/ChartOfAccounts';
import GeneralLedger from '../../models/accounting/GeneralLedger';
import ReportCacheService from './ReportCacheService';
import { ProfitLossOptions, ProfitLossReport, ProfitLossRow, ProfitLossSection } from '../../types/reporting';
import { Op } from 'sequelize';

/**
 * Profit & Loss Service
 * 
 * Generates Profit & Loss (Income Statement) reports with comparative periods
 * and variance analysis. Calculates Net Income = Total Revenue - Total Expenses.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8
 */
class ProfitLossService {
  /**
   * Generate Profit & Loss report
   */
  async generate(options: ProfitLossOptions): Promise<ProfitLossReport> {
    // Check cache first
    const cacheKey = ReportCacheService.generateCacheKey(
      'profit_loss',
      options,
      `${options.startDate.toISOString()}_${options.endDate.toISOString()}`
    );
    const cached = await ReportCacheService.get(cacheKey);
    if (cached) return cached;

    // Get all Revenue and Expense accounts
    const accounts = await ChartOfAccounts.findAll({
      where: {
        isActive: true,
        accountType: { [Op.in]: ['REVENUE', 'EXPENSE'] },
      },
      order: [['accountCode', 'ASC']],
    });

    // Calculate activity for main period
    const activities = await this.calculateActivities(accounts, options.startDate, options.endDate);

    // Calculate comparative activities if requested
    let comparativeActivities: Map<string, number[]> | undefined;
    if (options.comparativePeriods && options.comparativePeriods.length > 0) {
      comparativeActivities = new Map();
      for (const account of accounts) {
        const compActivities: number[] = [];
        for (const period of options.comparativePeriods) {
          const activity = await this.getAccountActivity(account.id, account.accountType, period.startDate, period.endDate);
          compActivities.push(activity);
        }
        comparativeActivities.set(account.accountCode, compActivities);
      }
    }

    // Group accounts by category
    const revenue = this.groupAccountsByCategory(accounts, activities, comparativeActivities, 'REVENUE', 'Revenue', options.includeZeroBalances);
    const costOfGoodsSold = this.groupAccountsByCategory(accounts, activities, comparativeActivities, 'EXPENSE', 'Cost of Goods Sold', options.includeZeroBalances);
    const operatingExpenses = this.groupAccountsByCategory(accounts, activities, comparativeActivities, 'EXPENSE', 'Operating Expense', options.includeZeroBalances);
    const otherExpenses = this.groupAccountsByCategory(accounts, activities, comparativeActivities, 'EXPENSE', 'Other Expense', options.includeZeroBalances);

    // Calculate totals
    const totalRevenue = this.calculateSectionTotal(revenue);
    const totalCOGS = this.calculateSectionTotal(costOfGoodsSold);
    const grossProfit = totalRevenue - totalCOGS;
    const totalOperatingExpenses = this.calculateSectionTotal(operatingExpenses);
    const operatingIncome = grossProfit - totalOperatingExpenses;
    const totalOtherExpenses = this.calculateSectionTotal(otherExpenses);
    const netIncome = operatingIncome - totalOtherExpenses;

    // Calculate comparative net income
    let comparativeNetIncome: number[] | undefined;
    if (options.comparativePeriods && options.comparativePeriods.length > 0) {
      comparativeNetIncome = [];
      for (let i = 0; i < options.comparativePeriods.length; i++) {
        const compRevenue = this.calculateComparativeTotal(revenue, i);
        const compCOGS = this.calculateComparativeTotal(costOfGoodsSold, i);
        const compOpEx = this.calculateComparativeTotal(operatingExpenses, i);
        const compOtherEx = this.calculateComparativeTotal(otherExpenses, i);
        const compNetIncome = compRevenue - compCOGS - compOpEx - compOtherEx;
        comparativeNetIncome.push(compNetIncome);
      }
    }

    const report: ProfitLossReport = {
      startDate: options.startDate,
      endDate: options.endDate,
      comparativePeriods: options.comparativePeriods,
      revenue,
      costOfGoodsSold,
      operatingExpenses,
      otherExpenses,
      totalRevenue,
      totalCOGS,
      grossProfit,
      totalOperatingExpenses,
      operatingIncome,
      totalOtherExpenses,
      netIncome,
      comparativeNetIncome,
      generatedAt: new Date(),
    };

    // Cache the report
    await ReportCacheService.set(cacheKey, report);

    return report;
  }

  /**
   * Get account activity for a period
   * Revenue: Credits increase, Debits decrease
   * Expense: Debits increase, Credits decrease
   */
  private async getAccountActivity(
    accountId: number,
    accountType: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const entries = await GeneralLedger.findAll({
      where: {
        accountId,
        entryDate: { [Op.between]: [startDate, endDate] },
        isPosted: true,
        isReversed: false,
      },
    });

    let activity = 0;
    for (const entry of entries) {
      const amount = parseFloat(entry.amount.toString());
      
      if (accountType === 'REVENUE') {
        // Revenue: Credits increase, Debits decrease
        activity += entry.entryType === 'CREDIT' ? amount : -amount;
      } else {
        // Expense: Debits increase, Credits decrease
        activity += entry.entryType === 'DEBIT' ? amount : -amount;
      }
    }

    return activity;
  }

  /**
   * Calculate activities for all accounts
   */
  private async calculateActivities(
    accounts: ChartOfAccounts[],
    startDate: Date,
    endDate: Date
  ): Promise<Map<string, number>> {
    const activities = new Map<string, number>();

    for (const account of accounts) {
      const activity = await this.getAccountActivity(account.id, account.accountType, startDate, endDate);
      activities.set(account.accountCode, activity);
    }

    return activities;
  }

  /**
   * Group accounts by category
   */
  private groupAccountsByCategory(
    accounts: ChartOfAccounts[],
    activities: Map<string, number>,
    comparativeActivities: Map<string, number[]> | undefined,
    accountType: string,
    category: string,
    includeZeroBalances?: boolean
  ): ProfitLossSection[] {
    const sections = new Map<string, ProfitLossRow[]>();

    for (const account of accounts) {
      if (account.accountType !== accountType) continue;
      
      // Filter by subtype for category matching
      const subtype = account.accountSubType || 'Other';
      if (accountType === 'EXPENSE' && category !== 'Other Expense') {
        if (category === 'Cost of Goods Sold' && !subtype.includes('COGS')) continue;
        if (category === 'Operating Expense' && (subtype.includes('COGS') || subtype.includes('Other'))) continue;
      }

      const amount = activities.get(account.accountCode) || 0;

      // Skip zero amounts if requested
      if (!includeZeroBalances && Math.abs(amount) < 0.01) continue;

      if (!sections.has(subtype)) {
        sections.set(subtype, []);
      }

      const row: ProfitLossRow = {
        accountCode: account.accountCode,
        accountName: account.accountName,
        amount,
      };

      // Add comparative amounts and variance
      if (comparativeActivities) {
        const compAmounts = comparativeActivities.get(account.accountCode);
        if (compAmounts) {
          row.comparativeAmounts = compAmounts;
          // Calculate variance from first comparative period
          if (compAmounts.length > 0) {
            row.variance = amount - compAmounts[0];
            row.variancePercent = compAmounts[0] !== 0 
              ? ((amount - compAmounts[0]) / Math.abs(compAmounts[0])) * 100 
              : 0;
          }
        }
      }

      sections.get(subtype)!.push(row);
    }

    // Convert to array of sections
    const result: ProfitLossSection[] = [];
    for (const [sectionName, rows] of sections) {
      const total = rows.reduce((sum, row) => sum + row.amount, 0);
      const comparativeTotals = rows[0]?.comparativeAmounts
        ? rows[0].comparativeAmounts.map((_, index) =>
            rows.reduce((sum, row) => sum + (row.comparativeAmounts?.[index] || 0), 0)
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
  private calculateSectionTotal(sections: ProfitLossSection[]): number {
    return sections.reduce((sum, section) => sum + section.total, 0);
  }

  /**
   * Calculate comparative total for a specific period index
   */
  private calculateComparativeTotal(sections: ProfitLossSection[], periodIndex: number): number {
    return sections.reduce((sum, section) => {
      return sum + (section.comparativeTotals?.[periodIndex] || 0);
    }, 0);
  }
}

export default new ProfitLossService();
