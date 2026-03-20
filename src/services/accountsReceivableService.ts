import AccountsReceivable from '../models/AccountsReceivable';
import Expense from '../models/Expense';
import { Op } from 'sequelize';
import sequelize from '../config/database';
import * as creditBalanceService from './creditBalanceService';
import { BaseService } from '../core/BaseService';
import { ValidationError, NotFoundError, BusinessLogicError } from '../core/AppError';
import { TransactionType } from '../types/TransactionType';

interface RecordPaymentRequest {
  amount: number;
  receivedDate?: Date;
  notes?: string;
  bankAccountId?: number;
  isCardSale?: boolean;
  allowOverpayment?: boolean;
  reference?: string;
  processingFeeCategory?: string;
}

interface CreateARRequest {
  clientId?: number;
  clientName?: string;
  clientRnc?: string;
  cardNetwork?: string;
  type: string;
  relatedDocumentType: string;
  relatedDocumentNumber: string;
  ncf?: string;
  saleOf?: string;
  amount: number;
  dueDate?: Date;
}

/**
 * Accounts Receivable Service - Class-based implementation following Purchase Service pattern
 * Handles AR creation, payment collection, and credit card processing
 */
class AccountsReceivableService extends BaseService {

  // ==================== PUBLIC API METHODS ====================

  /**
   * Get all accounts receivable with related expense data
   */
  async getAllAccountsReceivable(): Promise<any[]> {
    return this.executeWithRetry(async () => {
      console.log('🔍 Service: getAllAccountsReceivable called');
      
      // Get all AR records
      const arRecords = await AccountsReceivable.findAll({
        order: [['registrationDate', 'DESC']],
      });

      // Get related expense records for each AR
      const arWithExpenses = await Promise.all(
        arRecords.map(async (ar) => {
          // Check both Expense and BusinessExpense tables for related expenses
          const regularExpenses = await Expense.findAll({
            where: {
              relatedDocumentType: 'AR_COLLECTION',
              relatedDocumentNumber: ar.registrationNumber
            },
            attributes: ['id', 'registrationNumber', 'amount', 'expenseType', 'status', 'description']
          });

          // Check BusinessExpense table for processing fees
          const BusinessExpense = (await import('../models/BusinessExpense')).default;
          const businessExpenses = await BusinessExpense.findAll({
            where: {
              description: {
                [Op.like]: `%${ar.relatedDocumentNumber}%`
              }
            },
            attributes: ['id', 'registrationNumber', 'amount', 'expenseType', 'status', 'description']
          });

          // Combine both types of expenses
          const allRelatedExpenses = [
            ...regularExpenses.map(exp => exp.toJSON()),
            ...businessExpenses.map(exp => exp.toJSON())
          ];

          const totalExpenseAmount = allRelatedExpenses.reduce((sum, expense) => {
            return sum + parseFloat(expense.amount.toString());
          }, 0);

          return {
            ...ar.toJSON(),
            relatedExpenses: allRelatedExpenses,
            totalExpenseAmount: totalExpenseAmount
          };
        })
      );

      console.log(`✅ Retrieved ${arWithExpenses.length} AR records successfully`);
      return arWithExpenses;
    });
  }

  /**
   * Get AR by ID
   */
  async getAccountsReceivableById(id: number): Promise<AccountsReceivable> {
    return this.executeWithRetry(async () => {
      this.validateNumeric(id, 'AR ID', { min: 1 });
      
      const ar = await AccountsReceivable.findByPk(id);
      if (!ar) {
        throw new NotFoundError(`Accounts Receivable with ID ${id} not found`);
      }
      
      return ar;
    });
  }

  /**
   * Get pending accounts receivable
   */
  async getPendingAccountsReceivable(): Promise<AccountsReceivable[]> {
    return this.executeWithRetry(async () => {
      return await AccountsReceivable.findAll({
        where: {
          status: {
            [Op.in]: ['Pending', 'Partial']
          }
        },
        order: [['registrationDate', 'ASC']],
      });
    });
  }

  /**
   * Create new accounts receivable
   */
  async createAccountsReceivable(data: CreateARRequest): Promise<AccountsReceivable> {
    return this.executeWithTransaction(async (transaction) => {
      // Validation
      this.validateARData(data);
      
      // Generate registration number
      const registrationNumber = await this.generateARRegistrationNumber(transaction);
      
      const accountsReceivable = await AccountsReceivable.create({
        clientId: data.clientId,
        clientName: data.clientName,
        clientRnc: data.clientRnc,
        cardNetwork: data.cardNetwork,
        type: data.type,
        relatedDocumentType: data.relatedDocumentType,
        relatedDocumentId: 0, // Default value - can be updated later if needed
        relatedDocumentNumber: data.relatedDocumentNumber,
        ncf: data.ncf,
        saleOf: data.saleOf,
        amount: data.amount,
        expectedBankDeposit: data.amount, // Default to full amount
        dueDate: data.dueDate,
        registrationNumber,
        registrationDate: new Date(),
        receivedAmount: 0,
        balanceAmount: data.amount,
        status: 'Pending',
      }, { transaction });
      
      console.log(`✅ Created AR ${registrationNumber} for amount ${data.amount}`);
      return accountsReceivable;
    });
  }

