import { Router } from 'express';
import { requirePermission, requireRole, UserRole, Permission } from '../middleware/rbac';
import * as balanceSheetController from '../controllers/reporting/balanceSheetController';
import * as profitLossController from '../controllers/reporting/profitLossController';
import * as cashFlowController from '../controllers/reporting/cashFlowController';
import * as glReportController from '../controllers/reporting/glReportController';
import * as accountStatementController from '../controllers/reporting/accountStatementController';
import * as periodClosingController from '../controllers/reporting/periodClosingController';
import * as reportExportController from '../controllers/reporting/reportExportController';
import * as auditLogController from '../controllers/reporting/auditLogController';

/**
 * Financial Reporting Routes
 * 
 * Defines all API endpoints for financial reporting with RBAC.
 */

const router = Router();

// ============================================================================
// Report Generation Endpoints (All authenticated users can view)
// ============================================================================

/**
 * GET /api/reports/balance-sheet
 * Generate Balance Sheet report
 * Access: VIEWER, ACCOUNTANT, ADMINISTRATOR
 */
router.get(
  '/balance-sheet',
  requirePermission(Permission.VIEW_REPORTS),
  balanceSheetController.generateBalanceSheet
);

/**
 * GET /api/reports/profit-loss
 * Generate Profit & Loss report
 * Access: VIEWER, ACCOUNTANT, ADMINISTRATOR
 */
router.get(
  '/profit-loss',
  requirePermission(Permission.VIEW_REPORTS),
  profitLossController.generateProfitLoss
);

/**
 * GET /api/reports/cash-flow
 * Generate Cash Flow Statement
 * Access: VIEWER, ACCOUNTANT, ADMINISTRATOR
 */
router.get(
  '/cash-flow',
  requirePermission(Permission.VIEW_REPORTS),
  cashFlowController.generateCashFlow
);

/**
 * GET /api/reports/gl-report
 * Generate General Ledger report
 * Access: VIEWER, ACCOUNTANT, ADMINISTRATOR
 */
router.get(
  '/gl-report',
  requirePermission(Permission.VIEW_REPORTS),
  glReportController.generateGLReport
);

/**
 * GET /api/reports/account-statement
 * Generate Account Statement
 * Access: VIEWER, ACCOUNTANT, ADMINISTRATOR
 */
router.get(
  '/account-statement',
  requirePermission(Permission.VIEW_REPORTS),
  accountStatementController.generateAccountStatement
);

// ============================================================================
// Report Export Endpoints (ACCOUNTANT and ADMINISTRATOR only)
// ============================================================================

/**
 * POST /api/reports/export
 * Export report to CSV, PDF, or JSON
 * Access: ACCOUNTANT, ADMINISTRATOR
 */
router.post(
  '/export',
  requirePermission(Permission.EXPORT_REPORTS),
  reportExportController.exportReport
);

// ============================================================================
// Period Closing Endpoints (ACCOUNTANT and ADMINISTRATOR only)
// ============================================================================

/**
 * POST /api/periods/:id/close
 * Close a fiscal period
 * Access: ACCOUNTANT, ADMINISTRATOR
 */
router.post(
  '/periods/:id/close',
  requirePermission(Permission.CLOSE_PERIODS),
  periodClosingController.closePeriod
);

/**
 * POST /api/periods/:id/reopen
 * Reopen a closed fiscal period
 * Access: ACCOUNTANT (non-locked), ADMINISTRATOR (all)
 */
router.post(
  '/periods/:id/reopen',
  requirePermission(Permission.REOPEN_PERIODS),
  periodClosingController.reopenPeriod
);

// ============================================================================
// Audit Log Endpoints (ADMINISTRATOR only)
// ============================================================================

/**
 * GET /api/audit-log
 * Query audit log entries
 * Access: ADMINISTRATOR
 */
router.get(
  '/audit-log',
  requireRole(UserRole.ADMINISTRATOR),
  auditLogController.queryAuditLog
);

export default router;
