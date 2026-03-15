// Customer Credit-Aware Payment Service
// This service automatically applies existing customer credit balances before processing cash payments

import * as creditBalanceService from './creditBalanceService';
import * as cashRegisterService from './cashRegisterService';
import AccountsReceivable from '../models/AccountsReceivable';
import sequelize from '../config/database';

export interface CustomerCreditAwarePaymentRequest {
  customerId: number;
  customerName: string;
  invoiceIds: number[];
  requestedPaymentAmount: number;
  paymentMethod: string;
  cashRegisterId: number;
  registrationDate: string;
  description: string;
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
 * Process customer payment with automatic credit balance application
 * Time Complexity: O(n + m) where n = available credits, m = invoices
 * Space Complexity: O(n + m) for storing credits and invoices
 */
export const processCustomerCreditAwarePayment = async (
  request: CustomerCreditAwarePaymentRequest,
  externalTransaction?: any
): Promise<CustomerCreditAwarePaymentResult> => {
  console.log('🎯 Starting customer credit-aware payment processing...');
  console.log('📋 Request:', JSON.stringify(request, null, 2));
  
  // Use individual transactions for each operation to avoid timeout
  try {
    // Step 1: Get available credit balances for customer (no transaction needed for read)
    const availableCredits = await creditBalanceService.getAvailableCreditBalances(
      'CLIENT',
      request.customerId
    );
    
    const totalAvailableCredit = availableCredits.reduce((sum, credit) => 
      sum + parseFloat(credit.availableAmount.toString()), 0
    );
    
    console.log(`💳 Available credit for customer: ₹${totalAvailableCredit}`);
    
    // Step 2: Get invoice details (no transaction needed for read)
    const invoices = await AccountsReceivable.findAll({
      where: { id: request.invoiceIds }
    });
    
    const totalInvoiceBalance = invoices.reduce((sum, invoice) => 
      sum + parseFloat(invoice.balanceAmount.toString()), 0
    );
    
    console.log(`📄 Total invoice balance: ₹${totalInvoiceBalance}`);
    
    let creditUsed = 0;
    let cashPaymentNeeded = request.requestedPaymentAmount;
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
        
        // Recalculate cash payment needed
        const remainingBalance = creditApplication.remainingInvoiceBalance;
        cashPaymentNeeded = Math.min(request.requestedPaymentAmount, remainingBalance);
        
        await creditTransaction.commit();
        console.log(`✅ Applied ₹${creditUsed} from credit balances`);
        console.log(`💰 Remaining cash payment needed: ₹${cashPaymentNeeded}`);
      } catch (error) {
        await creditTransaction.rollback();
        throw error;
      }
    }
    
    // Step 4: Handle overpayment and create new credit balance (if needed) - separate transaction
    if (request.requestedPaymentAmount > totalInvoiceBalance) {
      const overpaymentAmount = request.requestedPaymentAmount - totalInvoiceBalance;
      console.log(`💰 Overpayment detected: ₹${overpaymentAmount} will become credit balance`);
      
      // Create credit balance for overpayment - separate transaction
      const creditData = {
        type: 'CUSTOMER_CREDIT' as const,
        relatedEntityType: 'CLIENT' as const,
        relatedEntityId: request.customerId,
        relatedEntityName: request.customerName,
        originalTransactionType: 'AR' as const,
        originalTransactionId: invoices[0]?.id || 0,
        originalTransactionNumber: invoices[0]?.registrationNumber || 'MULTI',
        creditAmount: overpaymentAmount,
        notes: `Overpayment credit from customer payment: ${request.description}`
      };
      
      const creditBalance = await creditBalanceService.createCreditBalance(creditData);
      newCreditCreated = overpaymentAmount;
      console.log(`✅ Created credit balance: ${creditBalance.registrationNumber} for ₹${overpaymentAmount}`);
      
      // Adjust cash payment needed to only pay the remaining balance after credit usage
      const remainingAfterCredit = totalInvoiceBalance - creditUsed;
      cashPaymentNeeded = remainingAfterCredit;
    }
    
    // Step 5: Process cash payment (if needed) - separate transaction
    let cashRegisterEntry = null;
    
