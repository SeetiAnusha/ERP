import { Request, Response, NextFunction } from 'express';
import PeriodClosingService from '../../services/reporting/PeriodClosingService';
import { PeriodClosingOptions, PeriodReopeningOptions } from '../../types/reporting';
import { getUserId } from '../../middleware/rbac';
import { ReportValidationError } from '../../core/AppError';

/**
 * Period Closing Controller
 * 
 * Handles HTTP requests for fiscal period closing and reopening.
 * Requirements: 6.1-6.9
 */

/**
 * Close a fiscal period
 * POST /api/periods/:id/close
 */
export async function closePeriod(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const periodId = parseInt(req.params.id);
    const { retainedEarningsAccountId } = req.body;

    if (!retainedEarningsAccountId) {
      throw new ReportValidationError(
        'Retained earnings account ID is required',
        { providedValue: retainedEarningsAccountId }
      );
    }

    const userId = getUserId(req);

    const options: PeriodClosingOptions = {
      periodId,
      retainedEarningsAccountId,
      userId,
    };

    // Close period
    const result = await PeriodClosingService.closePeriod(options);

    res.json({
      success: true,
      message: `Period ${result.periodName} closed successfully`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reopen a closed fiscal period
 * POST /api/periods/:id/reopen
 */
export async function reopenPeriod(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const periodId = parseInt(req.params.id);
    const { reason } = req.body;

    if (!reason) {
      throw new ReportValidationError(
        'Reason for reopening is required',
        { providedReason: reason }
      );
    }

    const userId = getUserId(req);

    const options: PeriodReopeningOptions = {
      periodId,
      reason,
      userId,
    };

    // Reopen period
    const result = await PeriodClosingService.reopenPeriod(options);

    res.json({
      success: true,
      message: `Period ${result.periodName} reopened successfully`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
