import AccountsPayable from '../models/AccountsPayable';
import Purchase from '../models/Purchase';
import Supplier from '../models/Supplier';
import { Op } from 'sequelize';
import sequelize from '../config/database';
import { TransactionType } from '../types/TransactionType';

export const getAllAccountsPayable = async () => {
  const aps = await AccountsPayable.findAll({
    order: [['registrationDate', 'DESC']],
  });
  
  // Return AP data as-is (already has all fields from database)
  return aps.map(ap => ap.toJSON());
};

export const getAccountsPayableById = async (id: number) => {
  return await AccountsPayable.findByPk(id);
};

export const getPendingAccountsPayable = async () => {
  return await AccountsPayable.findAll({
    where: {
      status: {
        [Op.in]: ['Pending', 'Partial']
      }
    },
    order: [['dueDate', 'ASC']],
  });
};

export const createAccountsPayable = async (data: any) => {
  const transaction = await sequelize.transaction();
  let committed = false;
  
  try {
    // Generate registration number (AP format)
    const lastAP = await AccountsPayable.findOne({
      where: {
        registrationNumber: {
          [Op.like]: 'AP%'
        }
      },
      order: [['id', 'DESC']],
      transaction
    });
    
    let nextNumber = 1;
    if (lastAP) {
      const lastNumber = parseInt(lastAP.registrationNumber.substring(2));
      nextNumber = lastNumber + 1;
    }
    
    const registrationNumber = `AP${String(nextNumber).padStart(4, '0')}`;
    
    const accountsPayable = await AccountsPayable.create({
      ...data,
      registrationNumber,
      registrationDate: new Date(),
      paidAmount: 0,
      balanceAmount: data.amount,
      status: 'Pending',
    }, { transaction });
    
    await transaction.commit();
    committed = true;
    
    return accountsPayable;
  } catch (error) {
    if (!committed) {
      await transaction.rollback();
    }
    throw error;
  }
};

