/**
 * Enterprise-Grade Customer Credit-Aware Payment Service
 * 
 * Class-based architecture with comprehensive validation and error handling
 * Time Complexity: O(n) where n = number of invoices
 * Space Complexity: O(1) for processing, O(n) for invoice data
 */

import * as creditBalanceService from './creditBalanceService';
import * as cashRegisterService from './cashRegisterService';
import AccountsReceivable from '../models/AccountsReceivable';
import sequelize from '../config/database';
import { BaseService } from '../core/BaseService';
import { ValidationFramework, CommonValidators, ValidationSchema } from '../core/ValidationFramework';
import { 
  ValidationError, 
  NotFoundError, 
  BusinessLogicError, 
  InsufficientBalanceError 
} from '../core/AppError';

export interface CustomerCreditAwarePaymentRequest {
  customerId: number;
  customerName: string;
  invoiceIds: number[];
  requestedPaymentAmount: number;
  paymentMethod?: string; // Make optional for credit-only payments
  cashRegisterId?: number; // Make optional for credit-only payments
  bankAccountId?: number; // For bank payments
  registrationDate: string;
  description: string;
  useExistingCredit?: boolean;
}

export interface CustomerCreditAwarePaymentResult {
  success: boolean;
  creditUsed: number;
  cashPaymentMade: number;
  totalPaymentProcessed: number;
  remainingInvoiceBalance: number;
  newCreditCreated?: number;
  cashRegisterEntry?: any;
  message: string;
}

/**
 * Validation Schema for Customer Credit Payment - Fixed
 */
const CUSTOMER_CREDIT_PAYMENT_SCHEMA: ValidationSchema<CustomerCreditAwarePaymentRequest> = {
  rules: [
    { 
      field: 'customerId', 
      validator: CommonValidators.isInteger().validator, 
      message: 'Valid customer ID is required', 
      required: true 
    },
    { 
      field: 'customerName', 
      validator: CommonValidators.minLength(2).validator, 
      message: 'Customer name must be at least 2 characters', 
      required: true 
    },
    { 
      field: 'requestedPaymentAmount', 
      validator: CommonValidators.isPositive().validator, 
      message: 'Payment amount must be greater than 0', 
      required: true 
    },
    // Make paymentMethod optional for credit-only payments
    { 
      field: 'registrationDate', 
      validator: CommonValidators.isDate().validator, 
      message: 'Valid registration date is required', 
      required: true 
    }
  ],
  customValidators: [
    (data: CustomerCreditAwarePaymentRequest) => {
      // Invoice IDs validation
      if (!data.invoiceIds || !Array.isArray(data.invoiceIds) || data.invoiceIds.length === 0) {
        throw new ValidationError('At least one invoice ID is required');
      }
      
      if (data.invoiceIds.length > 50) {
        throw new ValidationError('Cannot process more than 50 invoices at once');
      }
      
      // Validate each invoice ID
      data.invoiceIds.forEach((id, index) => {
        if (!Number.isInteger(id) || id <= 0) {
          throw new ValidationError(`Invoice ID at position ${index + 1} must be a positive integer`);
        }
      });
      
      // Payment amount validation
      if (data.requestedPaymentAmount > 1000000) {
        throw new ValidationError('Payment amount cannot exceed ₹1,000,000');
      }
      
      // Description validation
      if (data.description && data.description.length > 500) {
        throw new ValidationError('Description cannot exceed 500 characters');
      }
    }
  ]
};

/**
 * Customer Credit-Aware Payment Service Class
 * 
 * Features:
 * - Enterprise-grade validation using ValidationFramework
 * - Comprehensive error handling with AppError hierarchy
 * - Transaction management with rollback protection
 * - Zero-breaking-points financial operations
 * - Optimal credit balance utilization
 */
class CustomerCreditAwarePaymentService extends BaseService {
  
