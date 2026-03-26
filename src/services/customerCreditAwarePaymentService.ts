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
  // New fields for frontend logic
  paymentTypeRequired?: boolean;
  recordInCashRegister?: boolean;
  availableCredit?: number;
  totalInvoiceBalance?: number;
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
      
      console.log(`💰 Payment Analysis: Invoice=₹${totalInvoiceBalance}, Credit=₹${availableCredit}, Requested=₹${request.requestedPaymentAmount}`);
      
      // Step 4: Implement EXACT scenario logic from user table
      let creditUsed = 0;
      let cashPaymentNeeded = 0;
      let newCreditCreated = 0;
      let recordInCashRegister = false;
      let paymentTypeRequired = false;
      
      if (availableCredit >= totalInvoiceBalance) {
        // 🎯 Credit covers invoice fully - but still show payment type dropdown
        console.log(`✅ Scenario: Credit covers invoice (Credit ≥ Invoice)`);
        
        if (request.requestedPaymentAmount > totalInvoiceBalance) {
          // 🚫 Block unnecessary overpayment
          throw new BusinessLogicError(
            `🚫 OVERPAYMENT BLOCKED: You have sufficient credit (₹${availableCredit.toFixed(2)}) to pay invoice (₹${totalInvoiceBalance.toFixed(2)}). No need to pay extra.`
          );
        }
        
        // NEW PLAN: Always require payment type, record full invoice amount
        creditUsed = totalInvoiceBalance;
        cashPaymentNeeded = totalInvoiceBalance; // Record FULL invoice amount
        recordInCashRegister = true;
        paymentTypeRequired = true;
        
        console.log(`💳 Credit-only payment: Using ₹${creditUsed} from credit, recording ₹${cashPaymentNeeded} in selected register`);
        
      } else {
        // 🎯 Scenarios 1️⃣, 3️⃣, 7️⃣, 8️⃣, 🔟 - Credit < Invoice, payment type needed
        console.log(`✅ Scenario: Credit insufficient (Credit < Invoice), payment type required`);
        
        if (request.requestedPaymentAmount < totalInvoiceBalance) {
          // 🚫 Scenario 9️⃣ - Insufficient amount
          throw new BusinessLogicError(
            `❌ INSUFFICIENT AMOUNT: Amount ₹${request.requestedPaymentAmount.toFixed(2)} < Invoice ₹${totalInvoiceBalance.toFixed(2)}. Please enter full invoice amount or more.`
          );
        }
        
        // Use available credit silently
        creditUsed = availableCredit;
        
        // 🔥 CORRECTED: Record FULL invoice amount in selected payment method
        // This represents the complete settlement regardless of credit/cash mix
        const totalInvoiceAmount = totalInvoiceBalance; // Full invoice amount
        cashPaymentNeeded = totalInvoiceAmount; // Record full amount in register
        recordInCashRegister = true;
        paymentTypeRequired = true;
        
        // 🔥 FIX: Calculate new credit correctly - only if user pays MORE than invoice amount
        if (request.requestedPaymentAmount > totalInvoiceBalance) {
          // True overpayment: user pays more than invoice amount
          newCreditCreated = request.requestedPaymentAmount - totalInvoiceBalance;
        } else {
          // No overpayment: user pays exactly invoice amount or less
          newCreditCreated = 0;
        }
        
        console.log(`💰 Mixed payment: Credit=₹${creditUsed}, Cash=₹${cashPaymentNeeded}, NewCredit=₹${newCreditCreated}`);
      }
      
      // Step 5: Apply credit if needed
      if (creditUsed > 0) {
        console.log(`🔄 Applying ₹${creditUsed} from existing credit balances...`);
        
        const creditApplication = await creditBalanceService.creditBalanceService.applyCreditToInvoices({
          entityType: 'CLIENT',
          entityId: request.customerId,
          invoicesToUpdate: invoices,
          maxCreditToUse: creditUsed
        });
        
        console.log(`✅ Applied ₹${creditUsed} from credit balances to invoices`);
      }
      
      // Step 6: Process payment if needed
      let paymentEntry = null;
      if (recordInCashRegister && cashPaymentNeeded > 0) {
        console.log(`💸 Processing payment of ₹${cashPaymentNeeded}...`);
        
        // Validate payment method
        if (!request.paymentMethod) {
          throw new ValidationError('Payment method is required for payments');
        }
        
        // Route to appropriate payment processor based on payment method
        if (this.paymentMethodRequiresCashRegister(request.paymentMethod)) {
          // Cash register methods (CASH, UPI, CHEQUE, CARD, etc.)
          if (!request.cashRegisterId) {
            throw new ValidationError('Cash register selection is required for cash payments');
          }
          
          paymentEntry = await this.processCashPayment(
            request,
            cashPaymentNeeded,
            transaction
          );
          
          console.log(`✅ Cash register entry created: ${paymentEntry.registrationNumber}`);
          
        } else if (['BANK_TRANSFER', 'DEPOSIT', 'WIRE_TRANSFER'].includes(request.paymentMethod)) {
          // Bank register methods
          if (!request.bankAccountId) {
            throw new ValidationError('Bank account selection is required for bank transfer payments');
          }
          
          paymentEntry = await this.processBankRegisterPayment(
            request,
            cashPaymentNeeded,
            transaction
          );
          
          console.log(`✅ Bank register entry created: ${paymentEntry.registrationNumber}`);
          
        } else {
          throw new ValidationError(`Unsupported payment method: ${request.paymentMethod}`);
        }
      }
      
      // Step 7: Create new credit if overpayment
      if (newCreditCreated > 0) {
        console.log(`💳 Creating new credit balance of ₹${newCreditCreated}...`);
        
        await this.handleOverpayment(
          request,
          invoices[0],
          newCreditCreated,
          transaction
        );
        
        console.log(`✅ New credit balance created: ₹${newCreditCreated}`);
      }
      
      // Step 8: Return results with proper flags
      const result = await this.calculateFinalResults(
        request.invoiceIds,
        creditUsed,
        recordInCashRegister ? cashPaymentNeeded : 0, // Show full amount recorded in register
        newCreditCreated,
        paymentEntry, // Use generic paymentEntry instead of cashRegisterEntry
        transaction
      );
      
      // Add scenario-specific flags for frontend
      result.paymentTypeRequired = paymentTypeRequired;
      result.recordInCashRegister = recordInCashRegister;
      result.availableCredit = availableCredit;
      result.totalInvoiceBalance = totalInvoiceBalance;
      
      console.log(`🎉 Payment completed successfully:`, {
        creditUsed,
        cashFromCustomer: recordInCashRegister ? cashPaymentNeeded : 0,
        newCreditCreated,
        paymentTypeRequired,
        recordInCashRegister
      });
      
      return result;
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
          // Credit-only payment - Record FULL invoice amount in selected register
          creditWillBeUsed = totalInvoiceBalance;
          cashPaymentNeeded = totalInvoiceBalance; // FULL invoice amount
          paymentTypeRequired = true;
          recordInCashRegister = true;
        }
        
      } else {
        // Scenarios 1️⃣, 3️⃣, 7️⃣, 8️⃣, 🔟 - Credit < Invoice, payment type needed
        
        if (requestedAmount < totalInvoiceBalance) {
          // Scenario 9️⃣ - Insufficient amount
          errorMessage = `Amount ₹${requestedAmount} < Invoice ₹${totalInvoiceBalance}. Please enter full invoice amount or more.`;
        } else {
          // Payment type required - Record FULL invoice amount in selected method
          creditWillBeUsed = availableCredit; // Used silently
          cashPaymentNeeded = totalInvoiceBalance; // FULL invoice amount recorded
          paymentTypeRequired = true;
          recordInCashRegister = true;
          
          // 🔥 FIX: Calculate new credit correctly - only if user pays MORE than invoice amount
          if (requestedAmount > totalInvoiceBalance) {
            // True overpayment: user pays more than invoice amount
            willCreateNewCredit = true;
            newCreditAmount = requestedAmount - totalInvoiceBalance;
          } else {
            // No overpayment: user pays exactly invoice amount or less
            willCreateNewCredit = false;
            newCreditAmount = 0;
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
      registrationDate: new Date(request.registrationDate), // Convert string to Date
      transactionType: 'INFLOW' as const,
      amount: amount, // FULL INVOICE AMOUNT (includes credit usage)
      paymentMethod: request.paymentMethod!,  // Use non-null assertion since we validate it exists
      relatedDocumentType: 'AR_COLLECTION' as const,
      relatedDocumentNumber: request.invoiceIds.length === 1 ? 
        `INV-${request.invoiceIds[0]}` : 'MULTI',
      description: `${request.description} - Total Settlement: ₹${amount} (includes credit usage)`,
      customerId: request.customerId,
      customerName: request.customerName,
      clientName: request.customerName, // Add clientName for cash register
      cashRegisterId: request.cashRegisterId,
      invoiceIds: JSON.stringify(request.invoiceIds),
      // 🔥 CRITICAL: Flag to prevent duplicate credit balance creation
      skipCreditBalanceCreation: true
    };
    
    // Use the class method instead of legacy function to avoid duplicate credit balance creation
    return await cashRegisterService.cashRegisterService.createCashTransaction(cashPaymentData, transaction);
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
    const bankRegisterService = require('./bankRegisterService').default;
    
    const bankPaymentData = {
      registrationDate: request.registrationDate,
      transactionType: 'INFLOW' as const,
      sourceTransactionType: 'AR_COLLECTION' as const,
      amount: amount, // FULL INVOICE AMOUNT (includes credit usage)
      paymentMethod: request.paymentMethod,
      relatedDocumentType: 'AR_COLLECTION' as const,
      relatedDocumentNumber: request.invoiceIds.length === 1 ? 
        `INV-${request.invoiceIds[0]}` : 'MULTI',
      description: `${request.description} - Total Settlement: ₹${amount} (includes credit usage)`,
      clientName: request.customerName || 'Unknown Customer',
      clientRnc: '', // Add if available in request
      bankAccountId: request.bankAccountId,
      invoiceIds: JSON.stringify(request.invoiceIds),
      originalPaymentType: request.paymentMethod
    };
    
    // Create bank register entry using the correct method
    return await bankRegisterService.createBankRegister(bankPaymentData, transaction);
  }

  /**
   * Determine if payment method requires cash register entry
   */
  private paymentMethodRequiresCashRegister(paymentMethod: string): boolean {
    const cashRegisterMethods = [
      'CASH',
      'UPI', 
      'CHEQUE',
      'CARD',
      'DEBIT_CARD',
      'CREDIT_CARD'
    ];
    
    const bankRegisterMethods = [
      'BANK_TRANSFER',
      'DEPOSIT',
      'WIRE_TRANSFER'
    ];
    
    const creditOnlyMethods = [
      'CREDIT_BALANCE',
      'EXISTING_CREDIT'
    ];
    
    // Credit methods don't require cash register
    if (creditOnlyMethods.includes(paymentMethod)) {
      return false;
    }
    
    // Bank register methods don't require cash register
    if (bankRegisterMethods.includes(paymentMethod)) {
      return false;
    }
    
    // Only cash register methods require cash register
    return cashRegisterMethods.includes(paymentMethod);
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