export const recordPayment = async (id: number, paymentData: { 
  amount: number; 
  paidDate?: Date; 
  notes?: string;
  cardId?: number;
  paymentMethod?: string;
  bankAccountId?: number;
  reference?: string;
  description?: string;
}) => {
  const transaction = await sequelize.transaction();
  let committed = false;
  
  try {
    const ap = await AccountsPayable.findByPk(id, { transaction });
    if (!ap) throw new Error('Accounts Payable not found');
    
    // ✅ NEW: Handle bank account payments for credit card bills
    if (paymentData.bankAccountId && paymentData.paymentMethod === 'BANK_TRANSFER') {
      const BankAccount = (await import('../models/BankAccount')).default;
      const BankRegister = (await import('../models/BankRegister')).default;
      const Card = (await import('../models/Card')).default;
      
      const bankAccount = await BankAccount.findByPk(paymentData.bankAccountId, { transaction });
      if (!bankAccount) {
        throw new Error('Selected bank account not found');
      }
      
      const paymentAmount = paymentData.amount;
      const currentBalance = Number(bankAccount.balance);
      
      // Validate sufficient balance
      if (currentBalance < paymentAmount) {
        throw new Error(
          `Insufficient balance in bank account ${bankAccount.bankName} - ${bankAccount.accountNumber}. ` +
          `Available: $${currentBalance.toFixed(2)}, Required: $${paymentAmount.toFixed(2)}. ` +
          `You need $${(paymentAmount - currentBalance).toFixed(2)} more to complete this payment.`
        );
      }
      
      // Deduct from bank account
      const newBankBalance = currentBalance - paymentAmount;
      await bankAccount.update({ balance: newBankBalance }, { transaction });
      
      // If this is a credit card payment, restore credit limit
      if (ap.type === 'CREDIT_CARD_PURCHASE' && ap.cardId) {
        const card = await Card.findByPk(ap.cardId, { transaction });
        if (card && card.cardType === 'CREDIT') {
          const usedCredit = Number(card.usedCredit || 0);
          const newUsedCredit = Math.max(0, usedCredit - paymentAmount);
          
          await card.update({ usedCredit: newUsedCredit }, { transaction });
          
          console.log(`✅ Credit restored via bank payment: $${usedCredit.toFixed(2)} -> $${newUsedCredit.toFixed(2)}`);
        }
      }
      
      // Create Bank Register entry
      const lastBankTransaction = await BankRegister.findOne({
        order: [['id', 'DESC']],
        transaction
      });
      
      const lastBalance = lastBankTransaction ? Number(lastBankTransaction.balance) : 0;
      const newBalance = lastBalance - paymentAmount;
      
      await BankRegister.create({
        registrationNumber: ap.registrationNumber,
        registrationDate: paymentData.paidDate || new Date(),
        transactionType: 'OUTFLOW',
        amount: paymentAmount,
        paymentMethod: 'Bank Transfer',
        relatedDocumentType: 'Accounts Payable Payment',
        relatedDocumentNumber: ap.registrationNumber,
        clientRnc: ap.supplierRnc || '',
        clientName: ap.supplierName || ap.cardIssuer || '',
        ncf: ap.ncf || '',
        description: paymentData.description || `AP Payment ${ap.registrationNumber} - ${ap.supplierName || ap.cardIssuer}`,
        balance: newBalance,
        bankAccountId: paymentData.bankAccountId,
        referenceNumber: paymentData.reference || undefined,
      }, { transaction });
    }
    
    // ✅ VALIDATION: If paying with card, validate balance/limit
    if (paymentData.cardId) {
      const Card = (await import('../models/Card')).default;
      const BankAccount = (await import('../models/BankAccount')).default;
      const BankRegister = (await import('../models/BankRegister')).default;
      
      const card = await Card.findByPk(paymentData.cardId, { transaction });
      if (!card) {
        throw new Error('Card not found');
      }
      
      const paymentAmount = paymentData.amount;
      
      if (card.cardType === 'DEBIT') {
        // DEBIT Card: Must have bank account and sufficient balance
        if (!card.bankAccountId) {
          throw new Error(
            `DEBIT card ****${card.cardNumberLast4} is not linked to a bank account. ` +
            `Please link this card to a bank account before making payments.`
          );
        }
        
        const bankAccount = await BankAccount.findByPk(card.bankAccountId, { transaction });
        if (!bankAccount) {
          throw new Error(
            `Bank account not found for DEBIT card ****${card.cardNumberLast4}. ` +
            `Please check card configuration.`
          );
        }
        
        // Validate balance
        const currentBalance = Number(bankAccount.balance);
        if (currentBalance < paymentAmount) {
          throw new Error(
            `Insufficient balance in bank account linked to DEBIT card ****${card.cardNumberLast4}. ` +
            `Available: $${currentBalance.toFixed(2)}, Required: $${paymentAmount.toFixed(2)}. ` +
            `You need $${(paymentAmount - currentBalance).toFixed(2)} more to complete this payment.`
          );
        }
        
        // Deduct from bank account
        const newBankBalance = currentBalance - paymentAmount;
        await bankAccount.update({ balance: newBankBalance }, { transaction });
        
        // Create Bank Register entry
        const lastBankTransaction = await BankRegister.findOne({
          order: [['id', 'DESC']],
          transaction
        });
        
        const lastBalance = lastBankTransaction ? Number(lastBankTransaction.balance) : 0;
        const newBalance = lastBalance - paymentAmount;
        
        await BankRegister.create({
          registrationNumber: ap.registrationNumber,
          registrationDate: new Date(),
          transactionType: 'OUTFLOW',
          amount: paymentAmount,
          paymentMethod: 'Debit Card',
          relatedDocumentType: 'Accounts Payable Payment',
          relatedDocumentNumber: ap.registrationNumber,
          clientRnc: ap.supplierRnc || '',
          clientName: ap.supplierName || '',
          ncf: ap.ncf || '',
          description: `AP Payment ${ap.registrationNumber} via DEBIT card ${card.cardBrand || ''} ****${card.cardNumberLast4} - Bank: ${bankAccount.bankName} (${bankAccount.accountNumber})`,
          balance: newBalance,
          bankAccountId: card.bankAccountId,
        }, { transaction });
        
      } else if (card.cardType === 'CREDIT') {
        // ✅ FIX: Don't create duplicate AP if already paying credit card debt
        const isAlreadyCreditCardDebt = ap.type === 'CREDIT_CARD_PURCHASE';
        
        if (!isAlreadyCreditCardDebt) {
          // Paying supplier AP with credit card - track usedCredit
          const creditLimit = Number(card.creditLimit || 0);
          const usedCredit = Number(card.usedCredit || 0);
          const availableCredit = creditLimit - usedCredit;
          
          if (creditLimit <= 0) {
            throw new Error(
              `CREDIT card ****${card.cardNumberLast4} has no credit limit set. ` +
              `Please set a credit limit for this card before making payments.`
            );
          }
          
          // Validate available credit
          if (paymentAmount > availableCredit) {
            throw new Error(
              `Insufficient credit available on card ****${card.cardNumberLast4}. ` +
              `Available: ${availableCredit.toFixed(2)}, Required: ${paymentAmount.toFixed(2)}. ` +
              `Credit Limit: ${creditLimit.toFixed(2)}, Currently Used: ${usedCredit.toFixed(2)}.`
            );
          }
          
          // Increase usedCredit
          const newUsedCredit = usedCredit + paymentAmount;
          await card.update({ usedCredit: newUsedCredit }, { transaction });
          
          console.log(`Credit card usage: ${usedCredit.toFixed(2)} -> ${newUsedCredit.toFixed(2)}`);
          
          // For CREDIT card, create a new AP entry (paying one AP with credit creates another AP)
        // This represents the debt to the credit card company
        const newAP = await AccountsPayable.create({
          registrationNumber: `${ap.registrationNumber}-CC`,
          registrationDate: new Date(),
          type: 'CREDIT_CARD_PURCHASE',
          sourceTransactionType: TransactionType.PAYMENT, // NEW FIELD
          relatedDocumentType: 'AP Payment',
          relatedDocumentId: ap.id,
          relatedDocumentNumber: ap.registrationNumber,
          supplierName: `Credit Card Company (${card.cardBrand || 'Card'} ****${card.cardNumberLast4})`,
          supplierRnc: '',
          ncf: '',
          purchaseDate: new Date(),
          purchaseType: 'Service',
          paymentType: 'CREDIT_CARD',
          cardIssuer: `${card.cardBrand || 'Card'} ****${card.cardNumberLast4}`,
          cardId: card.id, // ✅ Store which card was used
          amount: paymentAmount,
          paidAmount: 0,
          balanceAmount: paymentAmount,
          status: 'Pending',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          notes: `Payment for AP ${ap.registrationNumber} using CREDIT card - Now owe credit card company`,
        }, { transaction });
        } else {
          // ✅ Paying credit card debt - RESTORE credit limit
          const usedCredit = Number(card.usedCredit || 0);
          const newUsedCredit = Math.max(0, usedCredit - paymentAmount);
          
          await card.update({ usedCredit: newUsedCredit }, { transaction });
          
          console.log(`✅ Credit restored: $${usedCredit.toFixed(2)} -> $${newUsedCredit.toFixed(2)}`);
          console.log(`✅ Available credit: $${(Number(card.creditLimit) - usedCredit).toFixed(2)} -> $${(Number(card.creditLimit) - newUsedCredit).toFixed(2)}`);
        }
      }
    }
    
    // Update the original AP
    const newPaidAmount = Number(ap.paidAmount) + paymentData.amount;
    const newBalanceAmount = Number(ap.amount) - newPaidAmount;
    
    let status = 'Pending';
    if (newPaidAmount >= Number(ap.amount)) {
      status = 'Paid';
    } else if (newPaidAmount > 0) {
      status = 'Partial';
    }
    
    await ap.update({
      paidAmount: newPaidAmount,
      balanceAmount: newBalanceAmount,
      status,
      paidDate: status === 'Paid' ? (paymentData.paidDate || new Date()) : ap.paidDate,
      notes: paymentData.description || paymentData.notes || ap.notes,
    }, { transaction });
    
    await transaction.commit();
    committed = true;
    
    return ap;
  } catch (error) {
    if (!committed) {
      await transaction.rollback();
    }
    throw error;
  }
};

export const deleteAccountsPayable = async (id: number) => {
  const ap = await AccountsPayable.findByPk(id);
  if (!ap) throw new Error('Accounts Payable not found');
  
  await ap.destroy();
  return { message: 'Accounts Payable deleted successfully' };
};

export const updateAccountsPayable = async (id: number, data: any) => {
  const ap = await AccountsPayable.findByPk(id);
  if (!ap) throw new Error('Accounts Payable not found');
  
  return await ap.update(data);
};
