/**
 * Cash Register Source Transaction Types
 * 
 * Defines all possible sources for cash register transactions.
 * This enum ensures type safety and consistency across the application.
 * 
 * @enum {string}
 */
export enum CashRegisterSourceType {
  /** Direct cash sales from Sales module */
  SALE = 'SALE',
  
  /** Customer payments for credit sales (AR Collection) */
  AR_COLLECTION = 'AR_COLLECTION',
  
  /** Investor contributions (cash method) */
  CONTRIBUTION = 'CONTRIBUTION',
  
  /** Loan receipts (cash method) */
  LOAN = 'LOAN',
  
  /** Cash moved to bank account (OUTFLOW) */
  BANK_DEPOSIT = 'BANK_DEPOSIT',
  
  /** Manual corrections (OUTFLOW) */
  CORRECTION = 'CORRECTION',
  
  /** Manual entries without specific source */
  MANUAL = 'MANUAL'
}

/**
 * Display labels for source types (for UI)
 */
export const CashRegisterSourceTypeLabels: Record<CashRegisterSourceType, string> = {
  [CashRegisterSourceType.SALE]: 'Sale',
  [CashRegisterSourceType.AR_COLLECTION]: 'AR Collection',
  [CashRegisterSourceType.CONTRIBUTION]: 'Contribution',
  [CashRegisterSourceType.LOAN]: 'Loan',
  [CashRegisterSourceType.BANK_DEPOSIT]: 'Bank Deposit',
  [CashRegisterSourceType.CORRECTION]: 'Correction',
  [CashRegisterSourceType.MANUAL]: 'Manual Entry'
};

/**
 * Validate if a string is a valid CashRegisterSourceType
 */
export function isValidCashRegisterSourceType(value: string): value is CashRegisterSourceType {
  return Object.values(CashRegisterSourceType).includes(value as CashRegisterSourceType);
}

/**
 * Normalize and validate source type from various input formats
 * Handles case-insensitivity and common variations
 * 
 * @param input - Raw source type string
 * @returns Normalized CashRegisterSourceType or MANUAL as fallback
 */
export function normalizeCashRegisterSourceType(input?: string | null): CashRegisterSourceType {
  if (!input) {
    return CashRegisterSourceType.MANUAL;
  }
  
  // Normalize: uppercase and replace spaces with underscores
  const normalized = input.toUpperCase().trim().replace(/\s+/g, '_');
  
  // Direct match
  if (isValidCashRegisterSourceType(normalized)) {
    return normalized as CashRegisterSourceType;
  }
  
  // Handle common variations
  switch (normalized) {
    case 'AR_COLLECTION':
    case 'AR COLLECTION':
    case 'ARCOLLECTION':
    case 'AR':
      return CashRegisterSourceType.AR_COLLECTION;
      
    case 'BANK_DEPOSIT':
    case 'BANK DEPOSIT':
    case 'BANKDEPOSIT':
    case 'DEPOSIT':
      return CashRegisterSourceType.BANK_DEPOSIT;
      
    case 'SALE':
    case 'SALES':
      return CashRegisterSourceType.SALE;
      
    case 'CONTRIBUTION':
    case 'CONTRIBUTIONS':
    case 'INVEST':
    case 'INVESTMENT':
      return CashRegisterSourceType.CONTRIBUTION;
      
    case 'LOAN':
    case 'LOANS':
      return CashRegisterSourceType.LOAN;
      
    case 'CORRECTION':
    case 'CORRECTIONS':
    case 'ADJUST':
    case 'ADJUSTMENT':
      return CashRegisterSourceType.CORRECTION;
      
    default:
      console.warn(`[CashRegisterSourceType] Unknown source type: "${input}", defaulting to MANUAL`);
      return CashRegisterSourceType.MANUAL;
  }
}

/**
 * Get all valid source types as array
 */
export function getAllCashRegisterSourceTypes(): CashRegisterSourceType[] {
  return Object.values(CashRegisterSourceType);
}