  /**
   * Record payment for accounts receivable
   */
  async recordPayment(id: number, paymentData: RecordPaymentRequest): Promise<any> {
    return this.executeWithTransaction(async (transaction) => {
      const ar = await AccountsReceivable.findByPk(id, { transaction });
      if (!ar) {
        throw new NotFoundError('Accounts Receivable not found');
      }

      // Validate payment
      this.validatePaymentData(paymentData, ar);
      
      // Process overpayment validation
      const validation = await this.validateOverpayment(ar, paymentData);
      
      // Calculate payment amounts
      const { actualPaymentToAR, overpaymentAmount } = this.calculatePaymentAmounts(ar, paymentData.amount);
      
      // Process payment based on type
      if (paymentData.isCardSale && paymentData.bankAccountId) {
        await this.processCardSalePayment(ar, paymentData, actualPaymentToAR, transaction);
        
        // Create processing fee expense for credit card sales
        const processingFeeAmount = Number(ar.amount) - paymentData.amount;
        if (processingFeeAmount > 0) {
          await this.createProcessingFeeExpense(ar, processingFeeAmount, paymentData, transaction);
        }
      }
      
      // Update AR record
      const updatedAR = await this.updateARRecord(ar, actualPaymentToAR, paymentData, transaction);
      
      // Handle overpayment credit balance
      let creditBalance = null;
      if (overpaymentAmount > 0 && ar.clientId) {
        creditBalance = await this.createOverpaymentCredit(ar, overpaymentAmount);
      }
      
      console.log(`✅ Payment recorded for AR ${ar.registrationNumber}: ${actualPaymentToAR}`);
      
      return {
        accountsReceivable: updatedAR,
        creditBalance,
        overpaymentAmount,
        message: overpaymentAmount > 0 
          ? `Payment processed. Credit balance of ₹${overpaymentAmount.toFixed(2)} created for customer.`
          : 'Payment processed successfully.'
      };
    });
  }

  /**
   * Delete accounts receivable
   */
  async deleteAccountsReceivable(id: number): Promise<{ message: string }> {
    return this.executeWithTransaction(async (transaction) => {
      this.validateNumeric(id, 'AR ID', { min: 1 });
      
      const ar = await AccountsReceivable.findByPk(id, { transaction });
      if (!ar) {
        throw new NotFoundError('Accounts Receivable not found');
      }
      
      // Business rule validation
      if (ar.status === 'Received' || Number(ar.receivedAmount) > 0) {
        throw new BusinessLogicError('Cannot delete an AR with payments. Please reverse all payments first.');
      }
      
      await ar.destroy({ transaction });
      
      return { message: 'Accounts Receivable deleted successfully' };
    });
  }

  // ==================== VALIDATION METHODS ====================

  private validateARData(data: CreateARRequest): void {
    if (!data.amount || data.amount <= 0) {
      throw new ValidationError('Amount must be greater than 0');
    }
    
    if (!data.type) {
      throw new ValidationError('AR type is required');
    }
    
    if (!data.relatedDocumentType || !data.relatedDocumentNumber) {
      throw new ValidationError('Related document type and number are required');
    }
  }

  private validatePaymentData(paymentData: RecordPaymentRequest, ar: AccountsReceivable): void {
    if (!paymentData.amount || paymentData.amount <= 0) {
      throw new ValidationError('Payment amount must be greater than 0');
    }
    
    if (paymentData.isCardSale && !paymentData.bankAccountId) {
      throw new ValidationError('Bank account is required for credit card sales');
    }
  }

  private async validateOverpayment(ar: AccountsReceivable, paymentData: RecordPaymentRequest): Promise<any> {
    const outstandingBalance = Number(ar.balanceAmount);
    const paymentAmount = paymentData.amount;
    const customerName = ar.clientName || ar.cardNetwork || 'Unknown Customer';
    
    const validation = await creditBalanceService.validatePaymentAmount(
      outstandingBalance,
      paymentAmount,
      'CLIENT',
      customerName
    );
    
    if (validation.isOverpayment && !paymentData.allowOverpayment) {
      const error = new Error(validation.message) as any;
      error.code = 'OVERPAYMENT_DETECTED';
      error.overpaymentAmount = validation.overpaymentAmount;
      error.outstandingBalance = outstandingBalance;
      error.paymentAmount = paymentAmount;
      error.customerName = customerName;
      throw error;
    }
    
    return validation;
  }

