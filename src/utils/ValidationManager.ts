/**
 * ValidationManager - Centralized validation utility
 * 
 * PERFORMANCE OPTIMIZATION:
 * - Before: Duplicate validation logic in 10+ places
 * - After: Single source of truth with O(1) validation
 * 
 * FEATURES:
 * - Type-safe validation rules
 * - Comprehensive error messages
 * - Extensible validation system
 */

interface ValidationRule {
  field: string;
  required: boolean;
  type?: 'string' | 'number' | 'date' | 'email' | 'phone';
  min?: number;
  max?: number;
  pattern?: RegExp;
  customValidator?: (value: any) => boolean;
  errorMessage?: string;
}

interface PaymentValidationConfig {
  requiredFields: string[];
  optionalFields?: string[];
  customValidations?: Array<(data: any) => void>;
}

export class ValidationManager {
  
  // Payment type validation configurations
  private static paymentValidations: Record<string, PaymentValidationConfig> = {
    'CHEQUE': {
      requiredFields: ['bankAccountId', 'chequeNumber', 'chequeDate'],
      customValidations: [
        (data) => {
          if (data.chequeDate && new Date(data.chequeDate) > new Date()) {
            throw new Error('Cheque date cannot be in the future');
          }
        }
      ]
    },
    'BANK_TRANSFER': {
      requiredFields: ['bankAccountId', 'transferNumber', 'transferDate'],
      customValidations: [
        (data) => {
          if (data.transferDate && new Date(data.transferDate) > new Date()) {
            throw new Error('Transfer date cannot be in the future');
          }
        }
      ]
    },
    'DEBIT_CARD': {
      requiredFields: ['cardId', 'paymentReference', 'voucherDate'],
      customValidations: [
        (data) => {
          if (data.voucherDate && new Date(data.voucherDate) > new Date()) {
            throw new Error('Voucher date cannot be in the future');
          }
        }
      ]
    },
    'CREDIT_CARD': {
      requiredFields: ['cardId', 'paymentReference', 'voucherDate'],
      customValidations: [
        (data) => {
          if (data.voucherDate && new Date(data.voucherDate) > new Date()) {
            throw new Error('Voucher date cannot be in the future');
          }
        }
      ]
    },
    'CASH': {
      requiredFields: ['cashRegisterId']
    },
    'DEPOSIT': {
      requiredFields: ['bankAccountId']
    },
    'CREDIT': {
      requiredFields: []
    }
  };
  
  /**
   * Validate payment type requirements
   * @param paymentType - Payment type to validate
   * @param data - Data object to validate
   * @throws Error if validation fails
   */
  static validatePaymentType(paymentType: string, data: any): void {
    const normalizedType = paymentType.toUpperCase();
    const config = this.paymentValidations[normalizedType];
    
    if (!config) {
      throw new Error(`Unsupported payment type: ${paymentType}`);
    }
    
    // Validate required fields
    this.validateRequiredFields(data, config.requiredFields, paymentType);
    
    // Run custom validations
    if (config.customValidations) {
      config.customValidations.forEach(validator => validator(data));
    }
  }
  
  /**
   * Validate required fields are present and not empty
   * @param data - Data object to validate
   * @param fields - Array of required field names
   * @param context - Context for error message
   * @throws Error if validation fails
   */
  static validateRequiredFields(data: any, fields: string[], context: string = 'operation'): void {
    const missing: string[] = [];
    const empty: string[] = [];
    
    fields.forEach(field => {
      if (!(field in data)) {
        missing.push(field);
      } else if (this.isEmpty(data[field])) {
        empty.push(field);
      }
    });
    
    if (missing.length > 0) {
      throw new Error(
        `Missing required fields for ${context}: ${missing.join(', ')}`
      );
    }
    
    if (empty.length > 0) {
      throw new Error(
        `Empty required fields for ${context}: ${empty.join(', ')}`
      );
    }
  }
  
