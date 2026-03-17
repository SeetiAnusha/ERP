import { ValidationError } from './AppError';
import { serviceConfig, PaymentTypeHelper } from '../config/ServiceConfig';

/**
 * Validation Framework - Centralized validation logic for all services
 * Provides reusable validation rules with consistent error messages
 */

export interface ValidationRule<T = any> {
  field: string;
  validator: (value: any, data?: T) => boolean | string;
  message?: string;
  required?: boolean;
}

export interface ValidationSchema<T = any> {
  rules: ValidationRule<T>[];
  customValidators?: Array<(data: T) => void>;
}

/**
 * Core Validation Framework
 */
export class ValidationFramework {
  
  /**
   * Validate data against schema
   */
  static validate<T>(data: T, schema: ValidationSchema<T>): void {
    // Validate individual fields
    for (const rule of schema.rules) {
      this.validateField(data, rule);
    }
    
    // Run custom validators
    if (schema.customValidators) {
      for (const validator of schema.customValidators) {
        validator(data);
      }
    }
  }
  
  /**
   * Validate individual field
   */
  private static validateField<T>(data: T, rule: ValidationRule<T>): void {
    const value = (data as any)[rule.field];
    
    // Check required fields
    if (rule.required && (value === null || value === undefined || value === '')) {
      throw new ValidationError(`${rule.field} is required`);
    }
    
    // Skip validation if field is not required and empty
    if (!rule.required && (value === null || value === undefined || value === '')) {
      return;
    }
    
    // Run validator
    const result = rule.validator(value, data);
    
    if (result === false) {
      throw new ValidationError(rule.message || `Invalid value for ${rule.field}`);
    }
    
    if (typeof result === 'string') {
      throw new ValidationError(result);
    }
  }
}

/**
 * Common Validation Rules
 */
export class CommonValidators {
  
  // ==================== BASIC VALIDATORS ====================
  
  static required(message?: string) {
    return {
      validator: (value: any) => value !== null && value !== undefined && value !== '',
      message: message || 'This field is required'
    };
  }
  
  static isNumber(message?: string) {
    return {
      validator: (value: any) => !isNaN(Number(value)),
      message: message || 'Must be a valid number'
    };
  }
  
  static isPositive(message?: string) {
    return {
      validator: (value: any) => Number(value) > 0,
      message: message || 'Must be a positive number'
    };
  }
  
  static isNonNegative(message?: string) {
    return {
      validator: (value: any) => Number(value) >= 0,
      message: message || 'Must be zero or positive'
    };
  }
  
  static minValue(min: number, message?: string) {
    return {
      validator: (value: any) => Number(value) >= min,
      message: message || `Must be at least ${min}`
    };
  }
  
  static maxValue(max: number, message?: string) {
    return {
      validator: (value: any) => Number(value) <= max,
      message: message || `Must not exceed ${max}`
    };
  }
  
  static isInteger(message?: string) {
    return {
      validator: (value: any) => Number.isInteger(Number(value)),
      message: message || 'Must be a whole number'
    };
  }
  
  static isString(message?: string) {
    return {
      validator: (value: any) => typeof value === 'string',
      message: message || 'Must be a text value'
    };
  }
  
  static minLength(min: number, message?: string) {
    return {
      validator: (value: any) => String(value).length >= min,
      message: message || `Must be at least ${min} characters`
    };
  }
  
  static maxLength(max: number, message?: string) {
    return {
      validator: (value: any) => String(value).length <= max,
      message: message || `Must not exceed ${max} characters`
    };
  }
  
  static isEmail(message?: string) {
    return {
      validator: (value: any) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)),
      message: message || 'Must be a valid email address'
    };
  }
  
  static isDate(message?: string) {
    return {
      validator: (value: any) => !isNaN(Date.parse(value)),
      message: message || 'Must be a valid date'
    };
  }
  
  static isEnum(allowedValues: string[], message?: string) {
    return {
      validator: (value: any) => allowedValues.includes(String(value)),
      message: message || `Must be one of: ${allowedValues.join(', ')}`
    };
  }
  
  // ==================== BUSINESS VALIDATORS ====================
  
  static isValidPaymentType(message?: string) {
    return {
      validator: (value: any) => PaymentTypeHelper.validatePaymentType(String(value)),
      message: message || `Invalid payment type. Must be one of: ${[
        ...serviceConfig.payment.immediatePaymentTypes,
        ...serviceConfig.payment.creditPaymentTypes
      ].join(', ')}`
    };
  }
  
  static isValidAmount(message?: string) {
    return {
      validator: (value: any) => {
        const num = Number(value);
        return !isNaN(num) && 
               num >= serviceConfig.validation.minPurchaseAmount && 
               num <= serviceConfig.validation.maxPurchaseAmount;
      },
      message: message || `Amount must be between ${serviceConfig.validation.minPurchaseAmount} and ${serviceConfig.validation.maxPurchaseAmount}`
    };
  }
  
  static isValidRNC(message?: string) {
    return {
      validator: (value: any) => {
        if (!value) return true; // Optional field
        const rnc = String(value).replace(/\D/g, ''); // Remove non-digits
        return rnc.length === 9 || rnc.length === 11;
      },
      message: message || 'RNC must be 9 or 11 digits'
    };
  }
  
  static isValidNCF(message?: string) {
    return {
      validator: (value: any) => {
        if (!value) return true; // Optional field
        const ncf = String(value).replace(/\D/g, ''); // Remove non-digits
        return ncf.length === 8;
      },
      message: message || 'NCF must be 8 digits'
    };
  }
  
  static isValidCurrency(message?: string) {
    return {
      validator: (value: any) => {
        const num = Number(value);
        return !isNaN(num) && Number.isFinite(num) && num >= 0;
      },
      message: message || 'Must be a valid currency amount'
    };
  }
  
  // ==================== CONDITIONAL VALIDATORS ====================
  
  static requiredIf(condition: (data: any) => boolean, message?: string) {
    return {
      validator: (value: any, data: any) => {
        if (condition(data)) {
          return value !== null && value !== undefined && value !== '';
        }
        return true;
      },
      message: message || 'This field is required'
    };
  }
  
  static validIf(condition: (data: any) => boolean, validator: (value: any) => boolean, message?: string) {
    return {
      validator: (value: any, data: any) => {
        if (condition(data)) {
          return validator(value);
        }
        return true;
      },
      message: message || 'Invalid value'
    };
  }
}