  /**
   * Process customer credit-aware payment with exact scenario logic
   * Implements FULL AMOUNT recording when payment type is needed
   */
  async processCustomerCreditAwarePayment(
    request: CustomerCreditAwarePaymentRequest
  ): Promise<CustomerCreditAwarePaymentResult> {
    return this.executeWithTransaction(async (transaction) => {
      
      // Step 1: Validation
      this.validatePaymentRequest(request);
      
      // Step 2: Get invoice and credit data
      const invoices = await this.validateAndFetchInvoices(request.invoiceIds, transaction);
      const totalInvoiceBalance = this.calculateTotalInvoiceBalance(invoices);
      
      // Step 3: Get available credit
      const availableCredits = await creditBalanceService.getCreditBalancesByEntity(
        'CLIENT',
        request.customerId
      );
      
      // Filter for active credits with available amounts
      const activeCredits = availableCredits.filter(credit => 
        credit.status === 'ACTIVE' && 
        credit.availableAmount && 
        parseFloat(credit.availableAmount.toString()) > 0
      );
      
      const availableCredit = activeCredits.reduce((sum, credit) => 
        sum + parseFloat(credit.availableAmount.toString()), 0
      );
      
      // Step 4: Implement exact scenario logic from user table
      let creditUsed = 0;
      let cashPaymentNeeded = 0;
      let newCreditCreated = 0;
      let recordInCashRegister = false;
      let paymentTypeRequired = false;
      
      if (availableCredit >= totalInvoiceBalance) {
        // Scenarios 2️⃣, 4️⃣, 6️⃣ - Credit covers invoice fully
        
        if (request.requestedPaymentAmount > totalInvoiceBalance) {
          // Scenario 5️⃣ - Block unnecessary overpayment
          throw new BusinessLogicError(
            `You have sufficient credit (₹${availableCredit}) to pay invoice (₹${totalInvoiceBalance}). No need to pay extra.`
          );
        }
        
        // Process credit-only payment - NO RECORDING
        creditUsed = totalInvoiceBalance;
        cashPaymentNeeded = 0;
        recordInCashRegister = false;
        paymentTypeRequired = false;
        
      } else {
        // Scenarios 1️⃣, 3️⃣, 7️⃣, 8️⃣, 🔟 - Credit < Invoice, payment type needed
        
        if (request.requestedPaymentAmount < totalInvoiceBalance) {
          // Scenario 9️⃣ - Insufficient amount
          throw new BusinessLogicError(
            `Amount ₹${request.requestedPaymentAmount} < Invoice ₹${totalInvoiceBalance}. Please enter full invoice amount or more.`
          );
        }
        
        // Use available credit silently
        creditUsed = availableCredit;
        
        // CRITICAL: Record FULL AMOUNT in cash/bank register
        cashPaymentNeeded = request.requestedPaymentAmount;
        recordInCashRegister = true;
        paymentTypeRequired = true;
        
        // Calculate new credit from overpayment
        const remainingInvoiceAfterCredit = totalInvoiceBalance - creditUsed;
        if (request.requestedPaymentAmount > remainingInvoiceAfterCredit) {
          newCreditCreated = request.requestedPaymentAmount - remainingInvoiceAfterCredit;
        }
      }
      
      // Step 5: Apply credit if needed
      if (creditUsed > 0) {
        // Get active credits for application
        const availableCredits = await creditBalanceService.getCreditBalancesByEntity(
          'CLIENT',
          request.customerId
        );
        
        const activeCredits = availableCredits.filter(credit => 
          credit.status === 'ACTIVE' && 
          credit.availableAmount && 
          parseFloat(credit.availableAmount.toString()) > 0
        );
        
        await creditBalanceService.creditBalanceService.applyCreditToInvoices({
          entityType: 'CLIENT',
          entityId: request.customerId,
          invoicesToUpdate: invoices,
          maxCreditToUse: creditUsed
        });
      }
      
      // Step 6: Process cash payment if needed
      let cashRegisterEntry = null;
      if (recordInCashRegister && cashPaymentNeeded > 0) {
        // Validate payment method for cash register recording
        if (!request.paymentMethod) {
          throw new ValidationError('Payment method is required for cash payments');
        }
        
        if (!request.cashRegisterId) {
          throw new ValidationError('Cash register selection is required for cash payments');
        }
        
        cashRegisterEntry = await this.processCashPayment(
          request,
          cashPaymentNeeded, // FULL AMOUNT
          transaction
        );
      }
      
      // Step 7: Create new credit if overpayment
      if (newCreditCreated > 0) {
        await this.handleOverpayment(
          request,
          invoices[0],
          newCreditCreated,
          transaction
        );
      }
      
      // Step 8: Return results
      return await this.calculateFinalResults(
        request.invoiceIds,
        creditUsed,
        recordInCashRegister ? cashPaymentNeeded : 0, // Show actual cash recorded
        newCreditCreated,
        cashRegisterEntry,
        transaction
      );
    });
  }
  
