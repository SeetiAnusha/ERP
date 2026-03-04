import CashRegister from '../models/CashRegister';
import CashRegisterMaster from '../models/CashRegisterMaster';
import BankAccount from '../models/BankAccount';
import BankRegister from '../models/BankRegister';
import AccountsReceivable from '../models/AccountsReceivable';
import { Op } from 'sequelize';
import sequelize from '../config/database';

export const getAllCashTransactions = async () => {
  return await CashRegister.findAll({ order: [['registrationDate', 'DESC']] });
};

export const getCashTransactionById = async (id: number) => {
  return await CashRegister.findByPk(id);
};

export const createCashTransaction = async (data: any) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Phase 3: Validate cashRegisterId is provided
    if (!data.cashRegisterId) {
      throw new Error('Cash Register selection is required');
    }

    // Get cash register master
    const cashRegisterMaster = await CashRegisterMaster.findByPk(data.cashRegisterId);
    if (!cashRegisterMaster) {
      throw new Error('Cash Register not found');
    }

    // Generate registration number
    const lastTransaction = await CashRegister.findOne({
      where: {
        registrationNumber: {
          [Op.like]: 'CJ%'
        }
      },
      order: [['id', 'DESC']]
    });
    
    let nextNumber = 1;
    if (lastTransaction) {
      const lastNumber = parseInt(lastTransaction.registrationNumber.substring(2));
      nextNumber = lastNumber + 1;
    }
    
    const registrationNumber = `CJ${String(nextNumber).padStart(4, '0')}`;
    
    // Get last balance for this specific cash register
    const lastRegisterTransaction = await CashRegister.findOne({
      where: { cashRegisterId: data.cashRegisterId },
      order: [['id', 'DESC']]
    });
    
    const lastBalance = lastRegisterTransaction 
      ? parseFloat(lastRegisterTransaction.balance.toString()) 
      : parseFloat(cashRegisterMaster.balance.toString());
    
    // Phase 3: Handle different transaction types
    if (data.transactionType === 'INFLOW') {
      // INFLOW: Money coming into cash register
      // Validate based on relatedDocumentType
      if (data.relatedDocumentType === 'AR_COLLECTION') {
        // AR Collection: Require customer and invoices
        if (!data.customerId) {
          throw new Error('Customer is required for AR Collection');
        }
        if (!data.invoiceIds || data.invoiceIds.length === 0) {
          throw new Error('At least one invoice must be selected for AR Collection');
        }
        
        // Update AR invoices
        const invoiceIdsArray = JSON.parse(data.invoiceIds);
        for (const invoiceId of invoiceIdsArray) {
          const arInvoice = await AccountsReceivable.findByPk(invoiceId);
          if (arInvoice) {
            const receivedAmount = parseFloat(arInvoice.receivedAmount.toString()) + parseFloat(data.amount);
            const balanceAmount = parseFloat(arInvoice.amount.toString()) - receivedAmount;
            const status = balanceAmount <= 0 ? 'Received' : 'Partial';  // Fixed: Use correct status values
            
            await arInvoice.update({
              receivedAmount,
              balanceAmount,
              status,
            }, { transaction });
          }
        }
      }
      
      // Calculate new balance (INFLOW increases balance)
      const newBalance = lastBalance + parseFloat(data.amount);
      
      // Create cash register transaction
      const cashTransaction = await CashRegister.create({
        ...data,
        registrationNumber,
        balance: newBalance,
      }, { transaction });
      
      // Update cash register master balance
      await cashRegisterMaster.update({
        balance: newBalance,
      }, { transaction });
      
      await transaction.commit();
      return cashTransaction;
      
    } else if (data.transactionType === 'OUTFLOW') {
      // OUTFLOW: Money leaving cash register
      // Phase 3: Only allow BANK_DEPOSIT or CORRECTION
      
      if (data.paymentMethod === 'BANK_DEPOSIT') {
        // Bank Deposit: Require bank account
        if (!data.bankAccountId) {
          throw new Error('Bank Account is required for Bank Deposit');
        }
        
        // Get bank account
        const bankAccount = await BankAccount.findByPk(data.bankAccountId);
        if (!bankAccount) {
          throw new Error('Bank Account not found');
        }
        
        // Calculate new cash register balance (OUTFLOW decreases balance)
        const newCashBalance = lastBalance - parseFloat(data.amount);
        
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
          order: [['id', 'DESC']]
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
        
        await transaction.commit();
        return cashTransaction;
        
      } else if (data.paymentMethod === 'CORRECTION') {
        // Correction: Just adjust balance
        const newBalance = lastBalance - parseFloat(data.amount);
        
        const cashTransaction = await CashRegister.create({
          ...data,
          registrationNumber,
          balance: newBalance,
        }, { transaction });
        
        // Update cash register master balance
        await cashRegisterMaster.update({
          balance: newBalance,
        }, { transaction });
        
        await transaction.commit();
        return cashTransaction;
        
      } else {
        throw new Error('OUTFLOW only allows BANK_DEPOSIT or CORRECTION payment methods');
      }
    }
    
    throw new Error('Invalid transaction type');
    
  } catch (error) {
    await transaction.rollback();
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

// Phase 3: Get pending AR invoices for a customer
export const getPendingARInvoices = async (customerId: number) => {
  const pendingInvoices = await AccountsReceivable.findAll({
    where: {
      clientId: customerId,
      status: {
        [Op.in]: ['Pending', 'Partial']  // Fixed: Status values are capitalized in the model
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
