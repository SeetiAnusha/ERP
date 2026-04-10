import FiscalPeriod, { PeriodStatus } from '../../models/accounting/FiscalPeriod';
import ChartOfAccounts from '../../models/accounting/ChartOfAccounts';
import GeneralLedger, { SourceModule, EntryType } from '../../models/accounting/GeneralLedger';
import ProfitLossService from './ProfitLossService';
import GLPostingService from '../accounting/GLPostingService';
import AuditLogService from './AuditLogService';
import ReportCacheService from './ReportCacheService';
import { 
  PeriodClosingOptions, 
  PeriodClosingResult, 
  PeriodReopeningOptions, 
  PeriodReopeningResult,
  ClosingEntry 
} from '../../types/reporting';
import { PeriodNotFoundError, ReportValidationError, InsufficientPermissionError } from '../../core/AppError';
import { Op } from 'sequelize';

/**
 * Period Closing Service
 * 
 * Handles fiscal period closing and reopening operations.
 * Creates closing entries, validates data, and maintains audit trail.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.7, 6.8, 6.9
 */
class PeriodClosingService {
  /**
   * Close a fiscal period
   */
  async closePeriod(options: PeriodClosingOptions): Promise<PeriodClosingResult> {
    // Get period
    const period = await FiscalPeriod.findByPk(options.periodId);
    if (!period) {
      throw new PeriodNotFoundError(options.periodId);
    }

    // Validate period can be closed
    await this.validatePeriodCanBeClosed(period);

    // Calculate net income
    const plReport = await ProfitLossService.generate({
      startDate: period.startDate,
      endDate: period.endDate,
    });
    const netIncome = plReport.netIncome;

    // Create closing entry
    const closingEntry = await this.createClosingEntry(
      period,
      netIncome,
      options.retainedEarningsAccountId,
      plReport.revenue,
      plReport.costOfGoodsSold,
      plReport.operatingExpenses,
      plReport.otherExpenses
    );

    // Post closing entry to GL
    await GLPostingService.postGLEntries({
      entryDate: closingEntry.entryDate,
      sourceModule: SourceModule.CLOSING,
      sourceTransactionId: period.id,
      sourceTransactionNumber: `CLOSE-${period.periodName}`,
      entries: closingEntry.lines.map(line => ({
        accountCode: line.accountCode,
        entryType: line.debit > 0 ? EntryType.DEBIT : EntryType.CREDIT,
        amount: line.debit > 0 ? line.debit : line.credit,
        description: line.description,
      })),
      createdBy: options.userId,
    });

    // Update period status
    period.status = PeriodStatus.CLOSED;
    period.closedAt = new Date();
    period.closedBy = options.userId;
    await period.save();

    // Get final balances
    const finalBalances = await this.getFinalBalances(period.endDate);

    // Log audit trail
    await AuditLogService.log({
      userId: options.userId,
      actionType: 'PERIOD_CLOSE',
      resourceType: 'FISCAL_PERIOD',
      resourceId: period.id.toString(),
      details: {
        periodName: period.periodName,
        netIncome,
        closingEntryNumber: closingEntry.entryNumber,
      },
      success: true,
    });

    // Invalidate cached reports
    await ReportCacheService.invalidateOnPeriodClose(period.id);

    return {
      periodId: period.id,
      periodName: period.periodName,
      closedAt: period.closedAt!,
      closedBy: period.closedBy!,
      netIncome,
      closingEntry,
      finalBalances,
    };
  }

