import BankRegister from '../models/BankRegister';
import { Op } from 'sequelize';

export const getAllBankRegisters = async () => {
  return await BankRegister.findAll({
    order: [['registrationDate', 'DESC']],
  });
};

export const getBankRegisterById = async (id: number) => {
  return await BankRegister.findByPk(id);
};

export const createBankRegister = async (data: any) => {
  // Generate registration number
  const lastRegister = await BankRegister.findOne({
    where: { registrationNumber: { [Op.like]: 'BR%' } },
    order: [['id', 'DESC']],
  });
  
  let nextNumber = 1;
  if (lastRegister) {
    const lastNumber = parseInt(lastRegister.registrationNumber.substring(2));
    nextNumber = lastNumber + 1;
  }
  
  const registrationNumber = `BR${String(nextNumber).padStart(4, '0')}`;
  
  // Calculate new balance
  const lastBalance = lastRegister ? Number(lastRegister.balance) : 0;
  const newBalance = data.transactionType === 'INFLOW' 
    ? lastBalance + Number(data.amount)
    : lastBalance - Number(data.amount);
  
  return await BankRegister.create({
    ...data,
    registrationNumber,
    balance: newBalance,
  });
};

export const deleteBankRegister = async (id: number) => {
  const register = await BankRegister.findByPk(id);
  if (!register) throw new Error('Bank register entry not found');
  await register.destroy();
  return { message: 'Bank register entry deleted successfully' };
};