  // ==================== PAYMENT PROCESSING METHODS ====================

  private calculatePaymentAmounts(ar: AccountsReceivable, paymentAmount: number): { actualPaymentToAR: number; overpaymentAmount: number } {
    const outstandingBalance = Number(ar.balanceAmount);
    const actualPaymentToAR = Math.min(paymentAmount, outstandingBalance);
    const overpaymentAmount = Math.max(0, paymentAmount - outstandingBalance);
    
    return { actualPaymentToAR, overpaymentAmount };
  }

  private async createProcessingFeeExpense(ar: AccountsReceivable, processingFeeAmount: number, paymentData: RecordPaymentRequest, transaction: any): Promise<void> {
    const BusinessExpense = (await import('../models/BusinessExpense')).default;
    
    // Generate expense registration number
    const expenseRegistrationNumber = await this.generateExpenseRegisterNumber(transaction);
    
    // Create business expense for processing fee
    await BusinessExpense.create({
      registrationNumber: expenseRegistrationNumber,
      date: paymentData.receivedDate || new Date(),
      supplierId: 1, // Default supplier ID - you may need to create a "Credit Card Processor" supplier
      expenseCategoryId: 1, // Default expense category ID - you may need to create a "Processing Fees" category
      expenseTypeId: 1, // Default expense type ID - you may need to create a "Credit Card Fees" type
      expenseType: paymentData.processingFeeCategory || 'CREDIT_CARD_PROCESSING_FEE',
      amount: processingFeeAmount,
      paymentType: 'AUTOMATIC_DEDUCTION',
      paidAmount: processingFeeAmount,
      balanceAmount: 0,
      status: 'COMPLETED',
      paymentStatus: 'Paid',
      description: `Credit Card Processing Fee - ${ar.relatedDocumentNumber} - Original: ₹${ar.amount}, Received: ₹${paymentData.amount}`,
    }, { transaction });
    
    console.log(`✅ Processing fee expense created: ₹${processingFeeAmount}`);
  }

  private async generateExpenseRegisterNumber(transaction: any): Promise<string> {
    const BusinessExpense = (await import('../models/BusinessExpense')).default;
    
    const lastExpense = await BusinessExpense.findOne({
      order: [['id', 'DESC']],
      transaction
    });
    
    const lastNumber = lastExpense?.registrationNumber 
      ? parseInt(lastExpense.registrationNumber.replace('EX', '')) 
      : 0;
    
    return `EX${String(lastNumber + 1).padStart(4, '0')}`;
  }

  private async processCardSalePayment(ar: AccountsReceivable, paymentData: RecordPaymentRequest, amount: number, transaction: any): Promise<void> {
    const BankRegister = (await import('../models/BankRegister')).default;
    const BankAccount = (await import('../models/BankAccount')).default;
    
    if (!paymentData.bankAccountId) {
      throw new ValidationError('Bank account ID is required for card sale payment');
    }
    
    // Get and validate bank account
    const bankAccount = await BankAccount.findByPk(paymentData.bankAccountId, { transaction });
    if (!bankAccount) {
      throw new ValidationError('Bank account not found');
    }
    
    // Generate bank register number
    const bankRegistrationNumber = await this.generateBankRegisterNumber(transaction);
    
    // Get last bank balance
    const lastBankBalance = await this.getLastBankBalance(paymentData.bankAccountId, transaction);
    const newBankBalance = lastBankBalance + amount;
    
    // Create bank register entry
    await BankRegister.create({
      registrationNumber: bankRegistrationNumber,
      registrationDate: paymentData.receivedDate || new Date(),
      transactionType: 'INFLOW',
      amount: amount,
      paymentMethod: 'CREDIT_CARD_COLLECTION',
      relatedDocumentType: 'AR_COLLECTION',
      relatedDocumentNumber: ar.registrationNumber,
      sourceTransactionType: TransactionType.AR_COLLECTION, // ✅ Fixed: Added sourceTransactionType
      clientName: ar.clientName || ar.cardNetwork || 'Credit Card Collection',
      clientRnc: ar.clientRnc || '',
      ncf: ar.ncf || '',
      description: `Credit Card Collection - ${ar.relatedDocumentNumber} - ${ar.clientName || ar.cardNetwork}`,
      balance: newBankBalance,
      bankAccountId: paymentData.bankAccountId,
    }, { transaction });
    
    // Update bank account balance
    const newBankAccountBalance = Number(bankAccount.balance) + amount;
    await bankAccount.update({
      balance: newBankAccountBalance,
    }, { transaction });
    
    console.log(`✅ Bank register entry created for AR collection: ${amount}`);
  }

