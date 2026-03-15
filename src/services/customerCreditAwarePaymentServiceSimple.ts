// Simplified Customer Credit-Aware Payment Service (for debugging)
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
 * Simplified version - no complex transactions, step by step processing
 */
export const processCustomerCreditAwarePaymentSimple = async (
  request: CustomerCreditAwarePaymentRequest
): Promise<CustomerCreditAwarePaymentResult> => {
  console.log('🎯 Starting SIMPLIFIED customer credit-aware payment processing...');
  console.log('📋 Request:', JSON.stringify(request, null, 2));
  
  try {
    // Step 1: Get invoice details (no transaction)
    console.log('📄 Step 1: Getting invoice details...');
    const invoices = await AccountsReceivable.findAll({
      where: { id: request.invoiceIds }
    });
    
    const totalInvoiceBalance = invoices.reduce((sum, invoice) => 
      sum + parseFloat(invoice.balanceAmount.toString()), 0
    );
    
    console.log(`📄 Total invoice balance: ₹${totalInvoiceBalance}`);
    
    // Step 2: Check for overpayment
    let newCreditCreated = 0;
    let cashPaymentNeeded = request.requestedPaymentAmount;
    
    if (request.requestedPaymentAmount > totalInvoiceBalance) {
      const overpaymentAmount = request.requestedPaymentAmount - totalInvoiceBalance;
      console.log(`💰 Overpayment detected: ₹${overpaymentAmount}`);
      
      // Step 2a: Create credit balance first (separate transaction)
      console.log('💳 Step 2a: Creating credit balance...');
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
      
      // Adjust cash payment to only pay the invoice balance
      cashPaymentNeeded = totalInvoiceBalance;
    }
    
    // Step 3: Process cash payment (separate transaction)
    let cashRegisterEntry = null;
    
    if (cashPaymentNeeded > 0) {
      console.log(`💸 Step 3: Processing cash payment of ₹${cashPaymentNeeded}...`);
      
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
    
    // Step 4: Calculate final results
    const updatedInvoices = await AccountsReceivable.findAll({
      where: { id: request.invoiceIds }
    });
    
    const finalInvoiceBalance = updatedInvoices.reduce((sum, invoice) => {
      return sum + parseFloat(invoice.balanceAmount.toString());
    }, 0);
    
    const result: CustomerCreditAwarePaymentResult = {
      success: true,
      creditUsed: 0, // No existing credit used in this simplified version
      cashPaymentMade: cashPaymentNeeded,
      totalPaymentProcessed: cashPaymentNeeded + newCreditCreated,
      remainingInvoiceBalance: finalInvoiceBalance,
      newCreditCreated,
      cashRegisterEntry,
      message: newCreditCreated > 0
        ? `Payment processed: ₹${cashPaymentNeeded} from cash. ₹${newCreditCreated} overpayment created as new credit.`
        : `Payment processed: ₹${cashPaymentNeeded} from cash`
    };
    
    console.log('🎉 SIMPLIFIED customer credit-aware payment completed successfully:', result);
    return result;
    
  } catch (error) {
    console.error('❌ SIMPLIFIED customer credit-aware payment failed:', error);
    
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