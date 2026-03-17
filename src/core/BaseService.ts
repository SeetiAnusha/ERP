import { Transaction } from 'sequelize';
import sequelize from '../config/database';
import { Op } from 'sequelize';
import { 
  ValidationError, 
  InsufficientBalanceError, 
  BusinessLogicError, 
  NotFoundError 
} from './AppError';

/**
 * Base Service Class - Foundation for all services
 * Provides common functionality, error handling, and transaction management
 * 
 * Time Complexity: O(1) for all base operations
 * Space Complexity: O(1) for configuration constants
 */
export abstract class BaseService {
  
  // ==================== CONFIGURATION CONSTANTS ====================
  protected static readonly MAX_RETRY_ATTEMPTS = 3;
  protected static readonly TRANSACTION_TIMEOUT = 30000;
  protected static readonly DUPLICATE_WINDOW_MINUTES = 5;
  protected static readonly FLOATING_POINT_PRECISION = 0.01;
  protected static readonly MAX_BATCH_SIZE = 100;
  
  // ==================== TRANSACTION MANAGEMENT ====================
  
  /**
   * Execute operation with automatic transaction management
   * Handles rollback on failure and prevents double-rollback errors
   */
  protected async executeWithTransaction<T>(
    operation: (transaction: Transaction) => Promise<T>,
    externalTransaction?: Transaction
  ): Promise<T> {
    const transaction = externalTransaction || await sequelize.transaction();
    const shouldCommit = !externalTransaction;
    let transactionState: 'active' | 'committed' | 'rolled_back' = 'active';
    
    try {
      const result = await operation(transaction);
      
      if (shouldCommit && transactionState === 'active') {
        await transaction.commit();
        transactionState = 'committed';
      }
      
      return result;
    } catch (error: any) {
      // Only attempt rollback if transaction is still active and we own it
      if (transactionState === 'active' && shouldCommit) {
        try {
          await transaction.rollback();
          transactionState = 'rolled_back';
        } catch (rollbackError: any) {
          console.error('❌ Transaction rollback failed:', rollbackError.message);
          // Don't throw rollback error, focus on original error
        }
      }
      
      // Handle PostgreSQL transaction abort errors specifically
      if (error.message && error.message.includes('current transaction is aborted')) {
        throw new BusinessLogicError('Database operation failed due to transaction conflict. Please try again.');
      }
      
      throw this.handleError(error, 'Transaction execution failed');
    }
  }
  
