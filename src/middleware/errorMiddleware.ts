import { Request, Response, NextFunction } from 'express';
import { 
  AppError, 
  ValidationError, 
  NotFoundError, 
  InsufficientBalanceError, 
  BusinessLogicError,
  ReportingError,
  InsufficientPermissionError
} from '../core/AppError';

/**
 * Global Error Handling Middleware
 * 
 * This middleware catches ALL errors thrown by services and converts them
 * to appropriate HTTP responses. This eliminates the need for try-catch
 * blocks in every controller method.
 * 
 * Flow:
 * 1. Service throws custom error (ValidationError, NotFoundError, etc.)
 * 2. Error bubbles up through controller (no try-catch needed)
 * 3. This middleware catches it
 * 4. Converts to proper HTTP response with status code
 * 
 * Benefits:
 * - Controllers are clean and simple
 * - Consistent error responses across all APIs
 * - Single place to modify error format
 * - No code duplication
 */

interface ErrorResponse {
  success: boolean;
  error: string;
  message: string;
  type: string;
  code?: string;
  details?: any;
  stack?: string;
}

export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('❌ Error caught by middleware:', error.message);
  console.error('Error name:', error.name);
  console.error('Error type:', error.constructor.name);
  
  // 🔍 DEBUG: Log Sequelize error details
  if (error.name === 'SequelizeUniqueConstraintError') {
    const err = error as any;
    console.log('🔍 Sequelize Unique Constraint Error Details:');
    console.log('  - errors array:', err.errors);
    console.log('  - errors[0]:', err.errors?.[0]);
    console.log('  - field (path):', err.errors?.[0]?.path);
    console.log('  - value:', err.errors?.[0]?.value);
  }
  
  console.error('Stack trace:', error.stack);

  // Default error response
  let statusCode = 500;
  let errorResponse: ErrorResponse = {
    success: false,
    error: 'Internal Server Error',
    message: error.message || 'An unexpected error occurred',
    type: error.name || 'Error'
  };

  // Handle custom AppError types
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    errorResponse = {
      success: false,
      error: error.name,
      message: error.message,
      type: error.code || error.name,
      code: error.code
    };

    // Add details for ReportingError
    if (error instanceof ReportingError && error.details) {
      errorResponse.details = error.details;
    }
  }
  // Handle specific error types with custom status codes
  else if (error instanceof ValidationError) {
    statusCode = 400;
    errorResponse.error = 'Validation Error';
    errorResponse.type = 'ValidationError';
  }
  else if (error instanceof NotFoundError) {
    statusCode = 404;
    errorResponse.error = 'Not Found';
    errorResponse.type = 'NotFoundError';
  }
  else if (error instanceof InsufficientBalanceError) {
    statusCode = 400;
    errorResponse.error = 'Insufficient Balance';
    errorResponse.type = 'InsufficientBalanceError';
  }
  else if (error instanceof BusinessLogicError) {
    statusCode = 400;
    errorResponse.error = 'Business Logic Error';
    errorResponse.type = 'BusinessLogicError';
  }
  else if (error instanceof InsufficientPermissionError) {
    statusCode = 403;
    errorResponse.error = 'Insufficient Permission';
    errorResponse.type = 'InsufficientPermissionError';
  }
  // Handle Sequelize database errors
  else if (error.name === 'SequelizeValidationError') {
    statusCode = 400;
    errorResponse.error = 'Validation Error';
    errorResponse.message = 'Database validation failed';
    errorResponse.type = 'ValidationError';
    errorResponse.details = (error as any).errors?.map((e: any) => ({
      field: e.path,
      message: e.message
    }));
  }
  else if (error.name === 'SequelizeUniqueConstraintError') {
    statusCode = 400;
    errorResponse.error = 'Duplicate Entry';
    errorResponse.message = 'A record with this value already exists';
    errorResponse.type = 'DuplicateError';
    
    const err = error as any;
    if (err.errors?.[0]) {
      const field = err.errors[0].path || 'field';
      const value = err.errors[0].value || '';
      
      // ✅ Enhanced: Provide exact field and value in message AND details
      errorResponse.message = `${field} '${value}' already exists`;
      errorResponse.details = {
        field: field,
        value: value,
        constraint: err.errors[0].type || 'unique'
      };
    }
  }
  else if (error.name === 'SequelizeForeignKeyConstraintError') {
    statusCode = 400;
    errorResponse.error = 'Invalid Reference';
    errorResponse.message = 'Referenced record does not exist';
    errorResponse.type = 'ForeignKeyError';
  }
  else if (error.name === 'SequelizeConnectionError') {
    statusCode = 503;
    errorResponse.error = 'Database Connection Error';
    errorResponse.message = 'Unable to connect to database. Please try again later.';
    errorResponse.type = 'ConnectionError';
  }
  else if (error.name === 'SequelizeDatabaseError') {
    statusCode = 500;
    errorResponse.error = 'Database Error';
    errorResponse.message = 'A database error occurred';
    errorResponse.type = 'DatabaseError';
    
    // Sanitize database error messages
    if (error.message.includes('column') && error.message.includes('does not exist')) {
      errorResponse.message = 'Database schema mismatch detected';
    } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
      errorResponse.message = 'Required table not found';
    }
  }

  // Include stack trace in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * Async handler wrapper to catch errors in async route handlers
 * 
 * Usage in routes:
 * router.get('/path', asyncHandler(async (req, res) => {
 *   const data = await service.getData();
 *   res.json(data);
 * }));
 * 
 * Without this, you'd need try-catch in every async route handler
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found handler for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`);
  next(error);
};
