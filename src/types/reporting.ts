/**
 * TypeScript Interfaces for Financial Reporting System
 * 
 * Defines all report options, results, and data structures used across
 * the reporting services.
 */

// ============================================================================
// Balance Sheet Types
// ============================================================================

export interface BalanceSheetOptions {
  asOfDate: Date;
  includeZeroBalances?: boolean;
  accountCodeRange?: { start: string; end: string };
  comparativePeriods?: Date[]; // Up to 5 comparison dates
}

export interface BalanceSheetRow {
  accountCode: string;
  accountName: string;
  balance: number;
  comparativeBalances?: number[];
  variance?: number;
  variancePercent?: number;
}

export interface BalanceSheetSection {
  sectionName: string;
  rows: BalanceSheetRow[];
  total: number;
  comparativeTotals?: number[];
}

export interface BalanceSheetReport {
  asOfDate: Date;
  comparativeDates?: Date[];
  assets: BalanceSheetSection[];
  liabilities: BalanceSheetSection[];
  equity: BalanceSheetSection[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  comparativeTotalAssets?: number[];
  comparativeTotalLiabilities?: number[];
  comparativeTotalEquity?: number[];
  isBalanced: boolean;
  generatedAt: Date;
}

// ============================================================================
// Profit & Loss Types
// ============================================================================

export interface ProfitLossOptions {
  startDate: Date;
  endDate: Date;
  includeZeroBalances?: boolean;
  accountCodeRange?: { start: string; end: string };
  comparativePeriods?: Array<{ startDate: Date; endDate: Date }>; // Up to 5 periods
}

export interface ProfitLossRow {
  accountCode: string;
  accountName: string;
  amount: number;
  comparativeAmounts?: number[];
  variance?: number;
  variancePercent?: number;
}

export interface ProfitLossSection {
  sectionName: string;
  rows: ProfitLossRow[];
  total: number;
  comparativeTotals?: number[];
}

export interface ProfitLossReport {
  startDate: Date;
  endDate: Date;
  comparativePeriods?: Array<{ startDate: Date; endDate: Date }>;
  revenue: ProfitLossSection[];
  costOfGoodsSold: ProfitLossSection[];
  operatingExpenses: ProfitLossSection[];
  otherExpenses: ProfitLossSection[];
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  totalOperatingExpenses: number;
  operatingIncome: number;
  totalOtherExpenses: number;
  netIncome: number;
  comparativeNetIncome?: number[];
  generatedAt: Date;
}

// ============================================================================
// Cash Flow Types
// ============================================================================

export interface CashFlowOptions {
  startDate: Date;
  endDate: Date;
  method: 'DIRECT' | 'INDIRECT';
  comparativePeriods?: Array<{ startDate: Date; endDate: Date }>; // Up to 5 periods
}

export interface CashFlowRow {
  description: string;
  accountCode?: string;
  accountName?: string;
  amount: number;
  comparativeAmounts?: number[];
  variance?: number;
  variancePercent?: number;
}

export interface CashFlowSection {
  activityType: 'OPERATING' | 'INVESTING' | 'FINANCING';
  rows: CashFlowRow[];
  netCashFlow: number;
  comparativeNetCashFlow?: number[];
}

export interface CashFlowReport {
  startDate: Date;
  endDate: Date;
  method: 'DIRECT' | 'INDIRECT';
  comparativePeriods?: Array<{ startDate: Date; endDate: Date }>;
  openingCashBalance: number;
  operatingActivities: CashFlowSection;
  investingActivities: CashFlowSection;
  financingActivities: CashFlowSection;
  netCashFlow: number;
  closingCashBalance: number;
  comparativeOpeningBalance?: number[];
  comparativeClosingBalance?: number[];
  isReconciled: boolean;
  generatedAt: Date;
}

// ============================================================================
// GL Report Types
// ============================================================================

export interface GLReportOptions {
  startDate?: Date;
  endDate?: Date;
  accountCodes?: string[];
  accountTypes?: string[];
  sourceModules?: string[];
  includeReversed?: boolean;
  sortBy?: 'entry_date' | 'entry_number' | 'account_code';
  sortOrder?: 'ASC' | 'DESC';
  pageSize?: number;
  cursor?: string;
}

export interface GLReportEntry {
  entryNumber: string;
  entryDate: Date;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
  sourceModule: string;
  sourceTransactionNumber: string;
  runningBalance: number;
}

export interface GLReportResult {
  entries: GLReportEntry[];
  openingBalance: number;
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
  pagination: {
    hasNextPage: boolean;
    nextCursor?: string;
    pageSize: number;
    totalCount?: number;
  };
  generatedAt: Date;
}

// ============================================================================
// Account Statement Types
// ============================================================================

export interface AccountStatementOptions {
  accountCode: string;
  startDate: Date;
  endDate: Date;
  includeReversed?: boolean;
  sourceModules?: string[];
  pageSize?: number;
  cursor?: string;
}

export interface AccountStatementReport {
  accountCode: string;
  accountName: string;
  accountType: string;
  startDate: Date;
  endDate: Date;
  openingBalance: number;
  transactions: GLReportEntry[];
  periodDebits: number;
  periodCredits: number;
  closingBalance: number;
  pagination: {
    hasNextPage: boolean;
    nextCursor?: string;
    pageSize: number;
  };
  generatedAt: Date;
}

// ============================================================================
// Period Closing Types
// ============================================================================

export interface PeriodClosingOptions {
  periodId: number;
  retainedEarningsAccountId: number;
  userId: number;
}

export interface ClosingEntry {
  entryNumber: string;
  entryDate: Date;
  lines: Array<{
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
    description: string;
  }>;
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
}

export interface PeriodClosingResult {
  periodId: number;
  periodName: string;
  closedAt: Date;
  closedBy: number;
  netIncome: number;
  closingEntry: ClosingEntry;
  finalBalances: Array<{
    accountCode: string;
    accountName: string;
    balance: number;
  }>;
}

export interface PeriodReopeningOptions {
  periodId: number;
  reason: string;
  userId: number;
}

export interface PeriodReopeningResult {
  periodId: number;
  periodName: string;
  reopenedAt: Date;
  reopenedBy: number;
  reopenCount: number;
  reversalEntry: ClosingEntry;
}

// ============================================================================
// Report Export Types
// ============================================================================

export interface ReportExportOptions {
  reportType: string;
  reportData: any;
  format: 'CSV' | 'PDF' | 'JSON';
  metadata: {
    title: string;
    dateRange?: { start: Date; end: Date };
    asOfDate?: Date;
    filters?: Record<string, any>;
    companyName?: string;
  };
  userId?: number;
}

export interface ReportExportResult {
  referenceNumber: string;
  filePath: string;
  fileSize: number;
  format: 'CSV' | 'PDF' | 'JSON';
  exportedAt: Date;
}

// ============================================================================
// Audit Log Types
// ============================================================================

export interface AuditLogEntry {
  userId?: number;
  actionType: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  success?: boolean;
}

export interface AuditLogFilters {
  startDate?: Date;
  endDate?: Date;
  userId?: number;
  actionType?: string;
  resourceType?: string;
  success?: boolean;
  limit?: number;
  offset?: number;
}

export interface AuditLogQueryResult {
  entries: Array<{
    id: number;
    timestamp: Date;
    userId?: number;
    actionType: string;
    resourceType: string;
    resourceId?: string;
    details?: Record<string, any>;
    ipAddress?: string;
    success: boolean;
  }>;
  totalCount: number;
  hasMore: boolean;
}
