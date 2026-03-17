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