import BankAccount from '../models/BankAccount';
import { Op } from 'sequelize';

export const getAllBankAccounts = async () => {
  return await BankAccount.findAll({
    order: [['code', 'ASC']],
  });
};

export const getBankAccountById = async (id: number) => {
  return await BankAccount.findByPk(id);
};

export const createBankAccount = async (data: any) => {
  // Generate code (BA0001, BA0002, etc.)
  const lastAccount = await BankAccount.findOne({
    where: {
      code: {
        [Op.like]: 'BA%'
      }
    },
    order: [['id', 'DESC']],
  });
  
  let nextNumber = 1;
  if (lastAccount) {
    const lastNumber = parseInt(lastAccount.code.substring(2));
    nextNumber = lastNumber + 1;
  }
  
  const code = `BA${String(nextNumber).padStart(4, '0')}`;
  
  return await BankAccount.create({
    ...data,
    code,
  });
};

export const updateBankAccount = async (id: number, data: any) => {
  const account = await BankAccount.findByPk(id);
  if (!account) throw new Error('Bank Account not found');
  return await account.update(data);
};

export const deleteBankAccount = async (id: number) => {
  const account = await BankAccount.findByPk(id);
  if (!account) throw new Error('Bank Account not found');
  await account.destroy();
  return { message: 'Bank Account deleted successfully' };
};
