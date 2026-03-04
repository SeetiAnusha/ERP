import Financer from '../models/Financer';
import { Op } from 'sequelize';

export const getAllFinancers = async () => {
  return await Financer.findAll({
    order: [['code', 'ASC']],
  });
};

export const getFinancerById = async (id: number) => {
  return await Financer.findByPk(id);
};

export const createFinancer = async (data: any) => {
  // Generate code (FN0001, FN0002, etc.)
  const lastFinancer = await Financer.findOne({
    where: {
      code: {
        [Op.like]: 'FN%'
      }
    },
    order: [['id', 'DESC']],
  });
  
  let nextNumber = 1;
  if (lastFinancer) {
    const lastNumber = parseInt(lastFinancer.code.substring(2));
    nextNumber = lastNumber + 1;
  }
  
  const code = `FN${String(nextNumber).padStart(4, '0')}`;
  
  return await Financer.create({
    ...data,
    code,
  });
};

export const updateFinancer = async (id: number, data: any) => {
  const financer = await Financer.findByPk(id);
  if (!financer) throw new Error('Financer not found');
  return await financer.update(data);
};

export const deleteFinancer = async (id: number) => {
  const financer = await Financer.findByPk(id);
  if (!financer) throw new Error('Financer not found');
  await financer.destroy();
  return { message: 'Financer deleted successfully' };
};
