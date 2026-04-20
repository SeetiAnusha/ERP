import Card from '../models/Card';
import BankAccount from '../models/BankAccount';
import { Op } from 'sequelize';
import { BaseService } from '../core/BaseService';

class CardService extends BaseService {
  
  async getAllCards(options: any = {}): Promise<any> {
    return this.executeWithRetry(async () => {
      // Use generic pagination from BaseService
      const result = await this.getAllWithPagination(
        Card,
        {
          ...options,
          searchFields: ['code', 'cardName', 'cardNumberLast4', 'cardBrand', 'bankName'],
          dateField: 'createdAt'
        },
        {},
        [
          {
            model: BankAccount,
            as: 'BankAccount',
            attributes: ['id', 'bankName', 'accountNumber', 'balance'],
          }
        ]
      );
      return result;
    });
  }

  async getCardById(id: number) {
    return await Card.findByPk(id, {
      include: [
        {
          model: BankAccount,
          as: 'BankAccount',
          attributes: ['id', 'bankName', 'accountNumber', 'balance'],
        }
      ],
    });
  }

  async createCard(data: any) {
    return this.executeWithRetry(async () => {
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
    });
  }

  async updateCard(id: number, data: any) {
    return this.executeWithRetry(async () => {
      const card = await Card.findByPk(id);
      if (!card) throw new Error('Card not found');
      
      // Clean up data - convert empty strings to null for integer fields
      const cleanData = {
        ...data,
        bankAccountId: data.bankAccountId === '' ? null : data.bankAccountId,
        creditLimit: data.creditLimit || 0,
      };
      
      return await card.update(cleanData);
    });
  }

  async deleteCard(id: number) {
    const card = await Card.findByPk(id);
    if (!card) throw new Error('Card not found');
    await card.destroy();
    return { message: 'Card deleted successfully' };
  }
}

const cardService = new CardService();

export const getAllCards = (options?: any) => cardService.getAllCards(options);
export const getAllCardsWithPagination = (options?: any) => cardService.getAllCards(options);
export const getCardById = (id: number) => cardService.getCardById(id);
export const createCard = (data: any) => cardService.createCard(data);
export const updateCard = (id: number, data: any) => cardService.updateCard(id, data);
export const deleteCard = (id: number) => cardService.deleteCard(id);
