import Card from '../models/Card';
import BankAccount from '../models/BankAccount';
import { Op } from 'sequelize';
import { BaseService } from '../core/BaseService';

/**
 * CardService
 * Manages credit and debit cards used by the business for payments.
 * Cards are linked to bank accounts (for debit cards) and have credit limits (for credit cards).
 * They are used in purchases, business expenses, and credit card register entries.
 */
class CardService extends BaseService {
  
  /**
   * Retrieves all cards with optional pagination and search.
   * Includes the linked bank account details for each card.
   * Searches across card code, name, last 4 digits, brand, and bank name.
   * Used by: Card list page, payment method dropdowns in expense/purchase forms.
   */
  async getAllCards(options: any = {}): Promise<any> {
    return this.executeWithRetry(async () => {
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
            // Include the linked bank account so the UI can show bank name and balance.
            model: BankAccount,
            as: 'BankAccount',
            attributes: ['id', 'bankName', 'accountNumber', 'balance'],
          }
        ]
      );
      return result;
    });
  }

  /**
   * Finds a single card by its database ID, including its linked bank account.
   * Used when editing a card or displaying card details.
   */
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

  /**
   * Creates a new card record.
   * Auto-generates a sequential code (CD0001, CD0002, ...) for internal reference.
   * Converts empty bankAccountId to null to avoid foreign key errors.
   * Sets creditLimit to 0 if not provided.
   */
  async createCard(data: any) {
    return this.executeWithRetry(async () => {
      // Find the last card to determine the next sequential code number.
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
      
      // Format: CD0001, CD0002, etc.
      const code = `CD${String(nextNumber).padStart(4, '0')}`;
      
      // Sanitize: empty string for bankAccountId would cause a DB foreign key error.
      const cleanData = {
        ...data,
        code,
        bankAccountId: data.bankAccountId === '' ? null : data.bankAccountId,
        creditLimit: data.creditLimit || 0,
      };
      
      return await Card.create(cleanData);
    });
  }

  /**
   * Updates an existing card's details (name, limit, status, etc.).
   * Sanitizes bankAccountId and creditLimit the same way as createCard.
   * Throws an error if the card does not exist.
   */
  async updateCard(id: number, data: any) {
    return this.executeWithRetry(async () => {
      const card = await Card.findByPk(id);
      if (!card) throw new Error('Card not found');
      
      const cleanData = {
        ...data,
        bankAccountId: data.bankAccountId === '' ? null : data.bankAccountId,
        creditLimit: data.creditLimit || 0,
      };
      
      return await card.update(cleanData);
    });
  }

  /**
   * Permanently deletes a card from the database.
   * Throws an error if the card does not exist.
   * Note: Do not delete cards that have transaction history in the Credit Card Register.
   */
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
