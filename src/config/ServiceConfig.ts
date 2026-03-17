/**
 * Service Configuration - Centralized configuration for all services
 * Provides type-safe configuration with environment variable support
 */

export interface ServiceConfig {
  // Transaction settings
  transaction: {
    maxRetryAttempts: number;
    timeout: number;
    duplicateWindowMinutes: number;
  };
  
  // Validation limits
  validation: {
    maxPurchaseAmount: number;
    minPurchaseAmount: number;
    maxItemsPerPurchase: number;
    maxAssociatedInvoices: number;
    floatingPointPrecision: number;
  };
  
  // Performance settings
  performance: {
    batchSize: number;
    queryTimeout: number;
    maxConcurrentOperations: number;
  };
  
  // Business rules
  business: {
    defaultCurrency: string;
    taxCalculationPrecision: number;
    creditLimitCheckEnabled: boolean;
    balanceValidationEnabled: boolean;
  };
  
  // Error handling
  errorHandling: {
    maxErrorContextLength: number;
    sanitizeErrorMessages: boolean;
    logSensitiveData: boolean;
    enableRetryOnTransientErrors: boolean;
  };
  
  // Payment processing
  payment: {
    immediatePaymentTypes: string[];
    creditPaymentTypes: string[];
    bankPaymentTypes: string[];
    cardPaymentTypes: string[];
  };
  
  // Registration number formats
  registrationNumbers: {
    purchase: string;
    bankRegister: string;
    accountsPayable: string;
    businessExpense: string;
    sale: string;
    payment: string;
  };
}

// Default configuration with environment variable overrides
export const serviceConfig: ServiceConfig = {
  transaction: {
    maxRetryAttempts: parseInt(process.env.SERVICE_MAX_RETRIES || '3'),
    timeout: parseInt(process.env.SERVICE_TRANSACTION_TIMEOUT || '30000'),
    duplicateWindowMinutes: parseInt(process.env.SERVICE_DUPLICATE_WINDOW || '5')
  },
  
  validation: {
    maxPurchaseAmount: parseFloat(process.env.SERVICE_MAX_PURCHASE_AMOUNT || '1000000'),
    minPurchaseAmount: parseFloat(process.env.SERVICE_MIN_PURCHASE_AMOUNT || '0.01'),
    maxItemsPerPurchase: parseInt(process.env.SERVICE_MAX_ITEMS_PER_PURCHASE || '100'),
    maxAssociatedInvoices: parseInt(process.env.SERVICE_MAX_ASSOCIATED_INVOICES || '50'),
    floatingPointPrecision: parseFloat(process.env.SERVICE_FLOATING_POINT_PRECISION || '0.01')
  },
  
  performance: {
    batchSize: parseInt(process.env.SERVICE_BATCH_SIZE || '50'),
    queryTimeout: parseInt(process.env.SERVICE_QUERY_TIMEOUT || '15000'),
    maxConcurrentOperations: parseInt(process.env.SERVICE_MAX_CONCURRENT_OPS || '10')
  },
  
  business: {
    defaultCurrency: process.env.SERVICE_DEFAULT_CURRENCY || 'DOP',
    taxCalculationPrecision: parseInt(process.env.SERVICE_TAX_PRECISION || '4'),
    creditLimitCheckEnabled: process.env.SERVICE_CREDIT_LIMIT_CHECK === 'true',
    balanceValidationEnabled: process.env.SERVICE_BALANCE_VALIDATION !== 'false'
  },
  
  errorHandling: {
    maxErrorContextLength: parseInt(process.env.SERVICE_MAX_ERROR_CONTEXT || '1000'),
    sanitizeErrorMessages: process.env.SERVICE_SANITIZE_ERRORS !== 'false',
    logSensitiveData: process.env.SERVICE_LOG_SENSITIVE_DATA === 'true',
    enableRetryOnTransientErrors: process.env.SERVICE_ENABLE_RETRY !== 'false'
  },
  
  payment: {
    immediatePaymentTypes: ['CASH', 'CHEQUE', 'BANK_TRANSFER', 'DEBIT_CARD'],
    creditPaymentTypes: ['CREDIT', 'CREDIT_CARD'],
    bankPaymentTypes: ['CASH', 'CHEQUE', 'BANK_TRANSFER', 'DEBIT_CARD', 'DEPOSIT'],
    cardPaymentTypes: ['DEBIT_CARD', 'CREDIT_CARD']
  },
  
  registrationNumbers: {
    purchase: 'CP',
    bankRegister: 'BR',
    accountsPayable: 'AP',
    businessExpense: 'BE',
    sale: 'SL',
    payment: 'PM'
  }
};

/**
 * Payment type utilities
 */
export class PaymentTypeHelper {
  static isImmediatePayment(paymentType: string): boolean {
    return serviceConfig.payment.immediatePaymentTypes.includes(paymentType.toUpperCase());
  }
  
  static isCreditPayment(paymentType: string): boolean {
    return serviceConfig.payment.creditPaymentTypes.includes(paymentType.toUpperCase());
  }
  
  static isBankPayment(paymentType: string): boolean {
    return serviceConfig.payment.bankPaymentTypes.includes(paymentType.toUpperCase());
  }
  
  static isCardPayment(paymentType: string): boolean {
    return serviceConfig.payment.cardPaymentTypes.includes(paymentType.toUpperCase());
  }
  
  static validatePaymentType(paymentType: string): boolean {
    const allTypes = [
      ...serviceConfig.payment.immediatePaymentTypes,
      ...serviceConfig.payment.creditPaymentTypes
    ];
    return allTypes.includes(paymentType.toUpperCase());
  }
}

/**
 * Registration number utilities
 */
export class RegistrationNumberHelper {
  static getPrefix(entityType: keyof ServiceConfig['registrationNumbers']): string {
    return serviceConfig.registrationNumbers[entityType];
  }
  
  static isValidFormat(registrationNumber: string, entityType: keyof ServiceConfig['registrationNumbers']): boolean {
    const prefix = serviceConfig.registrationNumbers[entityType];
    const pattern = new RegExp(`^${prefix}\\d{4}$`);
    return pattern.test(registrationNumber);
  }
}

export default serviceConfig;