import { Transaction } from 'sequelize';
import sequelize from '../config/database';
import { Op, QueryTypes } from 'sequelize';
import { 
  ValidationError, 
  InsufficientBalanceError, 
  BusinessLogicError, 
  NotFoundError 
} from './AppError';
import { PaginationService } from './PaginationService';

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
        
        // Don't retry database constraint errors (they will always fail)
        if (error.name === 'SequelizeUniqueConstraintError' ||
            error.name === 'SequelizeForeignKeyConstraintError' ||
            error.name === 'SequelizeValidationError') {
          throw this.handleError(error, 'Database constraint violation');
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
   * ✅ FIXED: Now preserves specific error types and lets them pass through
   */
  protected handleError(error: Error, context: string): never {
    // Log error for debugging
    console.error(`❌ ${context}:`, error.message);
    console.error('Error name:', error.name);
    console.error('Error type:', error.constructor.name);
    
    // 🔍 DEBUG: Log Sequelize error details
    if (error.name === 'SequelizeUniqueConstraintError') {
      const err = error as any;
      console.log('🔍 BaseService caught Sequelize Unique Constraint Error:');
      console.log('  - errors array:', err.errors);
      console.log('  - errors[0]:', err.errors?.[0]);
      console.log('  - field (path):', err.errors?.[0]?.path);
      console.log('  - value:', err.errors?.[0]?.value);
      console.log('  - Passing through to middleware...');
    }
    
    console.error('Stack trace:', error.stack);
    
    // ✅ PASS THROUGH custom AppError types WITHOUT wrapping
    if (error instanceof ValidationError || 
        error instanceof InsufficientBalanceError || 
        error instanceof BusinessLogicError || 
        error instanceof NotFoundError) {
      throw error; // ✅ Preserve original error
    }
    
    // ✅ Convert database errors to specific types (let middleware handle them)
    if (error.name === 'SequelizeUniqueConstraintError') {
      // Let the error middleware handle this - it has better logic
      throw error; // ✅ Pass original Sequelize error
    }
    
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      // Let the error middleware handle this
      throw error; // ✅ Pass original Sequelize error
    }
    
    if (error.name === 'SequelizeValidationError') {
      // Let the error middleware handle this
      throw error; // ✅ Pass original Sequelize error
    }
    
    if (error.name === 'SequelizeDatabaseError') {
      // Let the error middleware handle this
      throw error; // ✅ Pass original Sequelize error
    }
    
    // ✅ Only wrap truly unknown errors
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
   * generateRegistrationNumber — Lock-free, atomic sequential number generator.
   *
   * IMPLEMENTATION: PostgreSQL SEQUENCE via nextval()
   * ──────────────────────────────────────────────────
   * Previous approach used:
   *   pg_advisory_xact_lock → serialises all callers (bottleneck)
   *   SELECT MAX()          → still 2 DB round-trips
   *
   * This approach uses:
   *   SELECT nextval('seq_reg_cp')  → single atomic DB operation
   *
   * WHY SEQUENCES ARE BETTER:
   *   - nextval() is internally atomic — the DB engine increments the counter
   *     and returns the new value in one indivisible step
   *   - No application-level locking at all — concurrent callers each get a
   *     unique value simultaneously without blocking each other
   *   - O(1) time — sequence counters live in shared memory, no table scan
   *   - Gaps can occur if a transaction rolls back (e.g. CP0043 is consumed
   *     but never inserted) — this is acceptable in ERP systems and is the
   *     standard trade-off for lock-free generation
   *
   * SEQUENCE NAMING CONVENTION (must match migration 20260618000000):
   *   prefix → sequence name
   *   'CP'   → seq_reg_cp
   *   'AP'   → seq_reg_ap
   *   'AR'   → seq_reg_ar
   *   'BR'   → seq_reg_br
   *   'CJ'   → seq_reg_cj
   *   'INV-' → seq_reg_inv
   *   'FA-'  → seq_reg_fa
   *   'AJ'   → seq_reg_aj
   *   'ND'   → seq_reg_nd
   *   'NC'   → seq_reg_nc
   *
   * CALLERS — zero signature changes needed:
   *   purchaseService        → generateRegistrationNumber('CP',   Purchase,    tx)
   *   accountsPayableService → generateRegistrationNumber('AP',   AP,          tx)
   *   accountsReceivable     → generateRegistrationNumber('AR',   AR,          tx)
   *   bankRegisterService    → generateRegistrationNumber('BR',   BankReg,     tx)
   *   cashRegisterService    → generateRegistrationNumber('CJ',   CashReg,     tx)
   *   investmentService      → generateRegistrationNumber('INV-', Investment,  tx)
   *   fixedAssetService      → generateRegistrationNumber('FA-',  FixedAsset,  tx)
   *   adjustmentService      → generateRegistrationNumber(prefix, Adjustment,  tx)
   *
   * TIME  : O(1) — sequence counter read from shared memory
   * SPACE : O(1) — single scalar result
   */
  protected async generateRegistrationNumber(
    prefix: string,
    model: any,
    transaction?: Transaction
  ): Promise<string> {
    // Derive sequence name from prefix using the same convention as the migration.
    // 'CP' → 'seq_reg_cp', 'INV-' → 'seq_reg_inv', 'FA-' → 'seq_reg_fa'
    const seqName = `seq_reg_${prefix.toLowerCase().replace(/-/g, '')}`;

    // nextval() is a single atomic DB call — no locks, no race conditions.
    // The sequence is always inside the same transaction so if the transaction
    // rolls back, the sequence number is consumed but not inserted (gap).
    // This is the standard PostgreSQL behaviour and is acceptable for ERP IDs.
    const [result] = await sequelize.query(
      `SELECT nextval(:seqName) AS next_val`,
      {
        replacements: { seqName },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    const nextNumber = Number((result as any).next_val);

    // Zero-pad to 4 digits: 'CP0001', 'AP0042', 'INV-0007', 'FA-0003'
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
  
  // ==================== PAGINATION METHODS ====================
  
  /**
   * Generic pagination method for any Sequelize model
   * Provides consistent pagination across all services
   * 
   * @param model - Sequelize model class
   * @param options - Query options (pagination, filters, search)
   * @param additionalWhere - Additional WHERE conditions
   * @param include - Sequelize associations to include
   * @returns Paginated response with data and metadata
   * 
   * @example
   * // In any service extending BaseService:
   * async getAllRecords(options: QueryOptions) {
   *   return this.getAllWithPagination(
   *     MyModel,
   *     {
   *       ...options,
   *       searchFields: ['name', 'code'],
   *       dateField: 'createdAt'
   *     }
   *   );
   * }
   */
  protected async getAllWithPagination<T extends any>(
    model: any,
    options: any = {},
    additionalWhere: any = {},
    include: any[] = []
  ): Promise<any> {    
    return await PaginationService.paginate(
      model,
      options,
      additionalWhere,
      include
    );
  }
}