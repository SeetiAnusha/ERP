import { Request, Response, NextFunction } from 'express';
import ProfitLossService from '../../services/reporting/ProfitLossService';
import { ProfitLossOptions } from '../../types/reporting';
import { ReportValidationError } from '../../core/AppError';

/**
 * Profit & Loss Controller
 * 
 * Handles HTTP requests for Profit & Loss report generation.
 * Requirements: 2.1-2.8
 */

/**
 * Generate Profit & Loss report
 * GET /api/reports/profit-loss
 */
export async function generateProfitLoss(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Parse query parameters
    const startDate = new Date(req.query.startDate as string);
    const endDate = new Date(req.query.endDate as string);

    // Validate date range
    if (startDate > endDate) {
      throw new ReportValidationError(
        'Start date must be before or equal to end date',
        { startDate, endDate }
      );
    }

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
    let comparativePeriods: Array<{ startDate: Date; endDate: Date }> | undefined;
    if (req.query.comparativePeriods) {
      const periodsStr = req.query.comparativePeriods as string;
      comparativePeriods = JSON.parse(periodsStr).map((p: any) => ({
        startDate: new Date(p.startDate),
        endDate: new Date(p.endDate),
      }));
      
      if (comparativePeriods && comparativePeriods.length > 5) {
        throw new ReportValidationError(
          'Maximum 5 comparative periods allowed',
          { providedCount: comparativePeriods.length }
        );
      }
    }

    const options: ProfitLossOptions = {
      startDate,
      endDate,
      includeZeroBalances,
      accountCodeRange,
      comparativePeriods,
    };

    // Generate report
    const report = await ProfitLossService.generate(options);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}
