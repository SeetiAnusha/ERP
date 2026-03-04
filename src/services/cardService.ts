import Card from '../models/Card';
import BankAccount from '../models/BankAccount';
import { Op } from 'sequelize';

export const getAllCards = async () => {
  return await Card.findAll({
    include: [
      {
        model: BankAccount,
        as: 'BankAccount',
        attributes: ['id', 'bankName', 'accountNumber', 'balance'],
      }
    ],
    order: [['code', 'ASC']],
  });
};

export const getCardById = async (id: number) => {
  return await Card.findByPk(id, {
    include: [
      {
        model: BankAccount,
        as: 'BankAccount',
        attributes: ['id', 'bankName', 'accountNumber', 'balance'],
      }
    ],
  });
};

export const createCard = async (data: any) => {
  // Generate code (CD0001, CD0002, etc.)
  const lastCard = await Card.findOne({
    where: {
      code: {
        [Op.like]: 'CD%'
      }
    },
    order: [['id', 'DESC']],
  });
  
  let nextNumber = 1;
  if (lastCard) {
    const lastNumber = parseInt(lastCard.code.substring(2));
    nextNumber = lastNumber + 1;
  }
  
  const code = `CD${String(nextNumber).padStart(4, '0')}`;
  
  // Clean up data - convert empty strings to null for integer fields
  const cleanData = {
    ...data,
    code,
    bankAccountId: data.bankAccountId === '' ? null : data.bankAccountId,
    creditLimit: data.creditLimit || 0,
  };
  
  return await Card.create(cleanData);
};

export const updateCard = async (id: number, data: any) => {
  const card = await Card.findByPk(id);
  if (!card) throw new Error('Card not found');
  
  // Clean up data - convert empty strings to null for integer fields
  const cleanData = {
    ...data,
    bankAccountId: data.bankAccountId === '' ? null : data.bankAccountId,
    creditLimit: data.creditLimit || 0,
  };
  
  return await card.update(cleanData);
};

export const deleteCard = async (id: number) => {
  const card = await Card.findByPk(id);
  if (!card) throw new Error('Card not found');
  await card.destroy();
  return { message: 'Card deleted successfully' };
};