  /**
   * Get customer payment preview with exact scenario logic
   */
  async getCustomerPaymentPreview(
    customerId: number,
    invoiceIds: number[],
    requestedAmount: number,
    useExistingCredit: boolean = true
  ): Promise<{
    totalInvoiceBalance: number;
    availableCredit: number;
    creditWillBeUsed: number;
    cashPaymentNeeded: number;
    willCreateNewCredit: boolean;
    newCreditAmount: number;
    paymentTypeRequired: boolean;
    recordInCashRegister: boolean;
    errorMessage?: string;
  }> {
    return this.executeWithRetry(async () => {
      
      // Validation
      this.validateNumeric(customerId, 'Customer ID', { min: 1 });
      this.validateNumeric(requestedAmount, 'Requested amount', { min: 0.01 });
      
      if (!invoiceIds || invoiceIds.length === 0) {
        throw new ValidationError('At least one invoice ID is required for preview');
      }
      
      // Get invoice balances
      const invoices = await AccountsReceivable.findAll({
        where: { id: invoiceIds }
      });
      
      if (invoices.length === 0) {
        throw new NotFoundError('No invoices found for the provided IDs');
      }
      
      const totalInvoiceBalance = this.calculateTotalInvoiceBalance(invoices);
      
      // Get available credit
      let availableCredit = 0;
      if (useExistingCredit) {
        const availableCredits = await creditBalanceService.getCreditBalancesByEntity(
          'CLIENT',
          customerId
        );
        
        // Filter for active credits with available amounts
        const activeCredits = availableCredits.filter(credit => 
          credit.status === 'ACTIVE' && 
          credit.availableAmount && 
          parseFloat(credit.availableAmount.toString()) > 0
        );
        
        availableCredit = activeCredits.reduce((sum, credit) => 
          sum + parseFloat(credit.availableAmount.toString()), 0
        );
      }
      
      // Implement exact scenario logic from user table
      let creditWillBeUsed = 0;
      let cashPaymentNeeded = 0;
      let willCreateNewCredit = false;
      let newCreditAmount = 0;
      let paymentTypeRequired = false;
      let recordInCashRegister = false;
      let errorMessage = undefined;
      
      if (availableCredit >= totalInvoiceBalance) {
        // Scenarios 2️⃣, 4️⃣, 6️⃣ - Credit covers invoice fully
        
        if (requestedAmount > totalInvoiceBalance) {
          // Scenario 5️⃣ - Block unnecessary overpayment
          errorMessage = `You have sufficient credit (₹${availableCredit}) to pay invoice (₹${totalInvoiceBalance}). No need to pay extra.`;
        } else {
          // Credit-only payment - NO RECORDING
          creditWillBeUsed = totalInvoiceBalance;
          cashPaymentNeeded = 0;
          paymentTypeRequired = false;
          recordInCashRegister = false;
        }
        
      } else {
        // Scenarios 1️⃣, 3️⃣, 7️⃣, 8️⃣, 🔟 - Credit < Invoice, payment type needed
        
        if (requestedAmount < totalInvoiceBalance) {
          // Scenario 9️⃣ - Insufficient amount
          errorMessage = `Amount ₹${requestedAmount} < Invoice ₹${totalInvoiceBalance}. Please enter full invoice amount or more.`;
        } else {
          // Payment type required - FULL AMOUNT RECORDED
          creditWillBeUsed = availableCredit; // Used silently
          cashPaymentNeeded = requestedAmount; // FULL AMOUNT recorded
          paymentTypeRequired = true;
          recordInCashRegister = true;
          
          // Calculate new credit from overpayment
          const remainingInvoiceAfterCredit = totalInvoiceBalance - creditWillBeUsed;
          if (requestedAmount > remainingInvoiceAfterCredit) {
            willCreateNewCredit = true;
            newCreditAmount = requestedAmount - remainingInvoiceAfterCredit;
          }
        }
      }
      
      return {
        totalInvoiceBalance,
        availableCredit,
        creditWillBeUsed,
        cashPaymentNeeded,
        willCreateNewCredit,
        newCreditAmount,
        paymentTypeRequired,
        recordInCashRegister,
        errorMessage
      };
    });
  }
  
