import PrepaidExpense from '../models/PrepaidExpense';

export const getAllPrepaidExpenses = async () => {
  return await PrepaidExpense.findAll({ order: [['createdAt', 'DESC']] });
};

export const getPrepaidExpenseById = async (id: number) => {
  return await PrepaidExpense.findByPk(id);
};

export const createPrepaidExpense = async (data: any) => {
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  const months = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
  
  const monthlyAmortization = data.totalAmount / months;
  const remainingAmount = data.totalAmount - (data.amortizedAmount || 0);
  
  return await PrepaidExpense.create({
    ...data,
    monthlyAmortization,
    remainingAmount,
  });
};

export const updatePrepaidExpense = async (id: number, data: any) => {
  const expense = await PrepaidExpense.findByPk(id);
  if (!expense) throw new Error('Prepaid expense not found');
  
  if (data.totalAmount || data.amortizedAmount) {
    const totalAmount = data.totalAmount || expense.totalAmount;
    const amortizedAmount = data.amortizedAmount || expense.amortizedAmount;
    data.remainingAmount = totalAmount - amortizedAmount;
  }
  
  return await expense.update(data);
};

export const deletePrepaidExpense = async (id: number) => {
  const expense = await PrepaidExpense.findByPk(id);
  if (!expense) throw new Error('Prepaid expense not found');
  await expense.destroy();
  return { message: 'Prepaid expense deleted successfully' };
};