/**
 * Pre-built validation schemas for common entities
 */
export class ValidationSchemas {
  
  static readonly PURCHASE_CREATE: ValidationSchema = {
    rules: [
      { field: 'supplierId', validator: CommonValidators.isInteger().validator, message: 'Valid supplier is required', required: true },
      { field: 'total', validator: CommonValidators.isValidAmount().validator, message: CommonValidators.isValidAmount().message, required: true },
      { field: 'paymentType', validator: CommonValidators.isValidPaymentType().validator, message: CommonValidators.isValidPaymentType().message, required: true },
      { field: 'date', validator: CommonValidators.isDate().validator, message: 'Valid date is required', required: true },
      { field: 'supplierRnc', validator: CommonValidators.isValidRNC().validator, message: CommonValidators.isValidRNC().message, required: false },
      { field: 'ncf', validator: CommonValidators.isValidNCF().validator, message: CommonValidators.isValidNCF().message, required: false }
    ],
    customValidators: [
      (data: any) => {
        // Validate payment type specific requirements
        const paymentType = String(data.paymentType).toUpperCase();
        
        if (paymentType === 'CHEQUE') {
          if (!data.bankAccountId) throw new ValidationError('Bank account is required for cheque payments');
          if (!data.chequeNumber) throw new ValidationError('Cheque number is required');
          if (!data.chequeDate) throw new ValidationError('Cheque date is required');
        }
        
        if (paymentType === 'BANK_TRANSFER') {
          if (!data.bankAccountId) throw new ValidationError('Bank account is required for bank transfer');
          if (!data.transferNumber) throw new ValidationError('Transfer number is required');
          if (!data.transferDate) throw new ValidationError('Transfer date is required');
        }
        
        if (paymentType === 'DEBIT_CARD' || paymentType === 'CREDIT_CARD') {
          if (!data.cardId) throw new ValidationError('Card is required for card payments');
          if (!data.paymentReference) throw new ValidationError('Payment reference is required for card payments');
          if (!data.voucherDate) throw new ValidationError('Voucher date is required for card payments');
        }
        
        // Validate items if present
        if (data.items && Array.isArray(data.items)) {
          if (data.items.length > serviceConfig.validation.maxItemsPerPurchase) {
            throw new ValidationError(`Cannot exceed ${serviceConfig.validation.maxItemsPerPurchase} items per purchase`);
          }
          
          data.items.forEach((item: any, index: number) => {
            if (!item.productId) throw new ValidationError(`Item ${index + 1}: Product is required`);
            if (!item.quantity || item.quantity <= 0) throw new ValidationError(`Item ${index + 1}: Valid quantity is required`);
            if (!item.unitCost || item.unitCost <= 0) throw new ValidationError(`Item ${index + 1}: Valid unit cost is required`);
          });
        }
        
        // Validate associated invoices if present
        if (data.associatedInvoices && Array.isArray(data.associatedInvoices)) {
          if (data.associatedInvoices.length > serviceConfig.validation.maxAssociatedInvoices) {
            throw new ValidationError(`Cannot exceed ${serviceConfig.validation.maxAssociatedInvoices} associated invoices`);
          }
          
          data.associatedInvoices.forEach((invoice: any, index: number) => {
            if (!invoice.amount || invoice.amount <= 0) {
              throw new ValidationError(`Associated invoice ${index + 1}: Valid amount is required`);
            }
            if (!invoice.supplierName) {
              throw new ValidationError(`Associated invoice ${index + 1}: Supplier name is required`);
            }
          });
        }
      }
    ]
  };
  
  static readonly PAYMENT_COLLECTION: ValidationSchema = {
    rules: [
      { field: 'amount', validator: CommonValidators.isPositive().validator, message: 'Payment amount must be greater than 0', required: true },
      { field: 'paymentMethod', validator: CommonValidators.isString().validator, message: 'Payment method is required', required: true }
    ]
  };
  
  static readonly BANK_REGISTER_CREATE: ValidationSchema = {
    rules: [
      { field: 'bankAccountId', validator: CommonValidators.isInteger().validator, message: 'Bank account is required', required: true },
      { field: 'amount', validator: CommonValidators.isPositive().validator, message: 'Amount must be greater than 0', required: true },
      { field: 'transactionType', validator: CommonValidators.isEnum(['INFLOW', 'OUTFLOW']).validator, message: 'Transaction type must be INFLOW or OUTFLOW', required: true },
      { field: 'paymentMethod', validator: CommonValidators.isString().validator, message: 'Payment method is required', required: true }
    ]
  };
}

export default ValidationFramework;