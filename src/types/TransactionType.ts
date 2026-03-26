/**
 * SourceSystemType Enum (formerly TransactionType)
 * 
 * Defines which system/module created the transaction.
 * Used to track the origin of transactions in Bank Register and AP tables.
 * 
 * CLEAR NAMING:
 * - This is NOT about money flow direction (INFLOW/OUTFLOW)
 * - This is about SOURCE SYSTEM that created the transaction
 * 
 * Examples:
 * - PURCHASE = Created by Purchase module
 * - PAYMENT = Created by Payment module
 * - SALE = Created by Sales module
 */

export enum TransactionType {
  PURCHASE = 'PURCHASE',
  BUSINESS_EXPENSE = 'BUSINESS_EXPENSE',
  SALE = 'SALE',
  PAYMENT = 'PAYMENT',
  ADJUSTMENT = 'ADJUSTMENT',
  TRANSFER = 'TRANSFER',
  AR_COLLECTION = 'AR_COLLECTION',
  CREDIT_USAGE = 'CREDIT_USAGE'
}

/**
 * Valid transaction types array for validation
 */
export const VALID_TRANSACTION_TYPES = Object.values(TransactionType);

/**
 * Transaction type display names for UI
 */
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  [TransactionType.PURCHASE]: 'Purchase',
  [TransactionType.BUSINESS_EXPENSE]: 'Business Expense',
  [TransactionType.SALE]: 'Sale',
  [TransactionType.PAYMENT]: 'Payment',
  [TransactionType.ADJUSTMENT]: 'Adjustment',
  [TransactionType.TRANSFER]: 'Transfer',
  [TransactionType.AR_COLLECTION]: 'AR Collection',
  [TransactionType.CREDIT_USAGE]: 'Credit Usage'
};

/**
 * Check if a string is a valid transaction type
 */
export function isValidTransactionType(value: string): value is TransactionType {
  return VALID_TRANSACTION_TYPES.includes(value as TransactionType);
}

/**
 * Get display label for transaction type
 */
export function getTransactionTypeLabel(type: TransactionType): string {
  return TRANSACTION_TYPE_LABELS[type] || type;
}

export default TransactionType;