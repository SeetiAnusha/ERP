import CashRegister from '../models/CashRegister';
import CashRegisterMaster from '../models/CashRegisterMaster';
import BankAccount from '../models/BankAccount';
import BankRegister from '../models/BankRegister';
import AccountsReceivable from '../models/AccountsReceivable';
import { Op } from 'sequelize';
import sequelize from '../config/database';
import * as creditBalanceService from './creditBalanceService';

export const getAllCashTransactions = async () => {
  return await CashRegister.findAll({ order: [['registrationDate', 'DESC']] });
};

export const getCashTransactionById = async (id: number) => {
  return await CashRegister.findByPk(id);
};

export const createCashTransaction = async (data: any, externalTransaction?: any) => {
  const transaction = externalTransaction || await sequelize.transaction();
  const shouldCommit = !externalTransaction;
  
  try {
    // Phase 3: Conditional Cash Register Validation
    const needsCashRegister = 
      data.relatedDocumentType === 'CONTRIBUTION' || 
      data.relatedDocumentType === 'LOAN' ||
      (data.relatedDocumentType === 'AR_COLLECTION' && data.paymentMethod === 'CASH');
    
    if (needsCashRegister && !data.cashRegisterId) {
      throw new Error('Cash Register selection is required for this transaction type');
    }

    // Get cash register master (only if needed)
    let cashRegisterMaster = null;
    if (needsCashRegister) {
      cashRegisterMaster = await CashRegisterMaster.findByPk(data.cashRegisterId, { transaction });
      if (!cashRegisterMaster) {
        throw new Error('Cash Register not found');
      }
    }

    // Generate registration number
    const lastTransaction = await CashRegister.findOne({
      where: {
        registrationNumber: {
          [Op.like]: 'CJ%'
        }
      },
      order: [['id', 'DESC']],
      transaction
    });
    
    let nextNumber = 1;
    if (lastTransaction) {
      const lastNumber = parseInt(lastTransaction.registrationNumber.substring(2));
      nextNumber = lastNumber + 1;
    }
    
    const registrationNumber = `CJ${String(nextNumber).padStart(4, '0')}`;
    
    // Get last balance for this specific cash register (only if cash register is involved)
    let lastBalance = 0;
    if (needsCashRegister && cashRegisterMaster) {
      const lastRegisterTransaction = await CashRegister.findOne({
        where: { cashRegisterId: data.cashRegisterId },
        order: [['id', 'DESC']],
        transaction
      });
      
      lastBalance = lastRegisterTransaction 
        ? parseFloat(lastRegisterTransaction.balance.toString()) 
        : parseFloat(cashRegisterMaster.balance.toString());
    }
    
    // Phase 3: Handle different transaction types
    if (data.transactionType === 'INFLOW') {
      // INFLOW: Money coming into cash register
      // Allow AR_COLLECTION (for Credit Sales and Credit Card Sales with customer info), CONTRIBUTION, and LOAN
      if (data.relatedDocumentType === 'AR_COLLECTION') {
        // AR Collection: For Credit Sales and Credit Card Sales with customer info
        if (!data.customerId) {
          throw new Error('Customer is required for AR Collection');
        }
        if (!data.invoiceIds || data.invoiceIds.length === 0) {
          throw new Error('At least one invoice must be selected for AR Collection');
        }
        
        // Phase 1: Overpayment Detection & Credit Balance Creation
        const invoiceIdsArray = JSON.parse(data.invoiceIds);
        let totalOutstandingBalance = 0;
        const invoicesToUpdate = [];
        
        // Calculate total outstanding balance and validate invoices
        for (const invoiceId of invoiceIdsArray) {
          const arInvoice = await AccountsReceivable.findByPk(invoiceId, { transaction });
          if (arInvoice) {
            // Verify this is from a Credit Sale or Credit Card Sale with customer info
            const allowedTypes = ['CREDIT_SALE', 'CLIENT_CREDIT', 'CREDIT_CARD_SALE', 'DEBIT_CARD_SALE'];
            if (!allowedTypes.includes(arInvoice.type)) {
              throw new Error(`Invoice ${arInvoice.registrationNumber} is not from a Credit Sale or Credit Card Sale. Only Credit Sales and Credit Card Sales with customer information can be collected through Cash Register.`);
            }
            
            // For credit card sales, ensure customer information is available
            if ((arInvoice.type === 'CREDIT_CARD_SALE' || arInvoice.type === 'DEBIT_CARD_SALE') && !arInvoice.clientId) {
              throw new Error(`Invoice ${arInvoice.registrationNumber} is a Credit Card Sale without customer information. Only Credit Card Sales with customer information can be collected through Cash Register.`);
            }
            
            totalOutstandingBalance += parseFloat(arInvoice.balanceAmount.toString());
            invoicesToUpdate.push(arInvoice);
          }
        }
        
        // Check for overpayment using existing service
        const paymentAmount = parseFloat(data.amount);
        if (paymentAmount > totalOutstandingBalance) {
          // Get customer name for overpayment validation
          const firstInvoice = invoicesToUpdate[0];
          const customerName = firstInvoice ? firstInvoice.clientName : 'Customer';
          
          const validation = await creditBalanceService.validatePaymentAmount(
            totalOutstandingBalance,
            paymentAmount,
            'CLIENT',
            customerName || 'Customer'
          );
          
          if (validation.isOverpayment) {
            // Create credit balance for overpayment
            const overpaymentAmount = validation.overpaymentAmount;
            const firstInvoice = invoicesToUpdate[0];
            
            await creditBalanceService.createCreditBalance({
              type: 'CUSTOMER_CREDIT',
              relatedEntityType: 'CLIENT',
              relatedEntityId: data.customerId,
              relatedEntityName: customerName || 'Customer',
              originalTransactionType: 'AR',
              originalTransactionId: firstInvoice.id,
              originalTransactionNumber: firstInvoice.registrationNumber,
              creditAmount: overpaymentAmount,
              notes: `Credit created from overpayment in Cash Register transaction ${registrationNumber}`
            });
          }
        }
        
        // Update AR invoices - Credit Sales and Credit Card Sales with customer info
        for (const arInvoice of invoicesToUpdate) {
          const currentReceived = parseFloat(arInvoice.receivedAmount.toString());
          const invoiceTotal = parseFloat(arInvoice.amount.toString());
          const invoiceBalance = parseFloat(arInvoice.balanceAmount.toString());
          
          // Calculate how much to apply to this invoice (proportional if multiple invoices)
          let amountToApply = paymentAmount;
          if (invoicesToUpdate.length > 1) {
            // Proportional distribution based on balance amount
            const proportion = invoiceBalance / totalOutstandingBalance;
            amountToApply = Math.min(paymentAmount * proportion, invoiceBalance);
          } else {
            // Single invoice - apply up to the balance amount
            amountToApply = Math.min(paymentAmount, invoiceBalance);
          }
          
          const newReceivedAmount = currentReceived + amountToApply;
          const newBalanceAmount = invoiceTotal - newReceivedAmount;
          const newStatus = newBalanceAmount <= 0.01 ? 'Received' : 'Partial'; // Allow small rounding differences
          
          await arInvoice.update({
            receivedAmount: newReceivedAmount,
            balanceAmount: Math.max(0, newBalanceAmount), // Ensure no negative balance
            status: newStatus,
          }, { transaction });
        }
      }
      
      if (data.relatedDocumentType === 'CONTRIBUTION' || data.relatedDocumentType === 'LOAN') {
        // CONTRIBUTION/LOAN: Require investment agreement instead of just financer
        if (!data.investmentAgreementId) {
          throw new Error('Investment Agreement is required for Contribution/Loan');
        }
        
        // Get and validate investment agreement
        const InvestmentAgreement = require('../models/InvestmentAgreement').default;
        const agreement = await InvestmentAgreement.findByPk(data.investmentAgreementId);
        if (!agreement) {
          throw new Error('Investment Agreement not found');
        }
        
        if (agreement.status !== 'ACTIVE') {
          throw new Error('Investment Agreement is not active');
        }
        
        const receivingAmount = parseFloat(data.amount);
        const currentBalance = parseFloat(agreement.balanceAmount.toString());
        
        if (receivingAmount > currentBalance) {
          throw new Error(
            `Cannot receive more than remaining balance. ` +
            `Agreement balance: ${currentBalance}, ` +
            `Trying to receive: ${receivingAmount}`
          );
        }
        
        // Update investment agreement
        const investmentAgreementService = require('../services/investmentAgreementService');
        await investmentAgreementService.updateAgreementOnPayment(data.investmentAgreementId, receivingAmount);
        
        // ✅ COMPLETELY REMOVED: No AccountsPayable creation for CONTRIBUTION/LOAN transactions
        // These transactions are tracked through CashRegister + InvestmentAgreement only
        // AccountsPayable is only for credit/unpaid transactions, not cash transactions
      }
      
      // Calculate new balance (INFLOW increases balance, but only if cash register is involved)
      let newBalance = lastBalance;
      if (needsCashRegister) {
        newBalance = lastBalance + parseFloat(data.amount);
      }
      
      // Create cash register transaction
      const cashTransaction = await CashRegister.create({
        ...data,
        registrationNumber,
        balance: newBalance,
        // Set cashRegisterId to null if not needed
        cashRegisterId: needsCashRegister ? data.cashRegisterId : null,
      }, { transaction });
      
      // Update cash register master balance (only if cash register is involved)
      if (needsCashRegister && cashRegisterMaster) {
        await cashRegisterMaster.update({
          balance: newBalance,
        }, { transaction });
      }
      
      if (shouldCommit) await transaction.commit();
      return cashTransaction;
      
    } else if (data.transactionType === 'OUTFLOW') {
      // OUTFLOW: Money leaving cash register
      // Phase 3: Only allow BANK_DEPOSIT or CORRECTION
      
      // For OUTFLOW, cash register is always required (money must leave from somewhere)
      if (!data.cashRegisterId) {
        throw new Error('Cash Register selection is required for OUTFLOW transactions');
      }
      
      if (!cashRegisterMaster) {
        cashRegisterMaster = await CashRegisterMaster.findByPk(data.cashRegisterId, { transaction });
        if (!cashRegisterMaster) {
          throw new Error('Cash Register not found');
        }
        
        // Get last balance for OUTFLOW
        const lastRegisterTransaction = await CashRegister.findOne({
          where: { cashRegisterId: data.cashRegisterId },
          order: [['id', 'DESC']],
          transaction
        });
        
        lastBalance = lastRegisterTransaction 
          ? parseFloat(lastRegisterTransaction.balance.toString()) 
          : parseFloat(cashRegisterMaster.balance.toString());
      }
      
      // ✅ CRITICAL VALIDATION: Check if cash register has sufficient balance
      const outflowAmount = parseFloat(data.amount);
      if (lastBalance < outflowAmount) {
        throw new Error(
          `Insufficient balance in cash register "${cashRegisterMaster.name}". ` +
          `Available: ${lastBalance.toFixed(2)}, Required: ${outflowAmount.toFixed(2)}. ` +
          `Cannot perform transaction that would result in negative balance.`
        );
      }
      
      if (data.paymentMethod === 'BANK_DEPOSIT') {
        // Bank Deposit: Require bank account
        if (!data.bankAccountId) {
          throw new Error('Bank Account is required for Bank Deposit');
        }
        
        // Get bank account
        const bankAccount = await BankAccount.findByPk(data.bankAccountId, { transaction });
        if (!bankAccount) {
          throw new Error('Bank Account not found');
        }
        
        // Calculate new cash register balance (OUTFLOW decreases balance)
        const newCashBalance = lastBalance - outflowAmount;
        
        // Create cash register OUTFLOW transaction
        const cashTransaction = await CashRegister.create({
          ...data,
          registrationNumber,
          balance: newCashBalance,
        }, { transaction });
        
        // Update cash register master balance
        await cashRegisterMaster.update({
          balance: newCashBalance,
        }, { transaction });
        
        // Create bank register INFLOW transaction (money going into bank)
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
        
        const lastBankBalance = lastBankTransaction ? lastBankTransaction.balance : 0;
        const newBankBalance = lastBankBalance + parseFloat(data.amount);
        
        await BankRegister.create({
          registrationNumber: bankRegistrationNumber,
          registrationDate: data.registrationDate,
          transactionType: 'INFLOW',
          amount: data.amount,
          paymentMethod: 'BANK_DEPOSIT',
          relatedDocumentType: 'Cash Register Deposit',
          relatedDocumentNumber: registrationNumber,
          clientName: `From ${cashRegisterMaster.name}`,
          description: `Bank deposit from ${cashRegisterMaster.name} - ${data.description}`,
          balance: newBankBalance,
          bankAccountId: data.bankAccountId,
        }, { transaction });
        
        // Update bank account balance
        const newBankAccountBalance = parseFloat(bankAccount.balance.toString()) + parseFloat(data.amount);
        await bankAccount.update({
          balance: newBankAccountBalance,
        }, { transaction });
        
        if (shouldCommit) await transaction.commit();
        return cashTransaction;
        
      } else if (data.paymentMethod === 'CORRECTION') {
        // Correction: Just adjust balance
        // ✅ VALIDATION: Also check balance for corrections to prevent negative
        const correctionAmount = parseFloat(data.amount);
        const newBalance = lastBalance - correctionAmount;
        
        if (newBalance < 0) {
          throw new Error(
            `Correction would result in negative balance in cash register "${cashRegisterMaster.name}". ` +
            `Current balance: ${lastBalance.toFixed(2)}, Correction amount: ${correctionAmount.toFixed(2)}. ` +
            `Resulting balance would be: ${newBalance.toFixed(2)}. Cannot proceed.`
          );
        }
        
        const cashTransaction = await CashRegister.create({
          ...data,
          registrationNumber,
          balance: newBalance,
        }, { transaction });
        
        // Update cash register master balance
        await cashRegisterMaster.update({
          balance: newBalance,
        }, { transaction });
        
        if (shouldCommit) await transaction.commit();
        return cashTransaction;
        
      } else {
        throw new Error('OUTFLOW only allows BANK_DEPOSIT or CORRECTION payment methods');
      }
    }
    
    throw new Error('Invalid transaction type');
    
  } catch (error) {
    if (shouldCommit) await transaction.rollback();
    throw error;
  }
};

