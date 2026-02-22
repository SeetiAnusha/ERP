import AccountsReceivable from '../models/AccountsReceivable';
import { Op } from 'sequelize';
import sequelize from '../config/database';

export const getAllAccountsReceivable = async () => {
  return await AccountsReceivable.findAll({
    order: [['registrationDate', 'DESC']],
  });
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

export const recordPayment = async (id: number, paymentData: { amount: number; receivedDate?: Date; notes?: string }) => {
  const transaction = await sequelize.transaction();
  let committed = false;
  
  try {
    const ar = await AccountsReceivable.findByPk(id, { transaction });
    if (!ar) throw new Error('Accounts Receivable not found');
    
    const newReceivedAmount = Number(ar.receivedAmount) + paymentData.amount;
    const newBalanceAmount = Number(ar.amount) - newReceivedAmount;
    
    let status = 'Pending';
    if (newReceivedAmount >= Number(ar.amount)) {
      status = 'Received';
    } else if (newReceivedAmount > 0) {
      status = 'Partial';
    }
    
    await ar.update({
      receivedAmount: newReceivedAmount,
      balanceAmount: newBalanceAmount,
      status,
      receivedDate: status === 'Received' ? (paymentData.receivedDate || new Date()) : ar.receivedDate,
      notes: paymentData.notes || ar.notes,
    }, { transaction });
    
    await transaction.commit();
    committed = true;
    
    return ar;
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
