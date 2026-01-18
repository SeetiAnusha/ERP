import Adjustment from '../models/Adjustment';
import { Op } from 'sequelize';

export const getAllAdjustments = async () => {
  return await Adjustment.findAll({ order: [['registrationDate', 'DESC']] });
};

export const getAdjustmentById = async (id: number) => {
  return await Adjustment.findByPk(id);
};

export const createAdjustment = async (data: any) => {
  // Determine prefix based on adjustment type
  let prefix = 'AJ'; // Default to Adjustment
  if (data.type === 'Debit Note') {
    prefix = 'ND';
  } else if (data.type === 'Credit Note') {
    prefix = 'NC';
  }
  
  // Find last adjustment with same prefix
  const lastAdjustment = await Adjustment.findOne({
    where: {
      registrationNumber: {
        [Op.like]: `${prefix}%`
      }
    },
    order: [['id', 'DESC']]
  });
  
  let nextNumber = 1;
  if (lastAdjustment) {
    const lastNumber = parseInt(lastAdjustment.registrationNumber.substring(2));
    nextNumber = lastNumber + 1;
  }
  
  const registrationNumber = `${prefix}${String(nextNumber).padStart(4, '0')}`;
  
  return await Adjustment.create({
    ...data,
    registrationNumber,
  });
};

export const updateAdjustment = async (id: number, data: any) => {
  const adjustment = await Adjustment.findByPk(id);
  if (!adjustment) throw new Error('Adjustment not found');
  return await adjustment.update(data);
};

export const deleteAdjustment = async (id: number) => {
  const adjustment = await Adjustment.findByPk(id);
  if (!adjustment) throw new Error('Adjustment not found');
  await adjustment.destroy();
  return { message: 'Adjustment deleted successfully' };
};