  /**
   * Validate field against specific rules
   * @param value - Value to validate
   * @param rules - Validation rules
   * @param fieldName - Field name for error messages
   * @throws Error if validation fails
   */
  static validateField(value: any, rules: ValidationRule, fieldName?: string): void {
    const name = fieldName || rules.field;
    
    // Required field validation
    if (rules.required && this.isEmpty(value)) {
      throw new Error(rules.errorMessage || `${name} is required`);
    }
    
    // Skip further validation if field is empty and not required
    if (this.isEmpty(value) && !rules.required) {
      return;
    }
    
    // Type validation
    if (rules.type) {
      this.validateType(value, rules.type, name);
    }
    
    // Range validation
    if (rules.min !== undefined || rules.max !== undefined) {
      this.validateRange(value, rules.min, rules.max, name);
    }
    
    // Pattern validation
    if (rules.pattern) {
      this.validatePattern(value, rules.pattern, name);
    }
    
    // Custom validation
    if (rules.customValidator && !rules.customValidator(value)) {
      throw new Error(rules.errorMessage || `${name} failed custom validation`);
    }
  }
  
  /**
   * Validate multiple fields at once
   * @param data - Data object to validate
   * @param rules - Array of validation rules
   * @throws Error if any validation fails
   */
  static validateFields(data: any, rules: ValidationRule[]): void {
    rules.forEach(rule => {
      const value = data[rule.field];
      this.validateField(value, rule);
    });
  }
  
  /**
   * Validate purchase data
   * @param data - Purchase data to validate
   * @throws Error if validation fails
   */
  static validatePurchaseData(data: any): void {
    // Basic required fields
    this.validateRequiredFields(data, [
      'supplierId', 'date', 'purchaseType', 'paymentType'
    ], 'purchase');
    
    // Payment type specific validation
    this.validatePaymentType(data.paymentType, data);
    
    // Items validation
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      throw new Error('At least one product item is required for purchase');
    }
    
    // Validate each item
    data.items.forEach((item: any, index: number) => {
      this.validatePurchaseItem(item, index);
    });
    
