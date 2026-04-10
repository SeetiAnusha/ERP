import { Request, Response, NextFunction } from 'express';
import AuditLogService from '../../services/reporting/AuditLogService';
import { AuditLogFilters } from '../../types/reporting';

/**
 * Audit Log Controller
 * 
 * Handles HTTP requests for audit log querying.
 * Requirements: 14.9
 */

/**
 * Query audit log
 * GET /api/audit-log
 */
export async function queryAuditLog(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Parse query parameters
    const filters: AuditLogFilters = {
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      userId: req.query.userId ? parseInt(req.query.userId as string) : undefined,
      actionType: req.query.actionType as string,
      resourceType: req.query.resourceType as string,
      success: req.query.success !== undefined ? req.query.success === 'true' : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    // Query audit log
    const result = await AuditLogService.query(filters);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