    if (cashPaymentNeeded > 0) {
      console.log(`💸 Processing cash payment of ₹${cashPaymentNeeded}...`);
      
      const cashPaymentData = {
        registrationDate: request.registrationDate,
        transactionType: 'INFLOW',
        amount: cashPaymentNeeded,
        paymentMethod: request.paymentMethod,
        relatedDocumentType: 'AR_COLLECTION',
        relatedDocumentNumber: invoices[0]?.registrationNumber || 'MULTI',
        description: request.description,
        customerId: request.customerId,
        customerName: request.customerName,
        cashRegisterId: request.cashRegisterId,
        invoiceIds: JSON.stringify(request.invoiceIds)
      };
      
      // Use cash register service without external transaction
      cashRegisterEntry = await cashRegisterService.createCashTransaction(cashPaymentData);
      console.log(`✅ Cash payment processed: ${cashRegisterEntry.registrationNumber}`);
    }
    
    // Step 6: Calculate final results
    const updatedInvoices = await AccountsReceivable.findAll({
      where: { id: request.invoiceIds }
    });
    
    const finalInvoiceBalance = updatedInvoices.reduce((sum, invoice) => {
      return sum + parseFloat(invoice.balanceAmount.toString());
    }, 0);
    
    const result: CustomerCreditAwarePaymentResult = {
      success: true,
      creditUsed,
      cashPaymentMade: cashPaymentNeeded,
      totalPaymentProcessed: creditUsed + cashPaymentNeeded,
      remainingInvoiceBalance: finalInvoiceBalance,
      newCreditCreated,
      cashRegisterEntry,
      message: newCreditCreated > 0
        ? `Payment processed: ₹${creditUsed} from credit balance + ₹${cashPaymentNeeded} from cash. ₹${newCreditCreated} overpayment created as new credit.`
        : creditUsed > 0 
        ? `Payment processed: ₹${creditUsed} from credit balance + ₹${cashPaymentNeeded} from cash`
        : `Payment processed: ₹${cashPaymentNeeded} from cash`
    };
    
    console.log('🎉 Customer credit-aware payment completed successfully:', result);
    return result;
    
  } catch (error) {
    console.error('❌ Customer credit-aware payment failed:', error);
    
    return {
      success: false,
      creditUsed: 0,
      cashPaymentMade: 0,
      totalPaymentProcessed: 0,
      remainingInvoiceBalance: 0,
      message: `Payment failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * Get customer payment preview (shows how much credit will be used vs cash payment)
 * Time Complexity: O(n + m) where n = credits, m = invoices
 * Space Complexity: O(1) for calculations
 */
export const getCustomerPaymentPreview = async (
  customerId: number,
  invoiceIds: number[],
  requestedAmount: number
): Promise<{
  totalInvoiceBalance: number;
  availableCredit: number;
  creditWillBeUsed: number;
  cashPaymentNeeded: number;
  willCreateNewCredit: boolean;
  newCreditAmount: number;
}> => {
  // Get available credits
  const availableCredits = await creditBalanceService.getAvailableCreditBalances(
    'CLIENT',
    customerId
  );
  
  const totalAvailableCredit = availableCredits.reduce((sum, credit) => 
    sum + parseFloat(credit.availableAmount.toString()), 0
  );
  
  // Get invoice balances
  const invoices = await AccountsReceivable.findAll({
    where: { id: invoiceIds }
  });
  
  const totalInvoiceBalance = invoices.reduce((sum, invoice) => 
    sum + parseFloat(invoice.balanceAmount.toString()), 0
  );
  
  // Calculate usage
  const creditWillBeUsed = Math.min(totalAvailableCredit, totalInvoiceBalance);
  const remainingBalance = totalInvoiceBalance - creditWillBeUsed;
  const cashPaymentNeeded = Math.min(requestedAmount, remainingBalance);
  
  // Check for overpayment
  const willCreateNewCredit = requestedAmount > remainingBalance;
  const newCreditAmount = willCreateNewCredit ? requestedAmount - remainingBalance : 0;
  
  return {
    totalInvoiceBalance,
    availableCredit: totalAvailableCredit,
    creditWillBeUsed,
    cashPaymentNeeded,
    willCreateNewCredit,
    newCreditAmount
  };
};