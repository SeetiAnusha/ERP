// Custom App Error Class
export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
  }
}

export class InsufficientBalanceError extends AppError {
  constructor(message: string) {
    super(message, 400, 'INSUFFICIENT_BALANCE');
  }
}

export class BusinessLogicError extends AppError {
  constructor(message: string) {
    super(message, 400, 'BUSINESS_LOGIC_ERROR');
  }
}

// ============================================================================
// Financial Reporting Error Classes
// ============================================================================

/**
 * Base class for reporting errors
 */
export class ReportingError extends AppError {
  public details?: Record<string, any>;

  constructor(message: string, statusCode: number, code: string, details?: Record<string, any>) {
    super(message, statusCode, code);
    this.details = details;
  }
}

/**
 * Thrown when report validation fails (e.g., unbalanced reports, invalid data)
 */
export class ReportValidationError extends ReportingError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 400, 'REPORT_VALIDATION_ERROR', details);
  }
}

/**
 * Thrown when a fiscal period is not found
 */
export class PeriodNotFoundError extends ReportingError {
  constructor(periodId: number) {
    super(
      `Fiscal period with ID ${periodId} not found`,
      404,
      'PERIOD_NOT_FOUND',
      { periodId }
    );
  }
}

/**
 * Thrown when user lacks required permissions
 */
export class InsufficientPermissionError extends ReportingError {
  constructor(requiredRole: string, userRole: string, action: string) {
    super(
      `Insufficient permissions: ${action} requires ${requiredRole} role, but user has ${userRole}`,
      403,
      'INSUFFICIENT_PERMISSION',
      { requiredRole, userRole, action }
    );
  }
}

/**
 * Thrown when account classification is missing for cash flow generation
 */
export class AccountClassificationMissingError extends ReportingError {
  constructor(accountId: number, accountCode: string) {
    super(
      `Account classification missing for account ${accountCode} (ID: ${accountId})`,
      400,
      'ACCOUNT_CLASSIFICATION_MISSING',
      { accountId, accountCode }
    );
  }
}

/**
 * Thrown when a report is queued for async generation
 */
export class AsyncReportPendingError extends ReportingError {
  constructor(jobId: string) {
    super(
      `Report generation queued. Job ID: ${jobId}`,
      202,
      'ASYNC_REPORT_PENDING',
      { jobId }
    );
  }
}
