import { Request, Response, NextFunction } from 'express';
import CashFlowService from '../../services/reporting/CashFlowService';
import { CashFlowOptions } from '../../types/reporting';
import { ReportValidationError } from '../../core/AppError';

/**
 * Cash Flow Controller
 * 
 * Handles HTTP requests for Cash Flow Statement generation.
 * Requirements: 3.1-3.8
 */

/**
 * Generate Cash Flow Statement
 * GET /api/reports/cash-flow
 */
export async function generateCashFlow(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Parse query parameters
    const startDate = new Date(req.query.startDate as string);
    const endDate = new Date(req.query.endDate as string);
    const method = (req.query.method as 'DIRECT' | 'INDIRECT') || 'DIRECT';

    // Validate date range
    if (startDate > endDate) {
      throw new ReportValidationError(
        'Start date must be before or equal to end date',
        { startDate, endDate }
      );
    }

    // Validate method
    if (!['DIRECT', 'INDIRECT'].includes(method)) {
      throw new ReportValidationError(
        'Method must be either DIRECT or INDIRECT',
        { providedMethod: method }
      );
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

    const options: CashFlowOptions = {
      startDate,
      endDate,
      method,
      comparativePeriods,
    };

    // Generate report
    const report = await CashFlowService.generate(options);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}
