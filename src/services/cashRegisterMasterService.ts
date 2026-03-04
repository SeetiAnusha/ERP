import CashRegisterMaster from '../models/CashRegisterMaster';
import { Op } from 'sequelize';

export const getAllCashRegisterMasters = async () => {
  return await CashRegisterMaster.findAll({
    order: [['code', 'ASC']],
  });
};

export const getCashRegisterMasterById = async (id: number) => {
  return await CashRegisterMaster.findByPk(id);
};

export const createCashRegisterMaster = async (data: any) => {
  // Generate code (CR0001, CR0002, etc.)
  const lastRegister = await CashRegisterMaster.findOne({
    where: {
      code: {
        [Op.like]: 'CR%'
      }
    },
    order: [['id', 'DESC']],
  });
  
  let nextNumber = 1;
  if (lastRegister) {
    const lastNumber = parseInt(lastRegister.code.substring(2));
    nextNumber = lastNumber + 1;
  }
  
  const code = `CR${String(nextNumber).padStart(4, '0')}`;
  
  return await CashRegisterMaster.create({
    ...data,
    code,
  });
};

export const updateCashRegisterMaster = async (id: number, data: any) => {
  const register = await CashRegisterMaster.findByPk(id);
  if (!register) throw new Error('Cash Register not found');
  return await register.update(data);
};

export const deleteCashRegisterMaster = async (id: number) => {
  const register = await CashRegisterMaster.findByPk(id);
  if (!register) throw new Error('Cash Register not found');
  await register.destroy();
  return { message: 'Cash Register deleted successfully' };
};
