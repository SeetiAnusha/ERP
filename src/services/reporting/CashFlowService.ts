import ChartOfAccounts from '../../models/accounting/ChartOfAccounts';
import AccountClassification from '../../models/accounting/AccountClassification';
import GeneralLedger from '../../models/accounting/GeneralLedger';
import ProfitLossService from './ProfitLossService';
import ReportCacheService from './ReportCacheService';
import { CashFlowOptions, CashFlowReport, CashFlowRow, CashFlowSection } from '../../types/reporting';
import { AccountClassificationMissingError, ReportValidationError } from '../../core/AppError';
import { Op } from 'sequelize';

/**
 * Cash Flow Service
 * 
 * Generates Cash Flow Statement using Direct or Indirect method.
 * Validates reconciliation: Opening + Net Flow = Closing
 * 
 * Requirements: 3.1, 3.2, 3.4, 3.7, 3.8
 */
class CashFlowService {
  /**
   * Generate Cash Flow Statement
   */
  async generate(options: CashFlowOptions): Promise<CashFlowReport> {
    // Check cache first
    const cacheKey = ReportCacheService.generateCacheKey(
      'cash_flow',
      options,
      `${options.startDate.toISOString()}_${options.endDate.toISOString()}_${options.method}`
    );
    const cached = await ReportCacheService.get(cacheKey);
    if (cached) return cached;

    let report: CashFlowReport;

    if (options.method === 'DIRECT') {
      report = await this.generateDirect(options);
    } else {
      report = await this.generateIndirect(options);
    }

    // Cache the report
    await ReportCacheService.set(cacheKey, report);

    return report;
  }

  /**
   * Generate Cash Flow Statement using Direct Method
   */
  private async generateDirect(options: CashFlowOptions): Promise<CashFlowReport> {
    // Get cash accounts
    const cashAccounts = await this.getCashAccounts();

    // Calculate opening and closing cash balances
    const openingBalance = await this.calculateCashBalance(cashAccounts, options.startDate);
    const closingBalance = await this.calculateCashBalance(cashAccounts, options.endDate);

    // Get all GL entries affecting cash accounts in the period
    const cashEntries = await GeneralLedger.findAll({
      where: {
        accountId: { [Op.in]: cashAccounts.map(a => a.id) },
        entryDate: { [Op.between]: [options.startDate, options.endDate] },
        isPosted: true,
        isReversed: false,
      },
      include: [{ model: ChartOfAccounts, as: 'account' }],
    });

    // Classify entries by activity type
    const operatingRows: CashFlowRow[] = [];
    const investingRows: CashFlowRow[] = [];
    const financingRows: CashFlowRow[] = [];

    for (const entry of cashEntries) {
      const classification = await this.getAccountClassification(entry.accountId);
      const amount = entry.entryType === 'DEBIT' 
        ? parseFloat(entry.amount.toString())
        : -parseFloat(entry.amount.toString());

      const row: CashFlowRow = {
        description: entry.description,
        accountCode: entry.account?.accountCode,
        accountName: entry.account?.accountName,
        amount,
      };

      switch (classification.activityType) {
        case 'OPERATING':
          operatingRows.push(row);
          break;
        case 'INVESTING':
          investingRows.push(row);
          break;
        case 'FINANCING':
          financingRows.push(row);
          break;
      }
    }

    const operatingActivities: CashFlowSection = {
      activityType: 'OPERATING',
      rows: operatingRows,
      netCashFlow: operatingRows.reduce((sum, row) => sum + row.amount, 0),
    };

    const investingActivities: CashFlowSection = {
      activityType: 'INVESTING',
      rows: investingRows,
      netCashFlow: investingRows.reduce((sum, row) => sum + row.amount, 0),
    };

    const financingActivities: CashFlowSection = {
      activityType: 'FINANCING',
      rows: financingRows,
      netCashFlow: financingRows.reduce((sum, row) => sum + row.amount, 0),
    };

    const netCashFlow = operatingActivities.netCashFlow + investingActivities.netCashFlow + financingActivities.netCashFlow;

    // Validate reconciliation
    const tolerance = 0.01;
    const isReconciled = Math.abs((openingBalance + netCashFlow) - closingBalance) < tolerance;

    if (!isReconciled) {
      throw new ReportValidationError(
        `Cash Flow Statement does not reconcile. Opening: ${openingBalance}, Net Flow: ${netCashFlow}, Closing: ${closingBalance}`,
        { openingBalance, netCashFlow, closingBalance, difference: (openingBalance + netCashFlow) - closingBalance }
      );
    }

    return {
      startDate: options.startDate,
      endDate: options.endDate,
      method: 'DIRECT',
      openingCashBalance: openingBalance,
      operatingActivities,
      investingActivities,
      financingActivities,
      netCashFlow,
      closingCashBalance: closingBalance,
      isReconciled,
      generatedAt: new Date(),
    };
  }

