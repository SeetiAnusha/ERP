import ChartOfAccounts from '../../models/accounting/ChartOfAccounts';
import GLReportService from './GLReportService';
import { AccountStatementOptions, AccountStatementReport } from '../../types/reporting';
import { NotFoundError, ReportValidationError } from '../../core/AppError';

/**
 * Account Statement Service
 * 
 * Generates detailed account statements with transaction history and balance reconciliation.
 * 
 * Requirements: 5.1, 5.2, 5.3
 */
class AccountStatementService {
  /**
   * Generate Account Statement
   */
  async generate(options: AccountStatementOptions): Promise<AccountStatementReport> {
    // Get account by code
    const account = await ChartOfAccounts.findOne({
      where: { accountCode: options.accountCode },
    });

    if (!account) {
      throw new NotFoundError(`Account with code ${options.accountCode} not found`);
    }

    // Use GLReportService to get transactions
    const glReport = await GLReportService.generate({
      startDate: options.startDate,
      endDate: options.endDate,
      accountCodes: [options.accountCode],
      includeReversed: options.includeReversed,
      sourceModules: options.sourceModules,
      pageSize: options.pageSize,
      cursor: options.cursor,
    });

    // Calculate period totals
    const periodDebits = glReport.entries.reduce((sum, e) => sum + e.debit, 0);
    const periodCredits = glReport.entries.reduce((sum, e) => sum + e.credit, 0);

    // Validate balance reconciliation
    const normalBalance = this.getAccountNormalBalance(account.accountType);
    let calculatedClosing: number;

    if (normalBalance === 'DEBIT') {
      calculatedClosing = glReport.openingBalance + periodDebits - periodCredits;
    } else {
      calculatedClosing = glReport.openingBalance + periodCredits - periodDebits;
    }

    const tolerance = 0.01;
    if (Math.abs(calculatedClosing - glReport.closingBalance) > tolerance) {
      throw new ReportValidationError(
        `Account statement balance reconciliation failed for ${options.accountCode}`,
        {
          openingBalance: glReport.openingBalance,
          periodDebits,
          periodCredits,
          calculatedClosing,
          actualClosing: glReport.closingBalance,
          difference: calculatedClosing - glReport.closingBalance,
        }
      );
    }

    return {
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      startDate: options.startDate,
      endDate: options.endDate,
      openingBalance: glReport.openingBalance,
      transactions: glReport.entries,
      periodDebits,
      periodCredits,
      closingBalance: glReport.closingBalance,
      pagination: glReport.pagination,
      generatedAt: new Date(),
    };
  }

  /**
   * Get account normal balance type
   */
  private getAccountNormalBalance(accountType: string): 'DEBIT' | 'CREDIT' {
    return ['ASSET', 'EXPENSE'].includes(accountType) ? 'DEBIT' : 'CREDIT';
  }
}

export default new AccountStatementService();
