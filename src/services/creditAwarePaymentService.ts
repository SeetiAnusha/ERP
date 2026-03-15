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
  
  const transaction = await sequelize.transaction();
  
  try {
    // Step 1: Get available credit balances for supplier
    const availableCredits = await creditBalanceService.getAvailableCreditBalances(
      'SUPPLIER',
      request.supplierId
    );
    
    const totalAvailableCredit = availableCredits.reduce((sum, credit) => 
      sum + parseFloat(credit.availableAmount.toString()), 0
    );
    
    console.log(`💳 Available credit for supplier: ₹${totalAvailableCredit}`);
    
    // Step 2: Get invoice details
    const invoices = await AccountsPayable.findAll({
      where: { id: request.invoiceIds },
      transaction
    });
    
    const totalInvoiceBalance = invoices.reduce((sum, invoice) => 
      sum + parseFloat(invoice.balanceAmount.toString()), 0
    );
    
    console.log(`📄 Total invoice balance: ₹${totalInvoiceBalance}`);
    
    let creditUsed = 0;
    let bankPaymentNeeded = request.requestedPaymentAmount;
    
    // Step 3: Apply credit balances first (if available)
    if (totalAvailableCredit > 0 && totalInvoiceBalance > 0) {
      console.log('🔄 Applying existing credit balances...');
      
      const creditApplication = await creditBalanceService.applyCreditToInvoices(
        availableCredits,
        invoices,
        transaction
      );
      
      creditUsed = creditApplication.totalCreditUsed;
      
      // Recalculate bank payment needed
      const remainingBalance = creditApplication.remainingInvoiceBalance;
      bankPaymentNeeded = Math.min(request.requestedPaymentAmount, remainingBalance);
      
      console.log(`✅ Applied ₹${creditUsed} from credit balances`);
      console.log(`💰 Remaining bank payment needed: ₹${bankPaymentNeeded}`);
    }
    
    // Step 4: Process bank payment (if needed)
    let bankRegisterEntry = null;
    let newCreditCreated = 0;
    
    if (bankPaymentNeeded > 0) {
      console.log(`💸 Processing bank payment of ₹${bankPaymentNeeded}...`);
      
      // ✅ Check for overpayment and create credit balance if needed
      const remainingInvoiceBalance = invoices.reduce((sum, invoice) => 
        sum + parseFloat(invoice.balanceAmount.toString()), 0
      );
      
      if (bankPaymentNeeded > remainingInvoiceBalance && remainingInvoiceBalance > 0) {
        const overpaymentAmount = bankPaymentNeeded - remainingInvoiceBalance;
        console.log(`💰 Overpayment detected: ₹${overpaymentAmount} will become credit balance`);
        
        // Create credit balance for overpayment
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
        
        const creditBalance = await creditBalanceService.createCreditBalance(creditData, transaction);
        newCreditCreated = overpaymentAmount;
        console.log(`✅ Created credit balance: ${creditBalance.registrationNumber} for ₹${overpaymentAmount}`);
      }
      
      // Create bank register entry
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
        invoiceIds: JSON.stringify(request.invoiceIds), // ✅ FIX: Convert to JSON string
        allowOverpayment: true
      };
      
      // Use existing bank register service (with transaction)
      bankRegisterEntry = await bankRegisterService.createBankRegister(bankPaymentData, transaction);
      
      console.log(`✅ Bank payment processed: ${bankRegisterEntry.registrationNumber}`);
    }
    
    // Step 5: Calculate final results
    const finalInvoiceBalance = invoices.reduce((sum, invoice) => {
      // Refresh invoice data
      return sum + parseFloat(invoice.balanceAmount.toString());
    }, 0);
    
    await transaction.commit();
    
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
    await transaction.rollback();
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
  
  // Calculate usage
  const creditWillBeUsed = Math.min(totalAvailableCredit, totalInvoiceBalance);
  const remainingBalance = totalInvoiceBalance - creditWillBeUsed;
  const bankPaymentNeeded = Math.min(requestedAmount, remainingBalance);
  
  // Check for overpayment
  const willCreateNewCredit = requestedAmount > remainingBalance;
  const newCreditAmount = willCreateNewCredit ? requestedAmount - remainingBalance : 0;
  
  return {
    totalInvoiceBalance,
    availableCredit: totalAvailableCredit,
    creditWillBeUsed,
    bankPaymentNeeded,
    willCreateNewCredit,
    newCreditAmount
  };
};