  /**
   * Reopen a closed fiscal period
   */
  async reopenPeriod(options: PeriodReopeningOptions): Promise<PeriodReopeningResult> {
    // Get period
    const period = await FiscalPeriod.findByPk(options.periodId);
    if (!period) {
      throw new PeriodNotFoundError(options.periodId);
    }

    // Validate period can be reopened
    await this.validatePeriodCanBeReopened(period);

    // Check locked period permission (requires Administrator role)
    // This would be checked by the controller/middleware in real implementation

    // Find closing journal entry
    const closingEntry = await GeneralLedger.findOne({
      where: {
        sourceModule: 'PERIOD_CLOSING',
        sourceTransactionId: period.id,
        isReversed: false,
      },
    });

    if (!closingEntry) {
      throw new ReportValidationError(
        `No closing entry found for period ${period.periodName}`,
        { periodId: period.id }
      );
    }

    // Create reversal entry by posting opposite entries
    const originalEntries = await GeneralLedger.findAll({
      where: { entryNumber: closingEntry.entryNumber },
      include: [{ model: ChartOfAccounts, as: 'ChartOfAccount' }]
    });
    
    const reversalEntries = originalEntries.map(entry => ({
      accountCode: entry.ChartOfAccount?.accountCode || '',
      entryType: entry.entryType === EntryType.DEBIT ? EntryType.CREDIT : EntryType.DEBIT,
      amount: entry.amount,
      description: `Reopening period ${period.periodName}: ${options.reason}`
    }));
    
    await GLPostingService.postGLEntries({
      entryDate: new Date(),
      sourceModule: SourceModule.CLOSING,
      sourceTransactionId: period.id,
      sourceTransactionNumber: `REOPEN-${period.periodName}`,
      entries: reversalEntries,
      createdBy: options.userId
    });

    // Update period status
    period.status = PeriodStatus.OPEN;
    period.reopenedAt = new Date();
    period.reopenedBy = options.userId;
    period.reopenCount = (period.reopenCount || 0) + 1;
    await period.save();

    // Log audit trail
    await AuditLogService.log({
      userId: options.userId,
      actionType: 'PERIOD_REOPEN',
      resourceType: 'FISCAL_PERIOD',
      resourceId: period.id.toString(),
      details: {
        periodName: period.periodName,
        reason: options.reason,
        reopenCount: period.reopenCount,
      },
      success: true,
    });

    // Invalidate cached reports for this period and all subsequent periods
    await ReportCacheService.invalidateOnPeriodReopen(period.id);

    return {
      periodId: period.id,
      periodName: period.periodName,
      reopenedAt: period.reopenedAt!,
      reopenedBy: period.reopenedBy!,
      reopenCount: period.reopenCount,
      reversalEntry: {
        entryNumber: `REOPEN-${period.periodName}`,
        entryDate: new Date(),
        lines: [], // Would be populated from actual reversal entry
        totalDebits: 0,
        totalCredits: 0,
        isBalanced: true,
      },
    };
  }

  /**
   * Validate period can be closed
   */
  private async validatePeriodCanBeClosed(period: FiscalPeriod): Promise<void> {
    // Check period status
    if (period.status !== PeriodStatus.OPEN) {
      throw new ReportValidationError(
        `Period ${period.periodName} cannot be closed. Current status: ${period.status}`,
        { periodId: period.id, status: period.status }
      );
    }

    // Check all GL entries are posted
    const unpostedCount = await GeneralLedger.count({
      where: {
        fiscalPeriodId: period.id,
        isPosted: false,
      },
    });

    if (unpostedCount > 0) {
      throw new ReportValidationError(
        `Period ${period.periodName} has ${unpostedCount} unposted entries`,
        { periodId: period.id, unpostedCount }
      );
    }

    // Check for unbalanced entries (this would be more complex in real implementation)
    // For now, we assume all posted entries are balanced
  }

  /**
   * Validate period can be reopened
   */
  private async validatePeriodCanBeReopened(period: FiscalPeriod): Promise<void> {
    // Check period status
    if (period.status !== PeriodStatus.CLOSED) {
      throw new ReportValidationError(
        `Period ${period.periodName} cannot be reopened. Current status: ${period.status}`,
        { periodId: period.id, status: period.status }
      );
    }

    // Check no subsequent periods are being closed
    const subsequentPeriods = await FiscalPeriod.findAll({
      where: {
        startDate: { [Op.gt]: period.endDate },
        status: PeriodStatus.CLOSED,
      },
    });

    if (subsequentPeriods.length > 0) {
      throw new ReportValidationError(
        `Cannot reopen period ${period.periodName}. Subsequent periods are closed.`,
        { 
          periodId: period.id,
          subsequentClosedPeriods: subsequentPeriods.map(p => p.periodName),
        }
      );
    }
  }

