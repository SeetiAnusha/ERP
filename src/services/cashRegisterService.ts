import CashRegister from '../models/CashRegister';
import { Op } from 'sequelize';

export const getAllCashTransactions = async () => {
  return await CashRegister.findAll({ order: [['registrationDate', 'DESC']] });
};

export const getCashTransactionById = async (id: number) => {
  return await CashRegister.findByPk(id);
};

export const createCashTransaction = async (data: any) => {
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
  
  const lastBalance = lastTransaction ? lastTransaction.balance : 0;
  const newBalance = data.transactionType === 'INFLOW' 
    ? lastBalance + parseFloat(data.amount)
    : lastBalance - parseFloat(data.amount);
  
  return await CashRegister.create({
    ...data,
    registrationNumber,
    balance: newBalance,
  });
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

export const deleteCashTransaction = async (id: number) => {
  const transaction = await CashRegister.findByPk(id);
  if (!transaction) throw new Error('Cash transaction not found');
  await transaction.destroy();
  return { message: 'Cash transaction deleted successfully' };
};