export const getCashBalance = async () => {
  const lastTransaction = await CashRegister.findOne({
    order: [['id', 'DESC']]
  });
  
  return {
    balance: lastTransaction ? lastTransaction.balance : 0,
    lastUpdate: lastTransaction ? lastTransaction.registrationDate : null,
  };
};

// Phase 3: Get balance for specific cash register
export const getCashRegisterBalance = async (cashRegisterId: number) => {
  const cashRegisterMaster = await CashRegisterMaster.findByPk(cashRegisterId);
  if (!cashRegisterMaster) {
    throw new Error('Cash Register not found');
  }
  
  return {
    balance: cashRegisterMaster.balance,
    cashRegisterName: cashRegisterMaster.name,
    location: cashRegisterMaster.location,
  };
};

// Get pending AR invoices for a customer - ONLY Credit Sales
// Get pending Credit Sale and Credit Card Sale invoices for customer
export const getPendingCreditSaleInvoices = async (customerId: number) => {
  const pendingInvoices = await AccountsReceivable.findAll({
    where: {
      clientId: customerId,
      type: {
        [Op.in]: ['CREDIT_SALE', 'CLIENT_CREDIT', 'DEBIT_CARD_SALE'] // Include both credit sales and card sales with customer info
      },
      status: {
        [Op.in]: ['Pending', 'Partial']
      }
    },
    order: [['registrationDate', 'ASC']]
  });
  
  return pendingInvoices;
};

export const deleteCashTransaction = async (id: number) => {
  const transaction = await CashRegister.findByPk(id);
  if (!transaction) throw new Error('Cash transaction not found');
  await transaction.destroy();
  return { message: 'Cash transaction deleted successfully' };
};
