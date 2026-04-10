import GeneralLedger from '../../models/accounting/GeneralLedger';
import ChartOfAccounts from '../../models/accounting/ChartOfAccounts';
import { GLReportOptions, GLReportResult, GLReportEntry } from '../../types/reporting';
import { AsyncReportPendingError } from '../../core/AppError';
import { Op } from 'sequelize';

/**
 * GL Report Service
 * 
 * Generates General Ledger reports with filtering, sorting, and pagination.
 * Supports cursor-based pagination for large datasets.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.6, 4.7, 4.9, 10.1
 */
class GLReportService {
  /**
   * Generate GL Report
   */
  async generate(options: GLReportOptions): Promise<GLReportResult> {
    // Build where clause
    const where: any = {
      isPosted: true,
    };

    // Date range filter
    if (options.startDate || options.endDate) {
      where.entryDate = {};
      if (options.startDate) {
        where.entryDate[Op.gte] = options.startDate;
      }
      if (options.endDate) {
        where.entryDate[Op.lte] = options.endDate;
      }
    }

    // Account codes filter
    if (options.accountCodes && options.accountCodes.length > 0) {
      const accounts = await ChartOfAccounts.findAll({
        where: { accountCode: { [Op.in]: options.accountCodes } },
      });
      where.accountId = { [Op.in]: accounts.map(a => a.id) };
    }

    // Source modules filter
    if (options.sourceModules && options.sourceModules.length > 0) {
      where.sourceModule = { [Op.in]: options.sourceModules };
    }

    // Include reversed entries filter
    if (options.includeReversed === false) {
      where.isReversed = false;
    }

    // Estimate count for pagination strategy
    const estimatedCount = await GeneralLedger.count({ where });

    // Determine pagination strategy
    if (estimatedCount > 50000) {
      // Large dataset: Queue for async processing
      const jobId = `GL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      throw new AsyncReportPendingError(jobId);
    }

    // Cursor-based pagination
    const pageSize = options.pageSize || 1000;
    const cursor = options.cursor;

    if (cursor) {
      where.id = { [Op.gt]: parseInt(cursor) };
    }

    // Sorting
    const sortBy = options.sortBy || 'entry_date';
    const sortOrder = options.sortOrder || 'ASC';
    const orderField = sortBy === 'entry_date' ? 'entryDate' 
                     : sortBy === 'entry_number' ? 'entryNumber'
                     : sortBy === 'account_code' ? 'accountId'
                     : 'entryDate';

    // Fetch entries (pageSize + 1 to check hasNextPage)
    const entries = await GeneralLedger.findAll({
      where,
      include: [{ model: ChartOfAccounts, as: 'account' }],
      order: [[orderField, sortOrder], ['id', 'ASC']],
      limit: pageSize + 1,
    });

    // Check if there are more pages
    const hasNextPage = entries.length > pageSize;
    if (hasNextPage) {
      entries.pop(); // Remove the extra entry
    }

    // Calculate opening balance (if first page)
    let openingBalance = 0;
    if (!cursor && options.accountCodes && options.accountCodes.length === 1) {
      const account = await ChartOfAccounts.findOne({
        where: { accountCode: options.accountCodes[0] },
      });
      if (account && options.startDate) {
        openingBalance = await this.calculateOpeningBalance(account.id, options.startDate);
      }
    }

    // Calculate running balance
    const entriesWithBalance = this.calculateRunningBalance(
      entries,
      openingBalance,
      options.accountCodes && options.accountCodes.length === 1 
        ? await this.getAccountNormalBalance(options.accountCodes[0])
        : 'DEBIT'
    );

    // Calculate totals
    const totalDebits = entries.reduce((sum, e) => 
      sum + (e.entryType === 'DEBIT' ? parseFloat(e.amount.toString()) : 0), 0
    );
    const totalCredits = entries.reduce((sum, e) => 
      sum + (e.entryType === 'CREDIT' ? parseFloat(e.amount.toString()) : 0), 0
    );

    const closingBalance = entriesWithBalance.length > 0 
      ? entriesWithBalance[entriesWithBalance.length - 1].runningBalance 
      : openingBalance;

    return {
      entries: entriesWithBalance,
      openingBalance,
      closingBalance,
      totalDebits,
      totalCredits,
      pagination: {
        hasNextPage,
        nextCursor: hasNextPage ? entries[entries.length - 1].id.toString() : undefined,
        pageSize,
        totalCount: estimatedCount < 10000 ? estimatedCount : undefined,
      },
      generatedAt: new Date(),
    };
  }

  /**
   * Calculate opening balance for an account
   */
  private async calculateOpeningBalance(accountId: number, startDate: Date): Promise<number> {
    const entries = await GeneralLedger.findAll({
      where: {
        accountId,
        entryDate: { [Op.lt]: startDate },
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

  /**
   * Get account normal balance type
   */
  private async getAccountNormalBalance(accountCode: string): Promise<'DEBIT' | 'CREDIT'> {
    const account = await ChartOfAccounts.findOne({
      where: { accountCode },
    });

    if (!account) return 'DEBIT';

    // Assets and Expenses have debit normal balance
    // Liabilities, Equity, and Revenue have credit normal balance
    return ['ASSET', 'EXPENSE'].includes(account.accountType) ? 'DEBIT' : 'CREDIT';
  }

  /**
   * Calculate running balance for entries
   */
  private calculateRunningBalance(
    entries: GeneralLedger[],
    openingBalance: number,
    normalBalance: 'DEBIT' | 'CREDIT'
  ): GLReportEntry[] {
    let runningBalance = openingBalance;
    const result: GLReportEntry[] = [];

    for (const entry of entries) {
      const amount = parseFloat(entry.amount.toString());
      const debit = entry.entryType === 'DEBIT' ? amount : 0;
      const credit = entry.entryType === 'CREDIT' ? amount : 0;

      // Update running balance based on normal balance type
      if (normalBalance === 'DEBIT') {
        runningBalance += debit - credit;
      } else {
        runningBalance += credit - debit;
      }

      result.push({
        entryNumber: entry.entryNumber,
        entryDate: entry.entryDate,
        accountCode: entry.account?.accountCode || '',
        accountName: entry.account?.accountName || '',
        debit,
        credit,
        description: entry.description,
        sourceModule: entry.sourceModule,
        sourceTransactionNumber: entry.sourceTransactionNumber,
        runningBalance,
      });
    }

    return result;
  }
}

export default new GLReportService();
