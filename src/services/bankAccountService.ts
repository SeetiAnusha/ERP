import BankAccount from '../models/BankAccount';
import { Op } from 'sequelize';
import { BaseService } from '../core/BaseService';

class BankAccountService extends BaseService {
  
  async getAllBankAccounts(options: any = {}): Promise<any> {
    return this.executeWithRetry(async () => {
      // Use generic pagination from BaseService
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

  async getBankAccountById(id: number) {
    return await BankAccount.findByPk(id);
  }

  async createBankAccount(data: any) {
    return this.executeWithRetry(async () => {
      // Validate account number is exactly 4 digits
      if (!data.accountNumber || !/^\d{4}$/.test(data.accountNumber)) {
        throw new Error('Account number must be exactly 4 digits (last 4 digits of your account)');
      }
      
      // Generate code (BA0001, BA0002, etc.)
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
      
      const code = `BA${String(nextNumber).padStart(4, '0')}`;
      
      return await BankAccount.create({
        ...data,
        code,
      });
    });
  }

  async updateBankAccount(id: number, data: any) {
    return this.executeWithRetry(async () => {
      // Validate account number is exactly 4 digits if provided
      if (data.accountNumber && !/^\d{4}$/.test(data.accountNumber)) {
        throw new Error('Account number must be exactly 4 digits (last 4 digits of your account)');
      }
      
      const account = await BankAccount.findByPk(id);
      if (!account) throw new Error('Bank Account not found');
      return await account.update(data);
    });
  }

  async deleteBankAccount(id: number) {
    const account = await BankAccount.findByPk(id);
    if (!account) throw new Error('Bank Account not found');
    await account.destroy();
    return { message: 'Bank Account deleted successfully' };
  }
}

const bankAccountService = new BankAccountService();

export const getAllBankAccounts = (options?: any) => bankAccountService.getAllBankAccounts(options);
export const getAllBankAccountsWithPagination = (options?: any) => bankAccountService.getAllBankAccounts(options);
export const getBankAccountById = (id: number) => bankAccountService.getBankAccountById(id);
export const createBankAccount = (data: any) => bankAccountService.createBankAccount(data);
export const updateBankAccount = (id: number, data: any) => bankAccountService.updateBankAccount(id, data);
export const deleteBankAccount = (id: number) => bankAccountService.deleteBankAccount(id);
