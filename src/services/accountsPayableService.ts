import AccountsPayable from '../models/AccountsPayable';
import Purchase from '../models/Purchase';
import Supplier from '../models/Supplier';
import { Op } from 'sequelize';
import sequelize from '../config/database';

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

export const recordPayment = async (id: number, paymentData: { amount: number; paidDate?: Date; notes?: string }) => {
  const transaction = await sequelize.transaction();
  let committed = false;
  
  try {
    const ap = await AccountsPayable.findByPk(id, { transaction });
    if (!ap) throw new Error('Accounts Payable not found');
    
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
      notes: paymentData.notes || ap.notes,
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
