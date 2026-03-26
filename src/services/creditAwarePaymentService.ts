import { Transaction } from 'sequelize';
import { BaseService } from '../core/BaseService';
import { ValidationError, NotFoundError, InsufficientBalanceError, BusinessLogicError } from '../core/AppError';
import { TransactionType } from '../types/TransactionType';
import sequelize from '../config/database';
import { creditBalanceService } from './creditBalanceService';
import bankRegisterService from './bankRegisterService';

export interface CreditAwarePaymentRequest {
  supplierId: number;
  supplierName: string;
  invoiceIds: number[];
  requestedPaymentAmount: number;
  paymentMethod: string;
  bankAccountId: number;
  registrationDate: string;
  description: string;
}

export interface CreditAwarePaymentResult {
  success: boolean;
  creditUsed: number;
  bankPaymentMade: number;
  totalPaymentProcessed: number;
  remainingInvoiceBalance: number;
  newCreditCreated?: number;
  bankRegisterEntry?: any;
  message: string;
}

export class CreditAwarePaymentService extends BaseService {

  async processCreditAwarePayment(
    request: CreditAwarePaymentRequest
  ): Promise<CreditAwarePaymentResult> {
    console.log('🎯 Starting SMART credit-aware payment processing...');
    console.log('📋 Request:', JSON.stringify(request, null, 2));
    
    // Validate request
    this.validatePaymentRequest(request);

    try {
      const AccountsPayable = (await import('../models/AccountsPayable')).default;

      // Step 1: Get available credit balances for supplier
      const availableCredits = await creditBalanceService.getCreditBalancesByEntity(
        'SUPPLIER',
        request.supplierId
      );

      const totalAvailableCredit = availableCredits.reduce((sum: number, credit: any) => 
        sum + parseFloat(credit.availableAmount.toString()), 0
      );

      console.log(`💳 Available credit for supplier: ₹${totalAvailableCredit}`);

      // Step 2: Get invoice details
      const invoices = await AccountsPayable.findAll({
        where: { id: request.invoiceIds }
      });

      const totalInvoiceBalance = invoices.reduce((sum: number, invoice: any) => 
        sum + parseFloat(invoice.balanceAmount.toString()), 0
      );

      console.log(`📄 Total invoice balance: ₹${totalInvoiceBalance}`);

      // Step 3: 🚫 SMART OVERPAYMENT PREVENTION
      if (request.requestedPaymentAmount > totalInvoiceBalance && totalAvailableCredit > 0) {
        const overpaymentAmount = request.requestedPaymentAmount - totalInvoiceBalance;
        throw new ValidationError(
          `🚫 OVERPAYMENT BLOCKED: Credit balance exists (₹${totalAvailableCredit.toFixed(2)}). ` +
          `Please pay only the invoice amount: ₹${totalInvoiceBalance.toFixed(2)}. ` +
          `Overpayment of ₹${overpaymentAmount.toFixed(2)} is not allowed when credit balance is available. ` +
          `💡 SMART SUGGESTION: Use the existing credit balance to pay this invoice instead.`
        );
      }

      // Step 4: 💡 SMART PAYMENT CALCULATION (Credit-First Logic)
      const actualPaymentAmount = Math.min(request.requestedPaymentAmount, totalInvoiceBalance);
      const creditToUse = Math.min(totalAvailableCredit, actualPaymentAmount);
      let bankPaymentNeeded = Math.max(0, actualPaymentAmount - creditToUse);

      console.log(`💡 SMART CALCULATION:`);
      console.log(`   Requested: ₹${request.requestedPaymentAmount}`);
      console.log(`   Invoice Balance: ₹${totalInvoiceBalance}`);
      console.log(`   Actual Payment: ₹${actualPaymentAmount}`);
      console.log(`   Credit to use: ₹${creditToUse}`);
      console.log(`   Bank payment needed: ₹${bankPaymentNeeded}`);

      let creditUsed = 0;
      let newCreditCreated = 0;

      // Step 5: Apply credit balances first (if available)
      if (creditToUse > 0) {
        console.log('🔄 Applying existing credit balances...');
        
        const creditTransaction = await sequelize.transaction();
        try {
          const creditApplication = await creditBalanceService.applyCreditToInvoices({
            entityType: 'SUPPLIER',
            entityId: request.supplierId,
            invoicesToUpdate: invoices
          });
          
          creditUsed = Math.min(creditApplication.totalCreditUsed, creditToUse);
          await creditTransaction.commit();
          console.log(`✅ Applied ₹${creditUsed} from credit balances`);
        } catch (error) {
          await creditTransaction.rollback();
          throw error;
        }
      }

      // Step 6: Handle overpayment for zero credit balance case ONLY
      if (request.requestedPaymentAmount > totalInvoiceBalance && totalAvailableCredit === 0) {
        const overpaymentAmount = request.requestedPaymentAmount - totalInvoiceBalance;
        console.log(`💰 Creating credit balance for overpayment: ₹${overpaymentAmount} (no existing credit)`);
        
        const creditData = {
          type: 'SUPPLIER_CREDIT' as const,
          relatedEntityType: 'SUPPLIER' as const,
          relatedEntityId: request.supplierId,
          relatedEntityName: request.supplierName,
          originalTransactionType: 'AP' as const,
          originalTransactionId: invoices[0]?.id || 0,
          originalTransactionNumber: invoices[0]?.registrationNumber || 'MULTI',
          creditAmount: overpaymentAmount,
          notes: `Overpayment credit from payment: ${request.description}`
        };
        
        const creditBalance = await creditBalanceService.createCreditBalance(creditData);
        newCreditCreated = overpaymentAmount;
        console.log(`✅ Created credit balance: ${creditBalance.registrationNumber} for ₹${overpaymentAmount}`);
        
        // 🚨 CRITICAL FIX: Bank should pay the FULL requested amount for overpayment
        bankPaymentNeeded = request.requestedPaymentAmount; // FULL amount, not just invoice amount
        console.log(`🏦 OVERPAYMENT SCENARIO: Bank will pay FULL requested amount: ₹${bankPaymentNeeded}`);
      }

      // Step 7: 🏦 SMART BANK BALANCE VALIDATION (with credit balance info)
      if (bankPaymentNeeded > 0) {
        console.log(`🔍 Validating bank account balance for payment of ₹${bankPaymentNeeded}...`);
        
        const BankAccount = (await import('../models/BankAccount')).default;
        const bankAccount = await BankAccount.findByPk(request.bankAccountId);
        
        if (!bankAccount) {
          throw new Error(`Bank account with ID ${request.bankAccountId} not found`);
        }
        
        const currentBankBalance = parseFloat(bankAccount.balance.toString());
        
        if (currentBankBalance < bankPaymentNeeded) {
          // 💡 SMART ERROR MESSAGE with credit balance info
          const errorMessage = totalAvailableCredit > 0 
            ? `🏦 Insufficient bank balance: Available ₹${currentBankBalance.toFixed(2)}, Required ₹${bankPaymentNeeded.toFixed(2)}. ` +
              `💡 SMART SUGGESTION: You have ₹${totalAvailableCredit.toFixed(2)} credit balance available. ` +
              `Use credit payment instead to avoid bank overdraft.`
            : `🏦 Insufficient bank balance: Available ₹${currentBankBalance.toFixed(2)}, Required ₹${bankPaymentNeeded.toFixed(2)}. ` +
              `Please add funds to your bank account.`;
          
          throw new InsufficientBalanceError(errorMessage);
        }
        
        console.log(`✅ Bank account validation passed. Available: ₹${currentBankBalance}, Required: ₹${bankPaymentNeeded}`);
      }

      // Step 8: Process bank payment (if needed)
      let bankRegisterEntry = null;
      
      if (bankPaymentNeeded > 0) {
        console.log(`💸 Processing bank payment of ₹${bankPaymentNeeded}...`);
        
        const bankPaymentData = {
          registrationDate: new Date(request.registrationDate),
          transactionType: 'OUTFLOW' as const,
          sourceTransactionType: TransactionType.PAYMENT,
          amount: bankPaymentNeeded,
          paymentMethod: request.paymentMethod,
          relatedDocumentType: 'AP',
          relatedDocumentNumber: invoices[0]?.registrationNumber || 'MULTI',
          description: `${request.description} (Smart Payment: ₹${creditUsed} credit + ₹${bankPaymentNeeded} bank)`,
          
          // 🚨 CORRECT FIX: Map supplier info to client fields (for AP context)
          supplierId: request.supplierId,
          clientName: request.supplierName,  // Supplier name → clientName (for AP transactions)
          clientRnc: invoices[0]?.supplierRnc || '',  // Supplier RNC → clientRnc
          ncf: invoices[0]?.ncf || '',  // Add NCF if available
          
          bankAccountId: request.bankAccountId,
          invoiceIds: JSON.stringify(request.invoiceIds),
          allowOverpayment: true
        };
        
        // Use existing bank register service
        bankRegisterEntry = await bankRegisterService.createBankRegister(bankPaymentData);
        console.log(`✅ Bank payment processed: ${bankRegisterEntry.registrationNumber}`);
      }

      // Step 9: 🚨 CRITICAL FIX - Ensure final AP status reflects total payment
      // After both credit and bank payments, manually verify and update AP status
      if (creditUsed > 0 || bankPaymentNeeded > 0) {
        console.log('🔄 Verifying final AP status after combined payments...');
        
        const AccountsPayable = (await import('../models/AccountsPayable')).default;
        
        for (const invoiceId of request.invoiceIds) {
          const apInvoice = await AccountsPayable.findByPk(invoiceId);
          if (apInvoice) {
            const totalInvoiceAmount = parseFloat(apInvoice.amount.toString());
            const totalPaymentMade = creditUsed + bankPaymentNeeded;
            
            // 🚨 CORRECT CALCULATION: Final paid amount should reflect TOTAL payment made
            const finalPaidAmount = Math.min(totalPaymentMade, totalInvoiceAmount);
            const finalBalanceAmount = Math.max(0, totalInvoiceAmount - finalPaidAmount);
            const finalStatus = finalBalanceAmount <= 0.01 ? 'Paid' : 'Partial';
            
            console.log(`🔍 Payment calculation for ${apInvoice.registrationNumber}:`);
            console.log(`   - Invoice Amount: ₹${totalInvoiceAmount}`);
            console.log(`   - Credit Used: ₹${creditUsed}`);
            console.log(`   - Bank Payment: ₹${bankPaymentNeeded}`);
            console.log(`   - Total Payment: ₹${totalPaymentMade}`);
            console.log(`   - Expected Final Paid: ₹${finalPaidAmount}`);
            console.log(`   - Expected Final Balance: ₹${finalBalanceAmount}`);
            console.log(`   - Expected Final Status: ${finalStatus}`);
            
            // Update AP with correct final amounts
            await apInvoice.update({
              paidAmount: finalPaidAmount,
              balanceAmount: finalBalanceAmount,
              status: finalStatus,
              paidDate: finalStatus === 'Paid' ? new Date() : apInvoice.paidDate
            });
            
            console.log(`✅ Final AP status corrected for ${apInvoice.registrationNumber}:`);
            console.log(`   - Total Payment: ₹${totalPaymentMade} (₹${creditUsed} credit + ₹${bankPaymentNeeded} bank)`);
            console.log(`   - Final Status: ${finalStatus}`);
            console.log(`   - Paid Amount: ₹${finalPaidAmount}`);
            console.log(`   - Balance: ₹${finalBalanceAmount}`);
            
            // Also update related Business Expense if needed
            if (apInvoice.relatedDocumentType === 'Business Expense' && apInvoice.relatedDocumentId) {
              const BusinessExpense = (await import('../models/BusinessExpense')).default;
              const businessExpense = await BusinessExpense.findByPk(apInvoice.relatedDocumentId);
              
              if (businessExpense) {
                const beTotalAmount = parseFloat(businessExpense.amount.toString());
                const beExpectedPaidAmount = Math.min(finalPaidAmount, beTotalAmount);
                const beExpectedBalanceAmount = Math.max(0, beTotalAmount - beExpectedPaidAmount);
                const beExpectedStatus = beExpectedBalanceAmount <= 0.01 ? 'Paid' : 'Partial';
                
                await businessExpense.update({
                  paidAmount: beExpectedPaidAmount,
                  balanceAmount: beExpectedBalanceAmount,
                  paymentStatus: beExpectedStatus
                });
                
                console.log(`✅ Final Business Expense status corrected for ${businessExpense.registrationNumber}:`);
                console.log(`   - BE Paid Amount: ₹${beExpectedPaidAmount}`);
                console.log(`   - BE Balance: ₹${beExpectedBalanceAmount}`);
                console.log(`   - BE Status: ${beExpectedStatus}`);
              }
            }
          }
        }
      }

      // Step 10: Calculate final results
      const updatedInvoices = await AccountsPayable.findAll({
        where: { id: request.invoiceIds }
      });

      const finalInvoiceBalance = updatedInvoices.reduce((sum: number, invoice: any) => {
        return sum + parseFloat(invoice.balanceAmount.toString());
      }, 0);

      const result: CreditAwarePaymentResult = {
        success: true,
        creditUsed,
        bankPaymentMade: bankPaymentNeeded,
        totalPaymentProcessed: creditUsed + bankPaymentNeeded,
        remainingInvoiceBalance: finalInvoiceBalance,
        newCreditCreated,
        bankRegisterEntry,
        message: this.generateSmartPaymentMessage(creditUsed, bankPaymentNeeded, newCreditCreated)
      };

      console.log('🎉 SMART credit-aware payment completed successfully:', result);
      return result;
      
    } catch (error) {
      console.error('❌ SMART credit-aware payment failed:', error);
      
      return {
        success: false,
        creditUsed: 0,
        bankPaymentMade: 0,
        totalPaymentProcessed: 0,
        remainingInvoiceBalance: 0,
        message: `Payment failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Generate smart payment success message
   */
  private generateSmartPaymentMessage(creditUsed: number, bankPaymentMade: number, newCreditCreated: number): string {
    if (newCreditCreated > 0) {
      return `✅ Overpayment processed: ₹${bankPaymentMade} from bank account (FULL requested amount). ₹${newCreditCreated} overpayment created as new credit balance.`;
    } else if (creditUsed > 0 && bankPaymentMade > 0) {
      return `✅ Smart Payment processed: ₹${creditUsed} from credit balance + ₹${bankPaymentMade} from bank account. Optimal cash flow achieved!`;
    } else if (creditUsed > 0) {
      return `✅ Payment processed entirely from credit balance: ₹${creditUsed}. No bank payment needed - excellent cash flow management!`;
    } else {
      return `✅ Payment processed from bank account: ₹${bankPaymentMade}. Bank register entry created successfully.`;
    }
  }

  /**
   * Get payment preview (shows how much credit will be used vs bank payment)
   */
  async getPaymentPreview(
    supplierId: number,
    invoiceIds: number[],
    requestedAmount: number,
    bankAccountId?: number
  ): Promise<{
    totalInvoiceBalance: number;
    availableCredit: number;
    creditWillBeUsed: number;
    bankPaymentNeeded: number;
    willCreateNewCredit: boolean;
    newCreditAmount: number;
    overpaymentBlocked?: boolean;
    overpaymentBlockReason?: string;
    smartSuggestion?: string;
    bankBalanceValidation?: {
      hasSufficientBalance: boolean;
      availableBalance: number;
      errorMessage?: string;
    };
  }> {
    // Get available credits
    const availableCredits = await creditBalanceService.getCreditBalancesByEntity(
      'SUPPLIER',
      supplierId
    );
    
    const totalAvailableCredit = availableCredits.reduce((sum: number, credit: any) => 
      sum + parseFloat(credit.availableAmount.toString()), 0
    );
    
    // Get invoice balances
    const AccountsPayable = (await import('../models/AccountsPayable')).default;
    const invoices = await AccountsPayable.findAll({
      where: { id: invoiceIds }
    });
    
    const totalInvoiceBalance = invoices.reduce((sum: number, invoice: any) => 
      sum + parseFloat(invoice.balanceAmount.toString()), 0
    );
    
    // 🚫 SMART OVERPAYMENT PREVENTION CHECK
    const isOverpayment = requestedAmount > totalInvoiceBalance;
    const overpaymentBlocked = isOverpayment && totalAvailableCredit > 0;
    
    let overpaymentBlockReason;
    let smartSuggestion;
    
    if (overpaymentBlocked) {
      const overpaymentAmount = requestedAmount - totalInvoiceBalance;
      overpaymentBlockReason = `Overpayment of ₹${overpaymentAmount.toFixed(2)} blocked because credit balance exists (₹${totalAvailableCredit.toFixed(2)})`;
      smartSuggestion = `Pay only the invoice amount: ₹${totalInvoiceBalance.toFixed(2)}. Use existing credit balance instead of creating more credit.`;
    }
    
    // 💡 SMART PAYMENT CALCULATION (Credit-First Logic)
    let actualPaymentAmount, creditWillBeUsed, bankPaymentNeeded;
    
    if (isOverpayment && totalAvailableCredit === 0) {
      // 🚨 OVERPAYMENT WITH ZERO CREDIT: Bank pays FULL requested amount
      actualPaymentAmount = requestedAmount;
      creditWillBeUsed = 0;
      bankPaymentNeeded = requestedAmount; // FULL amount from bank
      console.log(`💰 OVERPAYMENT SCENARIO (Zero Credit): Bank pays FULL ₹${bankPaymentNeeded}`);
    } else {
      // Normal scenario: Credit-first logic
      actualPaymentAmount = Math.min(requestedAmount, totalInvoiceBalance);
      creditWillBeUsed = Math.min(totalAvailableCredit, actualPaymentAmount);
      bankPaymentNeeded = Math.max(0, actualPaymentAmount - creditWillBeUsed);
      console.log(`💡 NORMAL SCENARIO: Credit ₹${creditWillBeUsed} + Bank ₹${bankPaymentNeeded}`);
    }
    
    // Handle overpayment for zero credit balance case ONLY
    const willCreateNewCredit = isOverpayment && totalAvailableCredit === 0;
    const newCreditAmount = willCreateNewCredit ? requestedAmount - totalInvoiceBalance : 0;
    
    // 🏦 SMART BANK BALANCE VALIDATION (with credit balance info)
    let bankBalanceValidation;
    if (bankPaymentNeeded > 0 && bankAccountId && !overpaymentBlocked) {
      try {
        const BankAccount = (await import('../models/BankAccount')).default;
        const bankAccount = await BankAccount.findByPk(bankAccountId);
        
        if (bankAccount) {
          const availableBalance = parseFloat(bankAccount.balance.toString());
          const hasSufficientBalance = availableBalance >= bankPaymentNeeded;
          
          let errorMessage;
          if (!hasSufficientBalance) {
            errorMessage = totalAvailableCredit > 0 
              ? `🏦 Insufficient bank balance: Available ₹${availableBalance.toFixed(2)}, Required ₹${bankPaymentNeeded.toFixed(2)}. ` +
                `💡 SMART SUGGESTION: You have ₹${totalAvailableCredit.toFixed(2)} credit balance available. Use credit payment instead.`
              : `🏦 Insufficient bank balance: Available ₹${availableBalance.toFixed(2)}, Required ₹${bankPaymentNeeded.toFixed(2)}. Please add funds.`;
          }
          
          bankBalanceValidation = {
            hasSufficientBalance,
            availableBalance,
            errorMessage
          };
        }
      } catch (error) {
        console.error('Error validating bank balance:', error);
      }
    }
    
    console.log('💡 SMART Payment Preview Calculation:', {
      totalInvoiceBalance,
      totalAvailableCredit,
      requestedAmount,
      actualPaymentAmount,
      creditWillBeUsed,
      bankPaymentNeeded,
      willCreateNewCredit,
      newCreditAmount,
      overpaymentBlocked,
      overpaymentBlockReason,
      smartSuggestion,
      bankBalanceValidation
    });
    
    return {
      totalInvoiceBalance,
      availableCredit: totalAvailableCredit,
      creditWillBeUsed,
      bankPaymentNeeded,
      willCreateNewCredit,
      newCreditAmount,
      overpaymentBlocked,
      overpaymentBlockReason,
      smartSuggestion,
      bankBalanceValidation
    };
  }

  private validatePaymentRequest(request: CreditAwarePaymentRequest): void {
    if (!request.supplierId) {
      throw new ValidationError('Supplier ID is required');
    }
    if (!request.supplierName) {
      throw new ValidationError('Supplier name is required');
    }
    if (!request.invoiceIds || request.invoiceIds.length === 0) {
      throw new ValidationError('Invoice IDs are required');
    }
    if (!request.requestedPaymentAmount || request.requestedPaymentAmount <= 0) {
      throw new ValidationError('Payment amount must be greater than 0');
    }
    if (!request.paymentMethod) {
      throw new ValidationError('Payment method is required');
    }
    if (!request.bankAccountId) {
      throw new ValidationError('Bank account ID is required');
    }
    if (!request.registrationDate) {
      throw new ValidationError('Registration date is required');
    }
  }
}

// Export singleton instance
export const creditAwarePaymentService = new CreditAwarePaymentService();

// Export individual methods for backward compatibility
export const processCreditAwarePayment = (request: CreditAwarePaymentRequest) =>
  creditAwarePaymentService.processCreditAwarePayment(request);

export const getPaymentPreview = (
  supplierId: number,
  invoiceIds: number[],
  requestedAmount: number,
  bankAccountId?: number
) => creditAwarePaymentService.getPaymentPreview(supplierId, invoiceIds, requestedAmount, bankAccountId);

export default creditAwarePaymentService;