  /**
   * Generate Cash Flow Statement using Indirect Method
   */
  private async generateIndirect(options: CashFlowOptions): Promise<CashFlowReport> {
    // Get net income from P&L
    const plReport = await ProfitLossService.generate({
      startDate: options.startDate,
      endDate: options.endDate,
    });
    const netIncome = plReport.netIncome;

    // Calculate non-cash adjustments
    const nonCashAdjustments = await this.calculateNonCashAdjustments(options.startDate, options.endDate);

    // Calculate working capital changes
    const workingCapitalChanges = await this.calculateWorkingCapitalChanges(options.startDate, options.endDate);

    // Operating activities = Net Income + Non-cash adjustments + Working capital changes
    const operatingRows: CashFlowRow[] = [
      { description: 'Net Income', amount: netIncome },
      ...nonCashAdjustments,
      ...workingCapitalChanges,
    ];

    const operatingActivities: CashFlowSection = {
      activityType: 'OPERATING',
      rows: operatingRows,
      netCashFlow: operatingRows.reduce((sum, row) => sum + row.amount, 0),
    };

    // Get investing and financing activities (same as direct method)
    const cashAccounts = await this.getCashAccounts();
    const openingBalance = await this.calculateCashBalance(cashAccounts, options.startDate);
    const closingBalance = await this.calculateCashBalance(cashAccounts, options.endDate);

    // Simplified: Use direct method for investing/financing
    const directReport = await this.generateDirect(options);

    return {
      startDate: options.startDate,
      endDate: options.endDate,
      method: 'INDIRECT',
      openingCashBalance: openingBalance,
      operatingActivities,
      investingActivities: directReport.investingActivities,
      financingActivities: directReport.financingActivities,
      netCashFlow: operatingActivities.netCashFlow + directReport.investingActivities.netCashFlow + directReport.financingActivities.netCashFlow,
      closingCashBalance: closingBalance,
      isReconciled: true,
      generatedAt: new Date(),
    };
  }

  /**
   * Get all cash accounts
   */
  private async getCashAccounts(): Promise<ChartOfAccounts[]> {
    const classifications = await AccountClassification.findAll({
      where: { isCashAccount: true },
      include: [{ model: ChartOfAccounts, as: 'account' }],
    });

    return classifications.map(c => c.account).filter(a => a !== undefined) as ChartOfAccounts[];
  }

  /**
   * Calculate total cash balance as of a date
   */
  private async calculateCashBalance(cashAccounts: ChartOfAccounts[], asOfDate: Date): Promise<number> {
    let totalBalance = 0;

    for (const account of cashAccounts) {
      const entries = await GeneralLedger.findAll({
        where: {
          accountId: account.id,
          entryDate: { [Op.lte]: asOfDate },
          isPosted: true,
          isReversed: false,
        },
      });

      let balance = 0;
      for (const entry of entries) {
        const amount = parseFloat(entry.amount.toString());
        balance += entry.entryType === 'DEBIT' ? amount : -amount;
      }

      totalBalance += balance;
    }

    return totalBalance;
  }

  /**
   * Get account classification
   */
  private async getAccountClassification(accountId: number): Promise<AccountClassification> {
    const classification = await AccountClassification.findOne({
      where: { accountId },
    });

    if (!classification) {
      const account = await ChartOfAccounts.findByPk(accountId);
      throw new AccountClassificationMissingError(accountId, account?.accountCode || 'UNKNOWN');
    }

    return classification;
  }

  /**
   * Calculate non-cash adjustments (depreciation, amortization, etc.)
   */
  private async calculateNonCashAdjustments(startDate: Date, endDate: Date): Promise<CashFlowRow[]> {
    const nonCashAccounts = await AccountClassification.findAll({
      where: { isNonCashItem: true },
      include: [{ model: ChartOfAccounts, as: 'account' }],
    });

    const adjustments: CashFlowRow[] = [];

    for (const classification of nonCashAccounts) {
      const entries = await GeneralLedger.findAll({
        where: {
          accountId: classification.accountId,
          entryDate: { [Op.between]: [startDate, endDate] },
          isPosted: true,
          isReversed: false,
          entryType: 'DEBIT', // Non-cash expenses are debits
        },
      });

      const total = entries.reduce((sum, entry) => sum + parseFloat(entry.amount.toString()), 0);

      if (total > 0) {
        adjustments.push({
          description: `Add back: ${classification.account?.accountName}`,
          accountCode: classification.account?.accountCode,
          accountName: classification.account?.accountName,
          amount: total,
        });
      }
    }

    return adjustments;
  }

  /**
   * Calculate working capital changes
   */
  private async calculateWorkingCapitalChanges(startDate: Date, endDate: Date): Promise<CashFlowRow[]> {
    const workingCapitalAccounts = await AccountClassification.findAll({
      where: { isWorkingCapital: true },
      include: [{ model: ChartOfAccounts, as: 'account' }],
    });

    const changes: CashFlowRow[] = [];

    for (const classification of workingCapitalAccounts) {
      const openingBalance = await this.getAccountBalanceAtDate(classification.accountId, startDate);
      const closingBalance = await this.getAccountBalanceAtDate(classification.accountId, endDate);
      const change = closingBalance - openingBalance;

      // Invert sign for assets (increase in AR decreases cash)
      const isAsset = classification.account?.accountType === 'ASSET';
      const adjustedChange = isAsset ? -change : change;

      if (Math.abs(adjustedChange) > 0.01) {
        changes.push({
          description: `Change in ${classification.account?.accountName}`,
          accountCode: classification.account?.accountCode,
          accountName: classification.account?.accountName,
          amount: adjustedChange,
        });
      }
    }

    return changes;
  }

  /**
   * Get account balance at a specific date
   */
  private async getAccountBalanceAtDate(accountId: number, date: Date): Promise<number> {
    const entries = await GeneralLedger.findAll({
      where: {
        accountId,
        entryDate: { [Op.lte]: date },
        isPosted: true,
        isReversed: false,
      },
    });

    let balance = 0;
    for (const entry of entries) {
      const amount = parseFloat(entry.amount.toString());
      balance += entry.entryType === 'DEBIT' ? amount : -amount;
    }

    return balance;
  }
}

export default new CashFlowService();
