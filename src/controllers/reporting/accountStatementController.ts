import { Request, Response, NextFunction } from 'express';
import AccountStatementService from '../../services/reporting/AccountStatementService';
import { AccountStatementOptions } from '../../types/reporting';
import { ReportValidationError } from '../../core/AppError';

/**
 * Account Statement Controller
 * 
 * Handles HTTP requests for Account Statement generation.
 * Requirements: 5.1-5.3
 */

/**
 * Generate Account Statement
 * GET /api/reports/account-statement
 */
export async function generateAccountStatement(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Parse query parameters
    const accountCode = req.query.accountCode as string;
    if (!accountCode) {
      throw new ReportValidationError(
        'Account code is required',
        { providedAccountCode: accountCode }
      );
    }

    const startDate = new Date(req.query.startDate as string);
    const endDate = new Date(req.query.endDate as string);

    // Validate date range
    if (startDate > endDate) {
      throw new ReportValidationError(
        'Start date must be before or equal to end date',
        { startDate, endDate }
      );
    }

    const options: AccountStatementOptions = {
      accountCode,
      startDate,
      endDate,
      includeReversed: req.query.includeReversed === 'true',
      sourceModules: req.query.sourceModules ? (req.query.sourceModules as string).split(',') : undefined,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 1000,
      cursor: req.query.cursor as string,
    };

    // Generate report
    const report = await AccountStatementService.generate(options);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}
