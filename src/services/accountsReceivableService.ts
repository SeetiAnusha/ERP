import AccountsReceivable from '../models/AccountsReceivable';
import Expense from '../models/Expense';
import { Op } from 'sequelize';
import sequelize from '../config/database';
import * as creditBalanceService from './creditBalanceService';

export const getAllAccountsReceivable = async () => {
  // First get all AR records
  const arRecords = await AccountsReceivable.findAll({
    order: [['registrationDate', 'DESC']],
  });

  // Then get related expense records for each AR
  const arWithExpenses = await Promise.all(
    arRecords.map(async (ar) => {
      // Find expense records related to this AR
      const relatedExpenses = await Expense.findAll({
        where: {
          relatedDocumentType: 'AR_COLLECTION',
          relatedDocumentNumber: ar.registrationNumber
        },
        attributes: ['id', 'registrationNumber', 'amount', 'expenseType', 'status', 'description']
      });

      // Calculate total expense amount for this AR
      const totalExpenseAmount = relatedExpenses.reduce((sum, expense) => {
        return sum + parseFloat(expense.amount.toString());
      }, 0);

      // Return AR record with expense data
      return {
        ...ar.toJSON(),
        relatedExpenses: relatedExpenses,
        totalExpenseAmount: totalExpenseAmount
      };
    })
  );

  return arWithExpenses;
};

export const getAccountsReceivableById = async (id: number) => {
  return await AccountsReceivable.findByPk(id);
};

export const getPendingAccountsReceivable = async () => {
  return await AccountsReceivable.findAll({
    where: {
      status: {
        [Op.in]: ['Pending', 'Partial']
      }
    },
    order: [['dueDate', 'ASC']],
  });
};

export const createAccountsReceivable = async (data: any) => {
  const transaction = await sequelize.transaction();
  let committed = false;
  
  try {
    // Generate registration number (AR format)
    const lastAR = await AccountsReceivable.findOne({
      where: {
        registrationNumber: {
          [Op.like]: 'AR%'
        }
      },
      order: [['id', 'DESC']],
      transaction
    });
    
    let nextNumber = 1;
    if (lastAR) {
      const lastNumber = parseInt(lastAR.registrationNumber.substring(2));
      nextNumber = lastNumber + 1;
    }
    
    const registrationNumber = `AR${String(nextNumber).padStart(4, '0')}`;
    
    const accountsReceivable = await AccountsReceivable.create({
      ...data,
      registrationNumber,
      registrationDate: new Date(),
      receivedAmount: 0,
      balanceAmount: data.amount,
      status: 'Pending',
    }, { transaction });
    
    await transaction.commit();
    committed = true;
    
    return accountsReceivable;
  } catch (error) {
    if (!committed) {
      await transaction.rollback();
    }
    throw error;
  }
};

