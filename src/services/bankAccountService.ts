import BankAccount from '../models/BankAccount';
import { Op } from 'sequelize';
import { BaseService } from '../core/BaseService';

/**
 * BankAccountService
 * Manages the company's bank accounts.
 * Bank accounts are used to track money held in banks and are linked to
 * payments, purchases, expenses, and credit card settlements.
 */
class BankAccountService extends BaseService {
  
  /**
   * Retrieves all bank accounts with optional pagination and search.
   * Searches across account code, bank name, and account number.
   * Used by: Bank Account list page, payment method dropdowns throughout the system.
   */
  async getAllBankAccounts(options: any = {}): Promise<any> {
    return this.executeWithRetry(async () => {
      const result = await this.getAllWithPagination(
        BankAccount,
        {
          ...options,
          searchFields: ['code', 'bankName', 'accountNumber'],
          dateField: 'createdAt'
        }
      );
      return result;
    });
  }

  /**
   * Finds a single bank account by its database ID.
   * Used when processing payments or displaying account details.
   */
  async getBankAccountById(id: number) {
    return await BankAccount.findByPk(id);
  }

  /**
   * Creates a new bank account record.
   * Validates that the account number is exactly 4 digits (last 4 digits of the real account).
   * Auto-generates a sequential code (BA0001, BA0002, ...) for internal reference.
   */
  async createBankAccount(data: any) {
    return this.executeWithRetry(async () => {
      // Only the last 4 digits are stored for security — full account numbers are never saved.
      if (!data.accountNumber || !/^\d{4}$/.test(data.accountNumber)) {
        throw new Error('Account number must be exactly 4 digits (last 4 digits of your account)');
      }
      
      // Find the last created account to determine the next sequential code number.
      const lastAccount = await BankAccount.findOne({
        where: {
          code: {
            [Op.like]: 'BA%'
          }
        },
        order: [['id', 'DESC']],
      });
      
      let nextNumber = 1;
      if (lastAccount) {
        const lastNumber = parseInt(lastAccount.code.substring(2));
        nextNumber = lastNumber + 1;
      }
      
      // Format: BA0001, BA0002, etc.
      const code = `BA${String(nextNumber).padStart(4, '0')}`;
      
      return await BankAccount.create({
        ...data,
        code,
      });
    });
  }

  /**
   * Updates an existing bank account's details.
   * Re-validates the account number format if it is being changed.
   * Throws an error if the account does not exist.
   */
  async updateBankAccount(id: number, data: any) {
    return this.executeWithRetry(async () => {
      if (data.accountNumber && !/^\d{4}$/.test(data.accountNumber)) {
        throw new Error('Account number must be exactly 4 digits (last 4 digits of your account)');
      }
      
      const account = await BankAccount.findByPk(id);
      if (!account) throw new Error('Bank Account not found');
      return await account.update(data);
    });
  }

  /**
   * Permanently deletes a bank account.
   * Throws an error if the account does not exist.
   * Note: Do not delete accounts that have transaction history in the Bank Register.
   */
  async deleteBankAccount(id: number) {
    const account = await BankAccount.findByPk(id);
    if (!account) throw new Error('Bank Account not found');
    await account.destroy();
    return { message: 'Bank Account deleted successfully' };
  }

  /**
   * Adds amount to bank account balance (for sales, deposits, inflows).
   * Used by: Sales service, payment receipts, deposits.
   * Accepts external transaction to participate in larger transactions.
   */
  async addBalance(bankAccountId: number, amount: number, externalTransaction?: any) {
    return this.executeWithTransaction(async (transaction) => {
      const account = await BankAccount.findByPk(bankAccountId, { transaction });
      if (!account) throw new Error('Bank Account not found');
      
      const currentBalance = Number(account.balance);
      const newBalance = currentBalance + amount;
      
      await account.update({ balance: newBalance }, { transaction });
      return { bankAccountId, previousBalance: currentBalance, newBalance, amountAdded: amount };
    }, externalTransaction);
  }

  /**
   * Subtracts amount from bank account balance (for purchases, payments, outflows).
   * Used by: Purchase service, expense payments, withdrawals.
   * Accepts external transaction to participate in larger transactions.
   */
  async subtractBalance(bankAccountId: number, amount: number, externalTransaction?: any) {
    return this.executeWithTransaction(async (transaction) => {
      const account = await BankAccount.findByPk(bankAccountId, { transaction });
      if (!account) throw new Error('Bank Account not found');
      
      const currentBalance = Number(account.balance);
      if (currentBalance < amount) {
        throw new Error('Insufficient balance in bank account');
      }
      
      const newBalance = currentBalance - amount;
      
      await account.update({ balance: newBalance }, { transaction });
      return { bankAccountId, previousBalance: currentBalance, newBalance, amountSubtracted: amount };
    }, externalTransaction);
  }
}

const bankAccountService = new BankAccountService();

export const getAllBankAccounts = (options?: any) => bankAccountService.getAllBankAccounts(options);
export const getAllBankAccountsWithPagination = (options?: any) => bankAccountService.getAllBankAccounts(options);
export const getBankAccountById = (id: number) => bankAccountService.getBankAccountById(id);
export const createBankAccount = (data: any) => bankAccountService.createBankAccount(data);
export const updateBankAccount = (id: number, data: any) => bankAccountService.updateBankAccount(id, data);
export const deleteBankAccount = (id: number) => bankAccountService.deleteBankAccount(id);
export const addBalance = (bankAccountId: number, amount: number, externalTransaction?: any) => bankAccountService.addBalance(bankAccountId, amount, externalTransaction);
export const subtractBalance = (bankAccountId: number, amount: number, externalTransaction?: any) => bankAccountService.subtractBalance(bankAccountId, amount, externalTransaction);
