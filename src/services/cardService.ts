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
  
  return await Card.create({
    ...data,
    code,
  });
};

export const updateCard = async (id: number, data: any) => {
  const card = await Card.findByPk(id);
  if (!card) throw new Error('Card not found');
  return await card.update(data);
};

export const deleteCard = async (id: number) => {
  const card = await Card.findByPk(id);
  if (!card) throw new Error('Card not found');
  await card.destroy();
  return { message: 'Card deleted successfully' };
};
