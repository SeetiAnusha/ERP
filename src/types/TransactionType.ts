/**
 * TransactionType Enum
 * 
 * Defines the source system types for transactions that flow into
 * Bank Register and Accounts Payable tables.
 * 
 * This enables tracking which system originated each transaction
 * for analytics and audit purposes.
 */

export enum TransactionType {
  PURCHASE = 'PURCHASE',
  BUSINESS_EXPENSE = 'BUSINESS_EXPENSE',
  SALE = 'SALE',
  PAYMENT = 'PAYMENT',
  ADJUSTMENT = 'ADJUSTMENT',
  TRANSFER = 'TRANSFER'
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
  [TransactionType.TRANSFER]: 'Transfer'
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