  /**
   * Execute operation with retry logic for transient failures
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = BaseService.MAX_RETRY_ATTEMPTS
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Don't retry validation or business logic errors
        if (error instanceof ValidationError || 
            error instanceof BusinessLogicError ||
            error instanceof NotFoundError) {
          throw error;
        }
        
        // Don't retry on last attempt
        if (attempt === maxAttempts) {
          break;
        }
        
        // Exponential backoff: 100ms, 200ms, 400ms
        const delay = Math.pow(2, attempt - 1) * 100;
        await this.sleep(delay);
        
        console.log(`⚠️ Retry attempt ${attempt}/${maxAttempts} after ${delay}ms delay`);
      }
    }
    
    throw this.handleError(lastError!, `Operation failed after ${maxAttempts} attempts`);
  }
  
  // ==================== ERROR HANDLING ====================
  
  /**
   * Centralized error handling with context and sanitization
   */
  protected handleError(error: Error, context: string): never {
    // Log error for debugging
    console.error(`❌ ${context}:`, error.message);
    console.error('Stack trace:', error.stack);
    
    // Convert to appropriate AppError type
    if (error instanceof ValidationError || 
        error instanceof InsufficientBalanceError || 
        error instanceof BusinessLogicError || 
        error instanceof NotFoundError) {
      throw error;
    }
    
    // Handle database constraint errors
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new ValidationError('Duplicate entry detected. Please check your data.');
    }
    
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      throw new ValidationError('Invalid reference data. Please check your selections.');
    }
    
    if (error.name === 'SequelizeDatabaseError') {
      throw new BusinessLogicError(`Database operation failed: ${this.sanitizeErrorMessage(error.message)}`);
    }
    
    // Generic error fallback
    throw new BusinessLogicError(`${context}: ${this.sanitizeErrorMessage(error.message)}`);
  }
  
  /**
   * Sanitize error messages to remove sensitive information
   */
  protected sanitizeErrorMessage(message: string): string {
    return message
      .replace(/column ".*?" does not exist/gi, 'database schema mismatch detected')
      .replace(/relation ".*?" does not exist/gi, 'table not found')
      .replace(/syntax error.*$/gi, 'query syntax issue')
      .replace(/password.*$/gi, 'authentication issue')
      .replace(/connection.*refused/gi, 'database connection issue');
  }
  
  // ==================== VALIDATION HELPERS ====================
  
  /**
   * Validate required fields with descriptive error messages
   */
  protected validateRequired(data: any, fields: string[], context: string = ''): void {
    const missing = fields.filter(field => !data[field]);
    
    if (missing.length > 0) {
      const contextMsg = context ? ` for ${context}` : '';
      throw new ValidationError(`Required fields missing${contextMsg}: ${missing.join(', ')}`);
    }
  }
  
  /**
   * Validate numeric values with range checking
   */
  protected validateNumeric(
    value: any, 
    fieldName: string, 
    options: { min?: number; max?: number; required?: boolean } = {}
  ): void {
    const { min, max, required = true } = options;
    
    if (required && (value === null || value === undefined)) {
      throw new ValidationError(`${fieldName} is required`);
    }
    
    if (value !== null && value !== undefined) {
      const numValue = Number(value);
      
      if (isNaN(numValue)) {
        throw new ValidationError(`${fieldName} must be a valid number`);
      }
      
      if (min !== undefined && numValue < min) {
        throw new ValidationError(`${fieldName} must be at least ${min}`);
      }
      
      if (max !== undefined && numValue > max) {
        throw new ValidationError(`${fieldName} must not exceed ${max}`);
      }
    }
  }
  
  /**
   * Validate enum values
   */
  protected validateEnum(value: any, fieldName: string, allowedValues: string[]): void {
    if (!allowedValues.includes(value)) {
      throw new ValidationError(
        `${fieldName} must be one of: ${allowedValues.join(', ')}. Received: ${value}`
      );
    }
  }
  
  /**
   * Validate sufficient balance for financial operations
   */
  protected validateSufficientBalance(
    available: number, 
    required: number, 
    context: string, 
    accountInfo?: string
  ): void {
    if (available < required) {
      const shortfall = required - available;
      const accountMsg = accountInfo ? ` in ${accountInfo}` : '';
      
      throw new InsufficientBalanceError(
        `Insufficient balance${accountMsg} for ${context}. ` +
        `Available: ${available.toFixed(2)}, Required: ${required.toFixed(2)}. ` +
        `You need ${shortfall.toFixed(2)} more.`
      );
    }
  }
  
  // ==================== UTILITY METHODS ====================
  
  /**
   * Generate unique registration number with prefix
   */
  protected async generateRegistrationNumber(
    prefix: string, 
    model: any, 
    transaction?: Transaction
  ): Promise<string> {
    const lastRecord = await model.findOne({
      where: {
        registrationNumber: {
          [Op.like]: `${prefix}%`
        }
      },
      order: [['id', 'DESC']],
      transaction
    });
    
    let nextNumber = 1;
    if (lastRecord) {
      const lastNumber = parseInt(lastRecord.registrationNumber.substring(prefix.length));
      nextNumber = lastNumber + 1;
    }
    
    return `${prefix}${String(nextNumber).padStart(4, '0')}`;
  }
  
  /**
   * Calculate weighted average for inventory management
   */
  protected calculateWeightedAverage(
    oldQuantity: number, 
    oldUnitCost: number, 
    newQuantity: number, 
    newUnitCost: number
  ): number {
    const oldValue = oldQuantity * oldUnitCost;
    const newValue = newQuantity * newUnitCost;
    const totalQuantity = oldQuantity + newQuantity;
    
    return totalQuantity > 0 ? (oldValue + newValue) / totalQuantity : newUnitCost;
  }
  
  /**
   * Process items in parallel batches for performance
   */
  protected async processBatch<T, R>(
    items: T[], 
    processor: (item: T) => Promise<R>,
    batchSize: number = BaseService.MAX_BATCH_SIZE
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchPromises = batch.map(processor);
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }
  
  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Check for floating point equality with precision
   */
  protected isEqual(a: number, b: number): boolean {
    return Math.abs(a - b) < BaseService.FLOATING_POINT_PRECISION;
  }
  
  /**
   * Round to avoid floating point precision issues
   */
  protected roundCurrency(amount: number): number {
    return Math.round(amount * 100) / 100;
  }
}