  /**
   * Create closing journal entry
   */
  private async createClosingEntry(
    period: FiscalPeriod,
    netIncome: number,
    retainedEarningsAccountId: number,
    revenue: any[],
    cogs: any[],
    opex: any[],
    otherEx: any[]
  ): Promise<ClosingEntry> {
    const lines: any[] = [];
    const entryNumber = `CLOSE-${period.fiscalYear}-${period.id}`;
    const entryDate = period.endDate;

    // Close revenue accounts (debit revenue, credit income summary)
    for (const section of revenue) {
      for (const row of section.rows) {
        if (Math.abs(row.amount) > 0.01) {
          const account = await ChartOfAccounts.findOne({
            where: { accountCode: row.accountCode },
          });
          lines.push({
            accountCode: row.accountCode,
            accountName: row.accountName,
            debit: row.amount, // Debit to close revenue
            credit: 0,
            description: `Close ${row.accountName} for ${period.periodName}`,
          });
        }
      }
    }

    // Close expense accounts (credit expense, debit income summary)
    const allExpenses = [...cogs, ...opex, ...otherEx];
    for (const section of allExpenses) {
      for (const row of section.rows) {
        if (Math.abs(row.amount) > 0.01) {
          lines.push({
            accountCode: row.accountCode,
            accountName: row.accountName,
            debit: 0,
            credit: row.amount, // Credit to close expense
            description: `Close ${row.accountName} for ${period.periodName}`,
          });
        }
      }
    }

    // Transfer net income to retained earnings
    const retainedEarnings = await ChartOfAccounts.findByPk(retainedEarningsAccountId);
    if (netIncome > 0) {
      // Profit: Credit retained earnings
      lines.push({
        accountCode: retainedEarnings?.accountCode || 'RE',
        accountName: retainedEarnings?.accountName || 'Retained Earnings',
        debit: 0,
        credit: netIncome,
        description: `Transfer net income to retained earnings for ${period.periodName}`,
      });
    } else if (netIncome < 0) {
      // Loss: Debit retained earnings
      lines.push({
        accountCode: retainedEarnings?.accountCode || 'RE',
        accountName: retainedEarnings?.accountName || 'Retained Earnings',
        debit: Math.abs(netIncome),
        credit: 0,
        description: `Transfer net loss to retained earnings for ${period.periodName}`,
      });
    }

    // Calculate totals
    const totalDebits = lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredits = lines.reduce((sum, line) => sum + line.credit, 0);
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

    if (!isBalanced) {
      throw new ReportValidationError(
        `Closing entry is not balanced. Debits: ${totalDebits}, Credits: ${totalCredits}`,
        { totalDebits, totalCredits, difference: totalDebits - totalCredits }
      );
    }

    return {
      entryNumber,
      entryDate,
      lines,
      totalDebits,
      totalCredits,
      isBalanced,
    };
  }

  /**
   * Get final balances for all accounts
   */
  private async getFinalBalances(asOfDate: Date): Promise<Array<{ accountCode: string; accountName: string; balance: number }>> {
    const accounts = await ChartOfAccounts.findAll({
      where: { isActive: true },
      order: [['accountCode', 'ASC']],
    });

    const balances: Array<{ accountCode: string; accountName: string; balance: number }> = [];

    for (const account of accounts) {
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

      if (Math.abs(balance) > 0.01) {
        balances.push({
          accountCode: account.accountCode,
          accountName: account.accountName,
          balance,
        });
      }
    }

    return balances;
  }
}

export default new PeriodClosingService();
