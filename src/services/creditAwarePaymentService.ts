// Credit-Aware Payment Service
// This service automatically applies existing credit balances before processing bank payments

import * as creditBalanceService from './creditBalanceService';
import * as bankRegisterService from './bankRegisterService';
import AccountsPayable from '../models/AccountsPayable';
import sequelize from '../config/database';

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

/**
 * Process payment with automatic credit balance application
 */
export const processCreditAwarePayment = async (
  request: CreditAwarePaymentRequest
): Promise<CreditAwarePaymentResult> => {
  console.log('🎯 Starting credit-aware payment processing...');
  console.log('📋 Request:', JSON.stringify(request, null, 2));
  
  // Use separate transactions for each operation to avoid timeout issues
  try {
    // Step 1: Get available credit balances for supplier (no transaction needed for read)
    const availableCredits = await creditBalanceService.getAvailableCreditBalances(
      'SUPPLIER',
      request.supplierId
    );
    
    const totalAvailableCredit = availableCredits.reduce((sum, credit) => 
      sum + parseFloat(credit.availableAmount.toString()), 0
    );
    
    console.log(`💳 Available credit for supplier: ₹${totalAvailableCredit}`);
    
    // Step 2: Get invoice details (no transaction needed for read)
    const invoices = await AccountsPayable.findAll({
      where: { id: request.invoiceIds }
    });
    
    const totalInvoiceBalance = invoices.reduce((sum, invoice) => 
      sum + parseFloat(invoice.balanceAmount.toString()), 0
    );
    
    console.log(`📄 Total invoice balance: ₹${totalInvoiceBalance}`);
    
    let creditUsed = 0;
    let bankPaymentNeeded = request.requestedPaymentAmount;
    let newCreditCreated = 0;
    
    // Step 3: Apply credit balances first (if available) - separate transaction
    if (totalAvailableCredit > 0 && totalInvoiceBalance > 0) {
      console.log('🔄 Applying existing credit balances...');
      
      const creditTransaction = await sequelize.transaction();
      try {
        const creditApplication = await creditBalanceService.applyCreditToInvoices(
          availableCredits,
          invoices,
          creditTransaction
        );
        
        creditUsed = creditApplication.totalCreditUsed;
        
        // Recalculate bank payment needed after credit application
        const remainingBalance = creditApplication.remainingInvoiceBalance;
        bankPaymentNeeded = Math.min(request.requestedPaymentAmount, remainingBalance);
        
        await creditTransaction.commit();
        console.log(`✅ Applied ₹${creditUsed} from credit balances`);
        console.log(`💰 Remaining bank payment needed: ₹${bankPaymentNeeded}`);
      } catch (error) {
        await creditTransaction.rollback();
        throw error;
      }
    }
    
    // Step 4: Check for overpayment and create credit balance (if needed) - separate transaction
    const remainingInvoiceBalance = totalInvoiceBalance - creditUsed;
    if (request.requestedPaymentAmount > remainingInvoiceBalance && remainingInvoiceBalance > 0) {
      const overpaymentAmount = request.requestedPaymentAmount - remainingInvoiceBalance;
      console.log(`💰 Overpayment detected: ₹${overpaymentAmount} will become credit balance`);
      
      // Create credit balance for overpayment - separate transaction
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
      
      // Adjust bank payment to only pay the remaining balance after credit usage
      bankPaymentNeeded = remainingInvoiceBalance;
    }
    
    // Step 5: Process bank payment (if needed) - separate transaction
    let bankRegisterEntry = null;
    
    if (bankPaymentNeeded > 0) {
      console.log(`💸 Processing bank payment of ₹${bankPaymentNeeded}...`);
      
      const bankPaymentData = {
        registrationDate: request.registrationDate,
        transactionType: 'OUTFLOW',
        amount: bankPaymentNeeded,
        paymentMethod: request.paymentMethod,
        relatedDocumentType: 'AP',
        relatedDocumentNumber: invoices[0]?.registrationNumber || 'MULTI',
        description: request.description,
        supplierId: request.supplierId,
        supplierName: request.supplierName,
        bankAccountId: request.bankAccountId,
        invoiceIds: JSON.stringify(request.invoiceIds),
        allowOverpayment: true
      };
      
      // Use existing bank register service without external transaction
      bankRegisterEntry = await bankRegisterService.createBankRegister(bankPaymentData);
      console.log(`✅ Bank payment processed: ${bankRegisterEntry.registrationNumber}`);
    }
    
    // Step 6: Calculate final results
    const updatedInvoices = await AccountsPayable.findAll({
      where: { id: request.invoiceIds }
    });
    
    const finalInvoiceBalance = updatedInvoices.reduce((sum, invoice) => {
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
      message: newCreditCreated > 0
        ? `Payment processed: ₹${creditUsed} from credit balance + ₹${bankPaymentNeeded} from bank account. ₹${newCreditCreated} overpayment created as new credit.`
        : creditUsed > 0 
        ? `Payment processed: ₹${creditUsed} from credit balance + ₹${bankPaymentNeeded} from bank account`
        : `Payment processed: ₹${bankPaymentNeeded} from bank account`
    };
    
    console.log('🎉 Credit-aware payment completed successfully:', result);
    return result;
    
  } catch (error) {
    console.error('❌ Credit-aware payment failed:', error);
    
    return {
      success: false,
      creditUsed: 0,
      bankPaymentMade: 0,
      totalPaymentProcessed: 0,
      remainingInvoiceBalance: 0,
      message: `Payment failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * Get payment preview (shows how much credit will be used vs bank payment)
 */
export const getPaymentPreview = async (
  supplierId: number,
  invoiceIds: number[],
  requestedAmount: number
): Promise<{
  totalInvoiceBalance: number;
  availableCredit: number;
  creditWillBeUsed: number;
  bankPaymentNeeded: number;
  willCreateNewCredit: boolean;
  newCreditAmount: number;
}> => {
  // Get available credits
  const availableCredits = await creditBalanceService.getAvailableCreditBalances(
    'SUPPLIER',
    supplierId
  );
  
  const totalAvailableCredit = availableCredits.reduce((sum, credit) => 
    sum + parseFloat(credit.availableAmount.toString()), 0
  );
  
  // Get invoice balances
  const invoices = await AccountsPayable.findAll({
    where: { id: invoiceIds }
  });
  
  const totalInvoiceBalance = invoices.reduce((sum, invoice) => 
    sum + parseFloat(invoice.balanceAmount.toString()), 0
  );
  
  // Calculate credit usage (FIFO - use available credit first)
  const creditWillBeUsed = Math.min(totalAvailableCredit, totalInvoiceBalance);
  
  // Calculate remaining balance after credit application
  const remainingBalanceAfterCredit = totalInvoiceBalance - creditWillBeUsed;
  
  // Calculate bank payment needed (minimum of requested amount and remaining balance)
  const bankPaymentNeeded = Math.min(requestedAmount, remainingBalanceAfterCredit);
  
  // Check for overpayment (requested amount > remaining balance after credit)
  const willCreateNewCredit = requestedAmount > remainingBalanceAfterCredit;
  const newCreditAmount = willCreateNewCredit ? requestedAmount - remainingBalanceAfterCredit : 0;
  
  console.log('💡 Payment Preview Calculation:', {
    totalInvoiceBalance,
    totalAvailableCredit,
    creditWillBeUsed,
    remainingBalanceAfterCredit,
    requestedAmount,
    bankPaymentNeeded,
    willCreateNewCredit,
    newCreditAmount
  });
  
  return {
    totalInvoiceBalance,
    availableCredit: totalAvailableCredit,
    creditWillBeUsed,
    bankPaymentNeeded,
    willCreateNewCredit,
    newCreditAmount
  };
};