    // Associated invoices validation
    if (data.associatedInvoices && Array.isArray(data.associatedInvoices)) {
      data.associatedInvoices.forEach((invoice: any, index: number) => {
        this.validateAssociatedInvoice(invoice, index);
      });
    }
  }
  
  /**
   * Validate sale data
   * @param data - Sale data to validate
   * @throws Error if validation fails
   */
  static validateSaleData(data: any): void {
    // Basic required fields
    this.validateRequiredFields(data, [
      'clientId', 'date', 'saleType', 'paymentType'
    ], 'sale');
    
    // Payment type specific validation
    this.validatePaymentType(data.paymentType, data);
    
    // Items validation
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      throw new Error('At least one product item is required for sale');
    }
    
    // Validate each item
    data.items.forEach((item: any, index: number) => {
      this.validateSaleItem(item, index);
    });
  }
  
  /**
   * Validate purchase item
   * @param item - Purchase item to validate
   * @param index - Item index for error messages
   * @throws Error if validation fails
   */
  private static validatePurchaseItem(item: any, index: number): void {
    const context = `purchase item ${index + 1}`;
    
    this.validateRequiredFields(item, [
      'productId', 'quantity', 'unitCost'
    ], context);
    
    if (Number(item.quantity) <= 0) {
      throw new Error(`${context}: quantity must be greater than 0`);
    }
    
    if (Number(item.unitCost) < 0) {
      throw new Error(`${context}: unit cost cannot be negative`);
    }
  }
  
  /**
   * Validate sale item
   * @param item - Sale item to validate
   * @param index - Item index for error messages
   * @throws Error if validation fails
   */
  private static validateSaleItem(item: any, index: number): void {
    const context = `sale item ${index + 1}`;
    
    this.validateRequiredFields(item, [
      'productId', 'quantity', 'unitPrice'
    ], context);
    
    if (Number(item.quantity) <= 0) {
      throw new Error(`${context}: quantity must be greater than 0`);
    }
    
    if (Number(item.unitPrice) < 0) {
      throw new Error(`${context}: unit price cannot be negative`);
    }
  }
  
  /**
   * Validate associated invoice
   * @param invoice - Associated invoice to validate
   * @param index - Invoice index for error messages
   * @throws Error if validation fails
   */
  private static validateAssociatedInvoice(invoice: any, index: number): void {
    const context = `associated invoice ${index + 1}`;
    
    this.validateRequiredFields(invoice, [
      'supplierRnc', 'supplierName', 'concept', 'paymentType'
    ], context);
    
    // Payment type specific validation for invoice
    this.validatePaymentType(invoice.paymentType, invoice);
    
    if (Number(invoice.amount || 0) <= 0) {
      throw new Error(`${context}: amount must be greater than 0`);
    }
  }
  
  /**
   * Check if value is empty
   * @param value - Value to check
   * @returns boolean - True if empty
   */
  private static isEmpty(value: any): boolean {
    return value === null || 
           value === undefined || 
           value === '' || 
           (Array.isArray(value) && value.length === 0);
  }
  
  /**
   * Validate value type
   * @param value - Value to validate
   * @param expectedType - Expected type
   * @param fieldName - Field name for error message
   * @throws Error if type validation fails
   */
  private static validateType(value: any, expectedType: string, fieldName: string): void {
    switch (expectedType) {
      case 'string':
        if (typeof value !== 'string') {
          throw new Error(`${fieldName} must be a string`);
        }
        break;
      case 'number':
        if (isNaN(Number(value))) {
          throw new Error(`${fieldName} must be a valid number`);
        }
        break;
      case 'date':
        if (isNaN(Date.parse(value))) {
          throw new Error(`${fieldName} must be a valid date`);
        }
        break;
      case 'email':
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(value)) {
          throw new Error(`${fieldName} must be a valid email address`);
        }
        break;
      case 'phone':
        const phonePattern = /^[\+]?[1-9][\d]{0,15}$/;
        if (!phonePattern.test(value.replace(/[\s\-\(\)]/g, ''))) {
          throw new Error(`${fieldName} must be a valid phone number`);
        }
        break;
    }
  }
  
  /**
   * Validate value range
   * @param value - Value to validate
   * @param min - Minimum value
   * @param max - Maximum value
   * @param fieldName - Field name for error message
   * @throws Error if range validation fails
   */
  private static validateRange(value: any, min?: number, max?: number, fieldName?: string): void {
    const numValue = Number(value);
    
    if (min !== undefined && numValue < min) {
      throw new Error(`${fieldName} must be at least ${min}`);
    }
    
    if (max !== undefined && numValue > max) {
      throw new Error(`${fieldName} must be at most ${max}`);
    }
  }
  
  /**
   * Validate value against pattern
   * @param value - Value to validate
   * @param pattern - Regular expression pattern
   * @param fieldName - Field name for error message
   * @throws Error if pattern validation fails
   */
  private static validatePattern(value: any, pattern: RegExp, fieldName: string): void {
    if (!pattern.test(String(value))) {
      throw new Error(`${fieldName} format is invalid`);
    }
  }
  
  /**
   * Add custom payment validation
   * @param paymentType - Payment type
   * @param config - Validation configuration
   */
  static addPaymentValidation(paymentType: string, config: PaymentValidationConfig): void {
    this.paymentValidations[paymentType.toUpperCase()] = config;
  }
  
  /**
   * Get validation statistics
   * @returns Object with validation statistics
   */
  static getValidationStats(): {
    supportedPaymentTypes: string[];
    totalValidationRules: number;
  } {
    return {
      supportedPaymentTypes: Object.keys(this.paymentValidations),
      totalValidationRules: Object.values(this.paymentValidations)
        .reduce((sum, config) => sum + config.requiredFields.length, 0)
    };
  }
}

export default ValidationManager;