import CreditBalance from '../models/CreditBalance';
import { Op } from 'sequelize';
import sequelize from '../config/database';

export interface OverpaymentValidationResult {
  isOverpayment: boolean;
  overpaymentAmount: number;
  message: string;
  allowProceed: boolean;
}

export interface CreditCreationData {
  type: 'CUSTOMER_CREDIT' | 'SUPPLIER_CREDIT';
  relatedEntityType: 'CLIENT' | 'SUPPLIER';
  relatedEntityId: number;
  relatedEntityName: string;
  originalTransactionType: 'AR' | 'AP';
  originalTransactionId: number;
  originalTransactionNumber: string;
  creditAmount: number;
  notes?: string;
}

/**
 * Phase 1: Overpayment Detection & Alert
 * Validates if payment amount exceeds outstanding balance
 */
export const validatePaymentAmount = async (
  outstandingBalance: number,
  paymentAmount: number,
  entityType: 'CLIENT' | 'SUPPLIER',
  entityName: string
): Promise<OverpaymentValidationResult> => {
  const isOverpayment = paymentAmount > outstandingBalance;
  
  if (!isOverpayment) {
    return {
      isOverpayment: false,
      overpaymentAmount: 0,
      message: 'Payment amount is within outstanding balance',
      allowProceed: true
    };
  }
  
  const overpaymentAmount = paymentAmount - outstandingBalance;
  const entityTypeText = entityType === 'CLIENT' ? 'customer' : 'supplier';
  
  return {
    isOverpayment: true,
    overpaymentAmount,
    message: `Payment amount (₹${paymentAmount.toFixed(2)}) exceeds outstanding balance (₹${outstandingBalance.toFixed(2)}) by ₹${overpaymentAmount.toFixed(2)}. This will create a credit balance of ₹${overpaymentAmount.toFixed(2)} for ${entityTypeText} "${entityName}".`,
    allowProceed: true // Client requirement: show alert but allow to proceed
  };
};

/**
 * Phase 1: Credit Balance Creation
 * Creates credit balance record when overpayment is processed
 */
export const createCreditBalance = async (data: CreditCreationData, externalTransaction?: any): Promise<CreditBalance> => {
  console.log('🔄 Creating credit balance with data:', JSON.stringify(data, null, 2));
  
  const transaction = externalTransaction || await sequelize.transaction();
  const shouldCommit = !externalTransaction;
  
  try {
    // Generate registration number (CB format)
    const lastCB = await CreditBalance.findOne({
      where: {
        registrationNumber: {
          [Op.like]: 'CB%'
        }
      },
      order: [['id', 'DESC']],
      transaction
    });
    
    let nextNumber = 1;
    if (lastCB) {
      const lastNumber = parseInt(lastCB.registrationNumber.substring(2));
      nextNumber = lastNumber + 1;
    }
    
    const registrationNumber = `CB${String(nextNumber).padStart(4, '0')}`;
    console.log('📝 Generated registration number:', registrationNumber);
    
    const creditBalanceData = {
      registrationNumber,
      registrationDate: new Date(),
      type: data.type,
      relatedEntityType: data.relatedEntityType,
      relatedEntityId: data.relatedEntityId,
      relatedEntityName: data.relatedEntityName,
      originalTransactionType: data.originalTransactionType,
      originalTransactionId: data.originalTransactionId,
      originalTransactionNumber: data.originalTransactionNumber,
      creditAmount: data.creditAmount,
      usedAmount: 0,
      availableAmount: data.creditAmount,
      status: 'ACTIVE' as const, // Fix: Explicitly type as literal
      notes: data.notes || `Credit created from overpayment on ${data.originalTransactionNumber}`,
    };
    
    console.log('💾 Creating credit balance record:', JSON.stringify(creditBalanceData, null, 2));
    
    const creditBalance = await CreditBalance.create(creditBalanceData, { transaction });
    
    console.log('✅ Credit balance created successfully:', {
      id: creditBalance.id,
      registrationNumber: creditBalance.registrationNumber,
      creditAmount: creditBalance.creditAmount,
      availableAmount: creditBalance.availableAmount
    });
    
    if (shouldCommit) {
      await transaction.commit();
      console.log('✅ Transaction committed successfully');
    }
    
    return creditBalance;
  } catch (error) {
    console.error('❌ Error creating credit balance:', error);
    if (shouldCommit) {
      await transaction.rollback();
      console.log('🔄 Transaction rolled back');
    }
    throw error;
  }
};

/**
 * Get available credit balance for a customer or supplier
 */
export const getAvailableCreditBalance = async (
  entityType: 'CLIENT' | 'SUPPLIER',
  entityId: number
): Promise<number> => {
  const credits = await CreditBalance.findAll({
    where: {
      relatedEntityType: entityType,
      relatedEntityId: entityId,
      status: 'ACTIVE',
      availableAmount: {
        [Op.gt]: 0
      }
    }
  });
  
  return credits.reduce((total, credit) => total + Number(credit.availableAmount), 0);
};

/**
 * Get all credit balances for a customer or supplier
 */
export const getCreditBalancesByEntity = async (
  entityType: 'CLIENT' | 'SUPPLIER',
  entityId: number
): Promise<CreditBalance[]> => {
  return await CreditBalance.findAll({
    where: {
      relatedEntityType: entityType,
      relatedEntityId: entityId
    },
    order: [['registrationDate', 'DESC']]
  });
};

