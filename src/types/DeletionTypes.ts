/**
 * Reversal Operation for batch processing
 * Optimizes database operations using batch inserts
 */
export interface ReversalOperation {
  type: 'BANK_REVERSAL' | 'CASH_REVERSAL' | 'CC_REGISTER_REVERSAL' | 'STATUS_UPDATE' | 'SOFT_DELETE' | 'CREATE_REVERSAL_AP' | 'CREATE_MANUAL_TASK' | 'RESTORE_CREDIT_LIMIT' | 'BANK_BALANCE_UPDATE';
  targetTable: string;
  targetId: number;
  data: any;
  priority: number; // For topological sorting
}

/**
 * Transaction Dependency Graph Node
 * Used for DSA-based dependency resolution
 */
export interface TransactionNode {
  id: number;
  type: 'PURCHASE' | 'SALE' | 'PAYMENT' | 'BANK_REGISTER' | 'CASH_REGISTER' | 'AP' | 'AR' | 'BUSINESS_EXPENSE';
  registrationNumber: string;
  amount: number;
  status: string;
  dependencies: TransactionNode[];
  dependents: TransactionNode[];
  processed: boolean;
}

/**
 * Execution data for approved deletion requests
 */
export interface ExecuteDeletionData {
  approvalRequestId: number;
  executedBy: number;
  ipAddress?: string;
  userAgent?: string;
}