import { Request, Response, NextFunction } from 'express';
import GLReportService from '../../services/reporting/GLReportService';
import { GLReportOptions } from '../../types/reporting';
import { AsyncReportPendingError } from '../../core/AppError';

/**
 * GL Report Controller
 * 
 * Handles HTTP requests for General Ledger report generation.
 * Requirements: 4.1-4.10
 */

/**
 * Generate GL Report
 * GET /api/reports/gl-report
 */
export async function generateGLReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Parse query parameters
    const options: GLReportOptions = {
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      accountCodes: req.query.accountCodes ? (req.query.accountCodes as string).split(',') : undefined,
      accountTypes: req.query.accountTypes ? (req.query.accountTypes as string).split(',') : undefined,
      sourceModules: req.query.sourceModules ? (req.query.sourceModules as string).split(',') : undefined,
      includeReversed: req.query.includeReversed === 'true',
      sortBy: (req.query.sortBy as any) || 'entry_date',
      sortOrder: (req.query.sortOrder as 'ASC' | 'DESC') || 'ASC',
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 1000,
      cursor: req.query.cursor as string,
    };

    // Generate report
    const report = await GLReportService.generate(options);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    // Handle async report pending
    if (error instanceof AsyncReportPendingError) {
      res.status(202).json({
        success: false,
        message: error.message,
        jobId: error.details?.jobId,
      });
      return;
    }
    next(error);
  }
}