/**
 * Get all active credit balances
 */
export const getAllActiveCreditBalances = async (): Promise<CreditBalance[]> => {
  return await CreditBalance.findAll({
    where: {
      status: 'ACTIVE',
      availableAmount: {
        [Op.gt]: 0
      }
    },
    order: [['registrationDate', 'DESC']]
  });
};

/**
 * Get credit balance by ID
 */
export const getCreditBalanceById = async (id: number): Promise<CreditBalance | null> => {
  return await CreditBalance.findByPk(id);
};

/**
 * Get available credit balances for auto-application
 */
export const getAvailableCreditBalances = async (
  entityType: 'CLIENT' | 'SUPPLIER',
  entityId: number
): Promise<CreditBalance[]> => {
  console.log(`🔍 Fetching available credit balances for ${entityType} ID: ${entityId}`);
  
  const credits = await CreditBalance.findAll({
    where: {
      relatedEntityType: entityType,
      relatedEntityId: entityId,
      status: 'ACTIVE',
      availableAmount: {
        [Op.gt]: 0
      }
    },
    order: [['registrationDate', 'ASC']] // FIFO - First In, First Out
  });
  
  console.log(`✅ Found ${credits.length} available credit balances with total: ₹${credits.reduce((sum, c) => sum + parseFloat(c.availableAmount.toString()), 0)}`);
  
  return credits;
};

/**
 * Apply credit balances to invoices automatically
 */
export const applyCreditToInvoices = async (
  availableCredits: CreditBalance[],
  invoicesToUpdate: any[],
  transaction: any
): Promise<{
  totalCreditUsed: number;
  remainingInvoiceBalance: number;
  updatedCredits: CreditBalance[];
  updatedInvoices: any[];
}> => {
  console.log('🎯 Starting credit application to invoices...');
  
  let totalCreditUsed = 0;
  let remainingInvoiceBalance = 0;
  const updatedCredits: CreditBalance[] = [];
  const updatedInvoices: any[] = [];
  
  // Calculate total invoice balance
  const totalInvoiceBalance = invoicesToUpdate.reduce((sum, invoice) => 
    sum + parseFloat(invoice.balanceAmount.toString()), 0
  );
  
  console.log(`💰 Total invoice balance to pay: ₹${totalInvoiceBalance}`);
  
  let remainingAmountToPay = totalInvoiceBalance;
  
  // Apply credits in FIFO order
  for (const credit of availableCredits) {
    if (remainingAmountToPay <= 0) break;
    
    const availableAmount = parseFloat(credit.availableAmount.toString());
    const amountToUse = Math.min(availableAmount, remainingAmountToPay);
    
    if (amountToUse > 0) {
      console.log(`💳 Using ₹${amountToUse} from credit ${credit.registrationNumber}`);
      
      // Update credit balance
      const newUsedAmount = parseFloat(credit.usedAmount.toString()) + amountToUse;
      const newAvailableAmount = parseFloat(credit.creditAmount.toString()) - newUsedAmount;
      const newStatus = newAvailableAmount <= 0.01 ? 'FULLY_USED' : 'ACTIVE';
      
      await credit.update({
        usedAmount: newUsedAmount,
        availableAmount: Math.max(0, newAvailableAmount),
        status: newStatus
      }, { transaction });
      
      updatedCredits.push(credit);
      totalCreditUsed += amountToUse;
      remainingAmountToPay -= amountToUse;
      
      console.log(`✅ Credit ${credit.registrationNumber} updated: Used ₹${newUsedAmount}, Available ₹${newAvailableAmount}, Status: ${newStatus}`);
    }
  }
  
  // Update invoices with credit applications
  let remainingCreditToApply = totalCreditUsed;
  
  for (const invoice of invoicesToUpdate) {
    if (remainingCreditToApply <= 0) break;
    
    const invoiceBalance = parseFloat(invoice.balanceAmount.toString());
    const creditToApplyToThisInvoice = Math.min(invoiceBalance, remainingCreditToApply);
    
    if (creditToApplyToThisInvoice > 0) {
      const newReceivedAmount = parseFloat(invoice.receivedAmount.toString()) + creditToApplyToThisInvoice;
      const newBalanceAmount = parseFloat(invoice.amount.toString()) - newReceivedAmount;
      const newStatus = newBalanceAmount <= 0.01 ? 'Received' : 'Partial';
      
      await invoice.update({
        receivedAmount: newReceivedAmount,
        balanceAmount: Math.max(0, newBalanceAmount),
        status: newStatus
      }, { transaction });
      
      updatedInvoices.push(invoice);
      remainingCreditToApply -= creditToApplyToThisInvoice;
      
      console.log(`📄 Invoice ${invoice.registrationNumber} updated: Received ₹${newReceivedAmount}, Balance ₹${newBalanceAmount}, Status: ${newStatus}`);
    }
  }
  
  // Calculate remaining invoice balance after credit application
  remainingInvoiceBalance = invoicesToUpdate.reduce((sum, invoice) => 
    sum + parseFloat(invoice.balanceAmount.toString()), 0
  );
  
  console.log('🎉 Credit application completed:', {
    totalCreditUsed,
    remainingInvoiceBalance,
    creditsUpdated: updatedCredits.length,
    invoicesUpdated: updatedInvoices.length
  });
  
  return {
    totalCreditUsed,
    remainingInvoiceBalance,
    updatedCredits,
    updatedInvoices
  };
};