  private async updateARRecord(ar: AccountsReceivable, actualPaymentToAR: number, paymentData: RecordPaymentRequest, transaction: any): Promise<AccountsReceivable> {
    const newReceivedAmount = Number(ar.receivedAmount) + actualPaymentToAR;
    const newBalanceAmount = Number(ar.amount) - newReceivedAmount;
    
    let status = 'Pending';
    
    // Special logic for credit card sales - always mark as "Received" for any payment
    if (paymentData.isCardSale && (ar.type === 'CREDIT_CARD_SALE' || ar.type === 'DEBIT_CARD_SALE')) {
      status = 'Received'; // Credit card payments are always one-time complete payments
    } else {
      // Regular logic for other sale types
      if (newReceivedAmount >= Number(ar.amount)) {
        status = 'Received';
      } else if (newReceivedAmount > 0) {
        status = 'Partial';
      }
    }

    await ar.update({
      receivedAmount: newReceivedAmount,
      balanceAmount: newBalanceAmount,
      status,
      receivedDate: status === 'Received' ? (paymentData.receivedDate || new Date()) : ar.receivedDate,
      notes: paymentData.notes || ar.notes,
      actualBankDeposit: paymentData.isCardSale ? actualPaymentToAR : undefined,
      bankAccountId: paymentData.bankAccountId || undefined,
    }, { transaction });
    
    return ar;
  }

  private async createOverpaymentCredit(ar: AccountsReceivable, overpaymentAmount: number): Promise<any> {
    const customerName = ar.clientName || ar.cardNetwork || 'Unknown Customer';
    
    return await creditBalanceService.createCreditBalance({
      type: 'CUSTOMER_CREDIT',
      relatedEntityType: 'CLIENT',
      relatedEntityId: ar.clientId!,
      relatedEntityName: customerName,
      originalTransactionType: 'AR',
      originalTransactionId: ar.id,
      originalTransactionNumber: ar.registrationNumber,
      creditAmount: overpaymentAmount,
      notes: `Overpayment of ₹${overpaymentAmount.toFixed(2)} on AR ${ar.registrationNumber}`
    });
  }

  // ==================== UTILITY METHODS ====================

  private async generateARRegistrationNumber(transaction?: any): Promise<string> {
    const lastAR = await AccountsReceivable.findOne({
      where: {
        registrationNumber: {
          [Op.like]: 'AR%'
        }
      },
      order: [['id', 'DESC']],
      transaction
    });
    
    let nextNumber = 1;
    if (lastAR) {
      const lastNumber = parseInt(lastAR.registrationNumber.substring(2));
      nextNumber = lastNumber + 1;
    }
    
    return `AR${String(nextNumber).padStart(4, '0')}`;
  }

  private async generateBankRegisterNumber(transaction?: any): Promise<string> {
    const BankRegister = (await import('../models/BankRegister')).default;
    
    const lastBankTransaction = await BankRegister.findOne({
      where: {
        registrationNumber: {
          [Op.like]: 'BR%'
        }
      },
      order: [['id', 'DESC']],
      transaction
    });
    
    let nextBankNumber = 1;
    if (lastBankTransaction) {
      const lastBankNumber = parseInt(lastBankTransaction.registrationNumber.substring(2));
      nextBankNumber = lastBankNumber + 1;
    }
    
    return `BR${String(nextBankNumber).padStart(4, '0')}`;
  }

  private async getLastBankBalance(bankAccountId: number, transaction?: any): Promise<number> {
    const BankRegister = (await import('../models/BankRegister')).default;
    
    const lastBankBalance = await BankRegister.findOne({
      where: { bankAccountId },
      order: [['id', 'DESC']],
      transaction
    });
    
    return lastBankBalance ? Number(lastBankBalance.balance) : 0;
  }
}

// Export singleton instance
export const accountsReceivableService = new AccountsReceivableService();

// Export individual methods for backward compatibility
export const getAllAccountsReceivable = () => accountsReceivableService.getAllAccountsReceivable();
export const getAccountsReceivableById = (id: number) => accountsReceivableService.getAccountsReceivableById(id);
export const getPendingAccountsReceivable = () => accountsReceivableService.getPendingAccountsReceivable();
export const createAccountsReceivable = (data: CreateARRequest) => accountsReceivableService.createAccountsReceivable(data);
export const recordPayment = (id: number, paymentData: RecordPaymentRequest) => accountsReceivableService.recordPayment(id, paymentData);
export const deleteAccountsReceivable = (id: number) => accountsReceivableService.deleteAccountsReceivable(id);