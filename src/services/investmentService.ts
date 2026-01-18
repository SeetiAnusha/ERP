import Investment from '../models/Investment';

export const getAllInvestments = async () => {
  return await Investment.findAll({ order: [['createdAt', 'DESC']] });
};

export const getInvestmentById = async (id: number) => {
  return await Investment.findByPk(id);
};

export const createInvestment = async (data: any) => {
  return await Investment.create(data);
};

export const updateInvestment = async (id: number, data: any) => {
  const investment = await Investment.findByPk(id);
  if (!investment) throw new Error('Investment not found');
  return await investment.update(data);
};

export const deleteInvestment = async (id: number) => {
  const investment = await Investment.findByPk(id);
  if (!investment) throw new Error('Investment not found');
  await investment.destroy();
  return { message: 'Investment deleted successfully' };
};