  // ==================== PRIVATE VALIDATION METHODS ====================
  
  /**
   * Validate payment request using ValidationFramework
   */
  private validatePaymentRequest(request: CustomerCreditAwarePaymentRequest): void {
    try {
      ValidationFramework.validate(request, CUSTOMER_CREDIT_PAYMENT_SCHEMA);
    } catch (error: any) {
      throw new ValidationError(`Payment request validation failed: ${error.message}`);
    }
  }
  
  /**
   * Validate and fetch invoices with business rule checks
   */
  private async validateAndFetchInvoices(
    invoiceIds: number[], 
    transaction: any
  ): Promise<any[]> {
    const invoices = await AccountsReceivable.findAll({
      where: { id: invoiceIds },
      transaction
    });
    
    if (invoices.length === 0) {
      throw new NotFoundError('No invoices found for the provided IDs');
    }
    
    if (invoices.length !== invoiceIds.length) {
      const foundIds = invoices.map(inv => inv.id);
      const missingIds = invoiceIds.filter(id => !foundIds.includes(id));
      throw new NotFoundError(`Invoices not found: ${missingIds.join(', ')}`);
    }
    
    // Validate invoice business rules
    for (const invoice of invoices) {
      if (invoice.status === 'Received') {
        throw new BusinessLogicError(
          `Invoice ${invoice.registrationNumber} is already fully paid`
        );
      }
      
      if (parseFloat(invoice.balanceAmount.toString()) <= 0) {
        throw new BusinessLogicError(
          `Invoice ${invoice.registrationNumber} has no outstanding balance`
        );
      }
    }
    
    return invoices;
  }
  
  /**
   * Calculate total invoice balance with precision handling
   */
  private calculateTotalInvoiceBalance(invoices: any[]): number {
    const total = invoices.reduce((sum, invoice) => 
      sum + parseFloat(invoice.balanceAmount.toString()), 0
    );
    
    return this.roundCurrency(total);
  }
  
  /**
   * Apply existing credit balances with comprehensive error handling
   */
  private async applyExistingCreditBalances(
    customerId: number,
    invoices: any[],
    totalInvoiceBalance: number,
    transaction: any
  ): Promise<{ creditUsed: number }> {
    try {
      const availableCredits = await creditBalanceService.getCreditBalancesByEntity(
        'CLIENT',
        customerId
      );
      
      // Filter for active credits with available amounts
      const activeCredits = availableCredits.filter(credit => 
        credit.status === 'ACTIVE' && 
        credit.availableAmount && 
        parseFloat(credit.availableAmount.toString()) > 0
      );
      
      const totalAvailableCredit = activeCredits.reduce((sum, credit) => 
        sum + parseFloat(credit.availableAmount.toString()), 0
      );
      
      if (totalAvailableCredit <= 0) {
        return { creditUsed: 0 };
      }
      
      const creditToUse = Math.min(totalAvailableCredit, totalInvoiceBalance);
      
      if (creditToUse > 0) {
        const creditApplication = await creditBalanceService.creditBalanceService.applyCreditToInvoices({
          entityType: 'CLIENT',
          entityId: customerId,
          invoicesToUpdate: invoices,
          maxCreditToUse: creditToUse
        });
        
        return { creditUsed: creditApplication.totalCreditUsed };
      }
      
      return { creditUsed: 0 };
      
    } catch (error: any) {
      throw new BusinessLogicError(`Credit application failed: ${error.message}`);
    }
  }
  