export const recordPayment = async (id: number, paymentData: { 
  amount: number; 
  receivedDate?: Date; 
  notes?: string;
  bankAccountId?: number;
  isCardSale?: boolean;
  allowOverpayment?: boolean; // NEW: Flag to allow overpayment after user confirmation
}) => {
    const transaction = await sequelize.transaction();
  let committed = false;
  
  try {
    const ar = await AccountsReceivable.findByPk(id, { transaction });
    if (!ar) throw new Error('Accounts Receivable not found');
    
    // 🎯 PHASE 1: OVERPAYMENT DETECTION & VALIDATION
    const outstandingBalance = Number(ar.balanceAmount);
    const paymentAmount = paymentData.amount;
    
    // Get customer name for validation message
    const customerName = ar.clientName || ar.cardNetwork || 'Unknown Customer';
    
    // Validate payment amount
    const validation = await creditBalanceService.validatePaymentAmount(
      outstandingBalance,
      paymentAmount,
      'CLIENT',
      customerName
    );
    
    // If overpayment detected and not explicitly allowed, throw error with details
    if (validation.isOverpayment && !paymentData.allowOverpayment) {
      const error = new Error(validation.message) as any;
      error.code = 'OVERPAYMENT_DETECTED';
      error.overpaymentAmount = validation.overpaymentAmount;
      error.outstandingBalance = outstandingBalance;
      error.paymentAmount = paymentAmount;
      error.customerName = customerName;
      throw error;
    }
    
    // Calculate payment amounts
    const actualPaymentToAR = Math.min(paymentAmount, outstandingBalance);
    const overpaymentAmount = Math.max(0, paymentAmount - outstandingBalance);
    
    const newReceivedAmount = Number(ar.receivedAmount) + actualPaymentToAR;
    const newBalanceAmount = Number(ar.amount) - newReceivedAmount;
    
    let status = 'Pending';
    if (newReceivedAmount >= Number(ar.amount)) {
      status = 'Received';
    } else if (newReceivedAmount > 0) {
      status = 'Partial';
    }

    if (paymentData.isCardSale && paymentData.bankAccountId) {
      const BankRegister = (await import('../models/BankRegister')).default;
      const BankAccount = (await import('../models/BankAccount')).default;
      
      // Get and validate bank account
      const bankAccount = await BankAccount.findByPk(paymentData.bankAccountId, { transaction });
      if (!bankAccount) {
        throw new Error('Bank account not found');
      }
      
      // Generate bank register number
      const lastBankTransaction = await BankRegister.findOne({
        where: {
          registrationNumber: {
            [Op.like]: 'BR%'
          }
        },
        order: [['id', 'DESC']],
        transaction
      });
      
      let nextBankNumber = 1;
      if (lastBankTransaction) {
        const lastBankNumber = parseInt(lastBankTransaction.registrationNumber.substring(2));
        nextBankNumber = lastBankNumber + 1;
      }
      
      const bankRegistrationNumber = `BR${String(nextBankNumber).padStart(4, '0')}`;
      
      // Get last bank balance for this specific bank account
      const lastBankBalance = await BankRegister.findOne({
        where: { bankAccountId: paymentData.bankAccountId },
        order: [['id', 'DESC']],
        transaction
      });
      
      const previousBalance = lastBankBalance ? Number(lastBankBalance.balance) : Number(bankAccount.balance);
      const newBankBalance = previousBalance + actualPaymentToAR; // Use actual payment amount, not total
      
      // Create bank register entry
      await BankRegister.create({
        registrationNumber: bankRegistrationNumber,
        registrationDate: paymentData.receivedDate || new Date(),
        transactionType: 'INFLOW',
        amount: actualPaymentToAR, // Use actual payment amount, not total
        paymentMethod: 'CREDIT_CARD_COLLECTION',
        relatedDocumentType: 'AR_COLLECTION',
        relatedDocumentNumber: ar.registrationNumber,
        clientName: ar.clientName || ar.cardNetwork || 'Credit Card Collection',
        clientRnc: ar.clientRnc || '',
        ncf: ar.ncf || '',
        description: `Credit Card Collection - ${ar.relatedDocumentNumber} - ${ar.clientName || ar.cardNetwork}`,
        balance: newBankBalance,
        bankAccountId: paymentData.bankAccountId,
      }, { transaction });
      
      // Update bank account balance
      const newBankAccountBalance = Number(bankAccount.balance) + actualPaymentToAR; // Use actual payment amount, not total
      await bankAccount.update({
        balance: newBankAccountBalance,
      }, { transaction });
    }
    
    await ar.update({
      receivedAmount: newReceivedAmount,
      balanceAmount: newBalanceAmount,
      status,
      receivedDate: status === 'Received' ? (paymentData.receivedDate || new Date()) : ar.receivedDate,
      notes: paymentData.notes || ar.notes,
      actualBankDeposit: paymentData.isCardSale ? actualPaymentToAR : undefined, // Use actual payment amount
      bankAccountId: paymentData.bankAccountId || undefined,
    }, { transaction });
    
    // 🎯 PHASE 1: CREATE CREDIT BALANCE IF OVERPAYMENT
    let creditBalance = null;
    if (overpaymentAmount > 0 && ar.clientId) {
      creditBalance = await creditBalanceService.createCreditBalance({
        type: 'CUSTOMER_CREDIT',
        relatedEntityType: 'CLIENT',
        relatedEntityId: ar.clientId,
        relatedEntityName: customerName,
        originalTransactionType: 'AR',
        originalTransactionId: ar.id,
        originalTransactionNumber: ar.registrationNumber,
        creditAmount: overpaymentAmount,
        notes: `Overpayment of ₹${overpaymentAmount.toFixed(2)} on AR ${ar.registrationNumber}`
      });
    }
    
    await transaction.commit();
    committed = true;
    
    return {
      accountsReceivable: ar,
      creditBalance,
      overpaymentAmount,
      message: overpaymentAmount > 0 
        ? `Payment processed. Credit balance of ₹${overpaymentAmount.toFixed(2)} created for customer.`
        : 'Payment processed successfully.'
    };
  } catch (error) {
    if (!committed) {
      await transaction.rollback();
    }
    throw error;
  }
};

export const deleteAccountsReceivable = async (id: number) => {
  const ar = await AccountsReceivable.findByPk(id);
  if (!ar) throw new Error('Accounts Receivable not found');
  
  await ar.destroy();
  return { message: 'Accounts Receivable deleted successfully' };
};
