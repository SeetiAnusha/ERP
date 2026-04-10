import { Request, Response, NextFunction } from 'express';
import BalanceSheetService from '../../services/reporting/BalanceSheetService';
import { BalanceSheetOptions } from '../../types/reporting';
import { ReportValidationError } from '../../core/AppError';

/**
 * Balance Sheet Controller
 * 
 * Handles HTTP requests for Balance Sheet report generation.
 * Requirements: 1.1-1.8
 */

/**
 * Generate Balance Sheet report
 * GET /api/reports/balance-sheet
 */
export async function generateBalanceSheet(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Parse query parameters
    const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate as string) : new Date();
    const includeZeroBalances = req.query.includeZeroBalances === 'true';
    
    // Parse account code range
    let accountCodeRange: { start: string; end: string } | undefined;
    if (req.query.accountCodeStart && req.query.accountCodeEnd) {
      accountCodeRange = {
        start: req.query.accountCodeStart as string,
        end: req.query.accountCodeEnd as string,
      };
    }

    // Parse comparative periods
    let comparativePeriods: Date[] | undefined;
    if (req.query.comparativePeriods) {
      const periodsStr = req.query.comparativePeriods as string;
      comparativePeriods = periodsStr.split(',').map(d => new Date(d));
      
      if (comparativePeriods.length > 5) {
        throw new ReportValidationError(
          'Maximum 5 comparative periods allowed',
          { providedCount: comparativePeriods.length }
        );
      }
    }

    const options: BalanceSheetOptions = {
      asOfDate,
      includeZeroBalances,
      accountCodeRange,
      comparativePeriods,
    };

    // Generate report
    const report = await BalanceSheetService.generate(options);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}