  /**
   * Handle overpayment with credit balance creation
   */
  private async handleOverpayment(
    request: CustomerCreditAwarePaymentRequest,
    firstInvoice: any,
    overpaymentAmount: number,
    transaction: any
  ): Promise<number> {
    try {
      const creditData = {
        type: 'CUSTOMER_CREDIT' as const,
        relatedEntityType: 'CLIENT' as const,
        relatedEntityId: request.customerId,
        relatedEntityName: request.customerName,
        creditAmount: overpaymentAmount,
        originalTransactionType: 'AR' as const,
        originalTransactionId: firstInvoice.id,
        originalTransactionNumber: firstInvoice.registrationNumber,
        description: `Overpayment credit from payment ${request.description}`,
        registrationDate: request.registrationDate
      };
      
      await creditBalanceService.creditBalanceService.createCreditBalance(creditData);
      return overpaymentAmount;
      
    } catch (error: any) {
      throw new BusinessLogicError(`Overpayment handling failed: ${error.message}`);
    }
  }
  /**
   * Process cash payment with validation - implements smart payment flow
   * Routes to Cash Register Master OR Bank Register based on payment method
   */
  private async processCashPayment(
    request: CustomerCreditAwarePaymentRequest,
    cashPaymentAmount: number,
    transaction: any
  ): Promise<any> {
    try {
      // Skip processing if no actual cash payment needed
      if (cashPaymentAmount <= 0) {
        return null;
      }

      // For credit-only payments, no register entry needed
      if (!request.paymentMethod || request.paymentMethod === 'CREDIT_BALANCE') {
        return null;
      }

      // Validate payment method for register recording
      if (!request.paymentMethod) {
        throw new ValidationError('Payment method is required for cash/bank payments');
      }

      // Route based on payment method
      const cashMethods = ['CASH'];
      const bankMethods = ['UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'DEBIT_CARD', 'CREDIT_CARD'];
      
      if (cashMethods.includes(request.paymentMethod)) {
        // Route to Cash Register Master
        return await this.processCashRegisterPayment(request, cashPaymentAmount, transaction);
      } else if (bankMethods.includes(request.paymentMethod)) {
        // Route to Bank Register
        return await this.processBankRegisterPayment(request, cashPaymentAmount, transaction);
      } else {
        throw new ValidationError(`Unsupported payment method: ${request.paymentMethod}`);
      }
      
    } catch (error: any) {
      throw new BusinessLogicError(`Payment processing failed: ${error.message}`);
    }
  }

  /**
   * Process payment through Cash Register Master
   */
  private async processCashRegisterPayment(
    request: CustomerCreditAwarePaymentRequest,
    amount: number,
    transaction: any
  ): Promise<any> {
    if (!request.cashRegisterId) {
      throw new ValidationError('Cash register selection is required for cash payments');
    }

    const cashPaymentData = {
      registrationDate: request.registrationDate,
      transactionType: 'INFLOW' as const,
      amount: amount, // FULL AMOUNT recorded as per business logic
      paymentMethod: request.paymentMethod,
      relatedDocumentType: 'AR_COLLECTION' as const,
      relatedDocumentNumber: request.invoiceIds.length === 1 ? 
        `INV-${request.invoiceIds[0]}` : 'MULTI',
      description: `${request.description} - Customer Credit Aware Payment: ₹${amount}`,
      customerId: request.customerId,
      customerName: request.customerName,
      clientName: request.customerName, // Add clientName for cash register
      cashRegisterId: request.cashRegisterId,
      invoiceIds: JSON.stringify(request.invoiceIds)
    };
    
    // This will update the Cash Register Master balance
    return await cashRegisterService.createCashTransaction(cashPaymentData, transaction);
  }

  /**
   * Process payment through Bank Register
   */
  private async processBankRegisterPayment(
    request: CustomerCreditAwarePaymentRequest,
    amount: number,
    transaction: any
  ): Promise<any> {
    // Import bank register service
    const bankRegisterService = require('./bankRegisterService');
    
    const bankPaymentData = {
      registrationDate: request.registrationDate,
      transactionType: 'INFLOW' as const,
      amount: amount, // FULL AMOUNT recorded as per business logic
      paymentMethod: request.paymentMethod,
      relatedDocumentType: 'AR_COLLECTION' as const,
      relatedDocumentNumber: request.invoiceIds.length === 1 ? 
        `INV-${request.invoiceIds[0]}` : 'MULTI',
      description: `${request.description} - Customer Credit Aware Payment: ₹${amount}`,
      customerId: request.customerId,
      customerName: request.customerName,
      bankAccountId: request.bankAccountId || 1, // Use provided bank account
      invoiceIds: JSON.stringify(request.invoiceIds)
    };
    
    // Create bank register entry
    return await bankRegisterService.createBankTransaction(bankPaymentData, transaction);
  }

  /**
   * Determine if payment method requires cash register entry
   */
  private paymentMethodRequiresCashRegister(paymentMethod: string): boolean {
    const cashRegisterMethods = [
      'CASH',
      'UPI', 
      'BANK_TRANSFER',
      'CHEQUE',
      'CARD',
      'DEBIT_CARD',
      'CREDIT_CARD'
    ];
    
    const creditOnlyMethods = [
      'CREDIT_BALANCE',
      'EXISTING_CREDIT'
    ];
    
    // Credit methods don't require cash register
    if (creditOnlyMethods.includes(paymentMethod)) {
      return false;
    }
    
    // All other methods require cash register
    return cashRegisterMethods.includes(paymentMethod) || true;
  }
  
  /**
   * Calculate final results with validation
   */
  private async calculateFinalResults(
    invoiceIds: number[],
    creditUsed: number,
    cashPaymentMade: number,
    newCreditCreated: number,
    cashRegisterEntry: any,
    transaction: any
  ): Promise<CustomerCreditAwarePaymentResult> {
    // Get updated invoice balances
    const updatedInvoices = await AccountsReceivable.findAll({
      where: { id: invoiceIds },
      transaction
    });
    
    const finalInvoiceBalance = updatedInvoices.reduce((sum, invoice) => {
      return sum + parseFloat(invoice.balanceAmount.toString());
    }, 0);
    
    const totalPaymentProcessed = creditUsed + cashPaymentMade;
    
    // Validation: Ensure financial integrity
    if (totalPaymentProcessed < 0) {
      throw new BusinessLogicError('Invalid payment calculation: negative total payment');
    }
    
    if (finalInvoiceBalance < 0) {
      throw new BusinessLogicError('Invalid balance calculation: negative invoice balance');
    }
    
    return {
      success: true,
      creditUsed: this.roundCurrency(creditUsed),
      cashPaymentMade: this.roundCurrency(cashPaymentMade),
      totalPaymentProcessed: this.roundCurrency(totalPaymentProcessed),
      remainingInvoiceBalance: this.roundCurrency(finalInvoiceBalance),
      newCreditCreated: newCreditCreated > 0 ? this.roundCurrency(newCreditCreated) : undefined,
      cashRegisterEntry,
      message: this.generatePaymentMessage(creditUsed, cashPaymentMade, newCreditCreated)
    };
  }
  
  /**
   * Generate payment success message
   */
  private generatePaymentMessage(
    creditUsed: number, 
    cashPaymentMade: number, 
    newCreditCreated: number
  ): string {
    if (newCreditCreated > 0 && creditUsed > 0) {
      return `Payment processed: ₹${this.roundCurrency(creditUsed)} from existing credit + ₹${this.roundCurrency(cashPaymentMade)} from cash. ₹${this.roundCurrency(newCreditCreated)} overpayment created as new credit.`;
    } else if (newCreditCreated > 0) {
      return `Payment processed: ₹${this.roundCurrency(cashPaymentMade)} from cash. ₹${this.roundCurrency(newCreditCreated)} overpayment created as new credit.`;
    } else if (creditUsed > 0) {
      return `Payment processed: ₹${this.roundCurrency(creditUsed)} from existing credit + ₹${this.roundCurrency(cashPaymentMade)} from cash. Optimal cash flow achieved!`;
    } else {
      return `Payment processed: ₹${this.roundCurrency(cashPaymentMade)} from cash.`;
    }
  }
}

// Export singleton instance
export const customerCreditAwarePaymentService = new CustomerCreditAwarePaymentService();

// Export individual methods for backward compatibility
export const processCustomerCreditAwarePayment = (request: CustomerCreditAwarePaymentRequest) => 
  customerCreditAwarePaymentService.processCustomerCreditAwarePayment(request);

export const getCustomerPaymentPreview = (
  customerId: number,
  invoiceIds: number[],
  requestedAmount: number,
  useExistingCredit: boolean = true
) => customerCreditAwarePaymentService.getCustomerPaymentPreview(
  customerId, 
  invoiceIds, 
  requestedAmount, 
  useExistingCredit
);

export default customerCreditAwarePaymentService;