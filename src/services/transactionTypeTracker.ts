/**
 * TransactionTypeTracker Service
 * 
 * Centralized service for managing transaction type assignments and validation.
 * Maps source systems to transaction type enums and provides validation logic.
 */

import { TransactionType, isValidTransactionType } from '../types/TransactionType';

/**
 * Source system identifiers
 */
export enum SourceSystem {
  PURCHASE_SYSTEM = 'PURCHASE_SYSTEM',
  BUSINESS_EXPENSE_SYSTEM = 'BUSINESS_EXPENSE_SYSTEM',
  SALE_SYSTEM = 'SALE_SYSTEM',
  PAYMENT_SYSTEM = 'PAYMENT_SYSTEM',
  ADJUSTMENT_SYSTEM = 'ADJUSTMENT_SYSTEM',
  TRANSFER_SYSTEM = 'TRANSFER_SYSTEM'
}

/**
 * Payment type categories for routing logic
 */
export const BANK_PAYMENT_TYPES = [
  'BANK',
  'DEBIT',
  'CHECK',
  'BANK_TRANSFER',
  'CHEQUE',
  'CASH'
];

export const ACCOUNTS_PAYABLE_PAYMENT_TYPES = [
  'CREDIT',
  'CREDIT_CARD',
  'DEBIT_CARD'
];

/**
 * Destination table types
 */
export enum DestinationTable {
  BANK_REGISTER = 'BANK_REGISTER',
  ACCOUNTS_PAYABLE = 'ACCOUNTS_PAYABLE'
}

/**
 * Transaction type tracker interface
 */
export interface ITransactionTypeTracker {
  assignTransactionType(sourceSystem: string, transactionData: any): TransactionType;
  validateTransactionType(transactionType: TransactionType): boolean;
  getTransactionTypeForSystem(systemName: string): TransactionType;
  determineDestinationTable(paymentType: string): DestinationTable;
}

/**
 * Error classes for transaction type tracking
 */
export class UnknownSourceSystemError extends Error {
  constructor(sourceSystem: string) {
    super(`Unknown source system: ${sourceSystem}`);
    this.name = 'UnknownSourceSystemError';
  }
}

export class InvalidTransactionTypeError extends Error {
  constructor(transactionType: string) {
    super(`Invalid transaction type: ${transactionType}`);
    this.name = 'InvalidTransactionTypeError';
  }
}

export class InvalidPaymentTypeError extends Error {
  constructor(paymentType: string) {
    super(`Invalid payment type: ${paymentType}`);
    this.name = 'InvalidPaymentTypeError';
  }
}

/**
 * TransactionTypeTracker implementation
 */
class TransactionTypeTracker implements ITransactionTypeTracker {
  
  /**
   * Source system to transaction type mapping
   */
  private static readonly SOURCE_SYSTEM_MAPPING: Record<string, TransactionType> = {
    [SourceSystem.PURCHASE_SYSTEM]: TransactionType.PURCHASE,
    [SourceSystem.BUSINESS_EXPENSE_SYSTEM]: TransactionType.BUSINESS_EXPENSE,
    [SourceSystem.SALE_SYSTEM]: TransactionType.SALE,
    [SourceSystem.PAYMENT_SYSTEM]: TransactionType.PAYMENT,
    [SourceSystem.ADJUSTMENT_SYSTEM]: TransactionType.ADJUSTMENT,
    [SourceSystem.TRANSFER_SYSTEM]: TransactionType.TRANSFER
  };

  /**
   * Assign transaction type based on source system
   * 
   * @param sourceSystem - The originating system identifier
   * @param transactionData - Transaction data (for future extensibility)
   * @returns TransactionType enum value
   * @throws UnknownSourceSystemError if source system is not recognized
   */
  assignTransactionType(sourceSystem: string, transactionData: any = {}): TransactionType {
    if (!sourceSystem) {
      throw new Error('Source system is required');
    }

    const transactionType = TransactionTypeTracker.SOURCE_SYSTEM_MAPPING[sourceSystem];
    
    if (!transactionType) {
      throw new UnknownSourceSystemError(sourceSystem);
    }

    return transactionType;
  }

  /**
   * Validate transaction type
   * 
   * @param transactionType - Transaction type to validate
   * @returns true if valid, false otherwise
   */
  validateTransactionType(transactionType: TransactionType): boolean {
    return isValidTransactionType(transactionType);
  }

  /**
   * Get transaction type for system name
   * 
   * @param systemName - System name identifier
   * @returns TransactionType enum value
   * @throws UnknownSourceSystemError if system is not recognized
   */
  getTransactionTypeForSystem(systemName: string): TransactionType {
    return this.assignTransactionType(systemName);
  }

  /**
   * Determine destination table based on payment type
   * Preserves existing ERP payment routing logic
   * 
   * @param paymentType - Payment type string
   * @returns DestinationTable enum value
   * @throws InvalidPaymentTypeError if payment type is not recognized
   */
  determineDestinationTable(paymentType: string): DestinationTable {
    if (!paymentType) {
      throw new InvalidPaymentTypeError('Payment type is required');
    }

    const normalizedPaymentType = paymentType.toUpperCase();

    if (BANK_PAYMENT_TYPES.includes(normalizedPaymentType)) {
      return DestinationTable.BANK_REGISTER;
    }

    if (ACCOUNTS_PAYABLE_PAYMENT_TYPES.includes(normalizedPaymentType)) {
      return DestinationTable.ACCOUNTS_PAYABLE;
    }

    throw new InvalidPaymentTypeError(paymentType);
  }

  /**
   * Process transaction with type tracking
   * Main algorithm implementation
   * 
   * @param sourceSystem - Source system identifier
   * @param transactionData - Transaction data
   * @param paymentType - Payment type
   * @returns Object with transaction type and destination table
   */
  processTransactionWithTypeTracking(
    sourceSystem: string,
    transactionData: any,
    paymentType: string
  ): { transactionType: TransactionType; destinationTable: DestinationTable } {
    
    // Step 1: Determine transaction type based on source system
    const transactionType = this.assignTransactionType(sourceSystem, transactionData);
    
    // Step 2: Validate transaction type assignment
    if (!this.validateTransactionType(transactionType)) {
      throw new InvalidTransactionTypeError(transactionType);
    }
    
    // Step 3: Determine destination table based on payment type
    const destinationTable = this.determineDestinationTable(paymentType);
    
    return {
      transactionType,
      destinationTable
    };
  }

  /**
   * Get analytics for transaction type mapping
   * 
   * @returns Mapping statistics and configuration
   */
  getAnalytics(): {
    supportedSystems: string[];
    supportedTransactionTypes: TransactionType[];
    bankPaymentTypes: string[];
    apPaymentTypes: string[];
  } {
    return {
      supportedSystems: Object.keys(TransactionTypeTracker.SOURCE_SYSTEM_MAPPING),
      supportedTransactionTypes: Object.values(TransactionType),
      bankPaymentTypes: BANK_PAYMENT_TYPES,
      apPaymentTypes: ACCOUNTS_PAYABLE_PAYMENT_TYPES
    };
  }
}

// Export singleton instance
export const transactionTypeTracker = new TransactionTypeTracker();

// Export class for testing
export { TransactionTypeTracker };

export default transactionTypeTracker;