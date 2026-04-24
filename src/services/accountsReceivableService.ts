import AccountsReceivable from '../models/AccountsReceivable';
import Expense from '../models/Expense';
import { Op } from 'sequelize';
import sequelize from '../config/database';
import * as creditBalanceService from './creditBalanceService';
import { BaseService } from '../core/BaseService';
import { ValidationError, NotFoundError, BusinessLogicError } from '../core/AppError';
import { TransactionType } from '../types/TransactionType';
import { FeeStatus } from '../models/CreditCardFee';

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
  async getAllAccountsReceivable(options: any = {}): Promise<any> {
    return this.executeWithRetry(async () => {
      console.log(' Service: getAllAccountsReceivable called with options:', options);
      
      // Check if pagination is requested
      if (options.page || options.limit) {
        // Use generic pagination from BaseService
        const result = await this.getAllWithPagination(
          AccountsReceivable,
          {
            ...options,
            searchFields: ['registrationNumber', 'clientName', 'clientRnc', 'cardNetwork'],
            dateField: 'registrationDate'
          }
        );
        
        console.log(` Retrieved ${result.data.length} of ${result.pagination.total} AR records (Page ${result.pagination.page}/${result.pagination.totalPages})`);
        return result;
      }
      
      // Backward compatibility - return all records with expenses
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

      console.log(` Retrieved ${arWithExpenses.length} AR records successfully`);
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
      
      console.log(` Created AR ${registrationNumber} for amount ${data.amount}`);
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
      
      console.log(` Payment recorded for AR ${ar.registrationNumber}: ${actualPaymentToAR}`);
      
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
   * 
   * ⚠️ IMPORTANT: This is for DIRECT deletion (DELETE /api/accounts-receivable/:id)
   * For APPROVAL-BASED deletion, use TransactionDeletionService with ARDeletionHandler
   */
  async deleteAccountsReceivable(id: number): Promise<{ message: string }> {
    return this.executeWithTransaction(async (transaction) => {
      this.validateNumeric(id, 'AR ID', { min: 1 });
      
      const ar = await AccountsReceivable.findByPk(id, { transaction });
      if (!ar) {
        throw new NotFoundError('Accounts Receivable not found');
      }
      
      const receivedAmount = Number(ar.receivedAmount || 0);
      
      // ✅ Simple validation: Block deletion if any payment received
      if (receivedAmount > 0) {
        throw new BusinessLogicError(
          'Cannot delete an AR with payments. Please use the Transaction Deletion approval system for proper reversal.'
        );
      }
      
      // Only allow deletion of unpaid AR
      await ar.destroy({ transaction });
      
      console.log(`✅ [AR Deleted] ${ar.registrationNumber} deleted successfully (unpaid)`);
      
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

  private async createProcessingFeeExpense(
    ar: AccountsReceivable, 
    processingFeeAmount: number, 
    paymentData: RecordPaymentRequest, 
    transaction: any
  ): Promise<void> {
    try {
      console.log(`🔍 [Processing Fee] Starting creation for AR ${ar.registrationNumber}, fee amount: ${processingFeeAmount}`);
      
      // ✅ FIX: Import models at the top to avoid transaction conflicts
      const CreditCardFee = (await import('../models/CreditCardFee')).default;
      const Client = (await import('../models/Client')).default;
      const CardPaymentNetwork = (await import('../models/CardPaymentNetwork')).default;
      
      // ✅ FIX: Force load associations
      await import('../models/associations');
      
      // Use the AR registration number as transaction number
      const transactionNumber = ar.registrationNumber;
      
      // Check if fee already exists
      const existingFee = await CreditCardFee.findOne({
        where: { transactionNumber: transactionNumber },
        transaction
      });
      
      if (existingFee) {
        console.log(`⚠️ Processing fee already exists for ${transactionNumber}, skipping creation`);
        return;
      }
      
      // ✅ Get client information from AR
      if (!ar.clientId) {
        console.log(`⚠️ No clientId in AR ${ar.registrationNumber}, skipping processing fee creation`);
        return;
      }
      
      const client = await Client.findByPk(ar.clientId, { transaction });
      if (!client) {
        console.log(`⚠️ Client ${ar.clientId} not found for AR ${ar.id}, skipping processing fee creation`);
        return;
      }
      
      console.log(`✅ Found client: ${client.name} (ID: ${client.id})`);
      
      // ✅ Get card network name from AR (stored as string)
      const cardNetworkName = ar.cardNetwork || 'Unknown Card Network';
      console.log(`📱 Card network: ${cardNetworkName}`);
      
      // ✅ Try to find the card payment network by name to get fee percentage
      let feePercentage = 0;
      if (cardNetworkName) {
        const cardNetwork = await CardPaymentNetwork.findOne({
          where: { name: cardNetworkName },
          transaction
        });
        if (cardNetwork && cardNetwork.processingFee) {
          feePercentage = Number(cardNetwork.processingFee);
          console.log(`✅ Found card network with fee: ${feePercentage}%`);
        } else {
          // Calculate percentage from amounts if network not found
          const originalAmount = Number(ar.amount);
          if (originalAmount > 0) {
            feePercentage = (processingFeeAmount / originalAmount) * 100;
            // ✅ FIX: Cap at 100% to prevent numeric overflow (DECIMAL(5,2) max is 999.99)
            feePercentage = Math.min(feePercentage, 10000);
            console.log(`📊 Calculated fee percentage: ${feePercentage}%`);
          }
        }
      }
      
      // ✅ Create credit card fee record
      console.log(`💳 Creating credit card fee record...`);
      const fee = await CreditCardFee.create({
        transactionDate: paymentData.receivedDate || new Date(),
        transactionNumber: transactionNumber,
        
        // Client information
        customerId: client.id,
        customerName: client.name,
        
        // Fee details
        paymentAmount: Number(ar.amount),
        feePercentage: feePercentage,
        feeAmount: processingFeeAmount,
        netAmount: Number(ar.amount) - processingFeeAmount,
        
        // Card information
        cardType: undefined, // Can be enhanced later if we track card types
        cardLastFour: undefined,
        
        // Related AR information for traceability
        arId: ar.id,
        arRegistrationNumber: ar.registrationNumber,
        
        // Status
        status: FeeStatus.RECORDED,
        
        // Notes with full context
        notes: `${cardNetworkName} Processing Fee - Client: ${client.name}${client.rncCedula ? ` (RNC: ${client.rncCedula})` : ''} - AR: ${ar.registrationNumber} - Original Amount: ₹${ar.amount}, Received: ₹${paymentData.amount}, Processing Fee: ₹${processingFeeAmount}. Automatically created from AR collection.`,
      }, { transaction });
      
      console.log(`✅ Credit card processing fee created successfully! ID: ${fee.id}, Client: "${client.name}", Amount: ₹${processingFeeAmount} (${cardNetworkName})`);
    } catch (error: any) {
      console.error(`❌ Error creating processing fee for AR ${ar.registrationNumber}:`, error.message);
      console.error(`Stack trace:`, error.stack);
      // ✅ FIX: Don't throw - allow the AR payment to succeed even if fee creation fails
      // This prevents transaction conflicts from blocking the main payment
    }
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
    
    // Create bank register entry with complete field population
    await BankRegister.create({
      registrationNumber: bankRegistrationNumber,
      registrationDate: paymentData.receivedDate || new Date(),
      transactionType: 'INFLOW',
      sourceTransactionType: 'AR_COLLECTION',
      amount: amount,
      paymentMethod: 'CREDIT_CARD_COLLECTION',
      relatedDocumentType: 'AR_COLLECTION',
      relatedDocumentNumber: ar.registrationNumber,
      clientName: ar.clientName || ar.cardNetwork || 'Credit Card Collection',
      clientRnc: ar.clientRnc || '',
      ncf: ar.ncf || '',
      description: `Credit Card Collection - ${ar.relatedDocumentNumber} - ${ar.clientName || ar.cardNetwork}`,
      balance: newBankBalance,
      bankAccountId: paymentData.bankAccountId,
      bankAccountName: `${bankAccount.bankName} - ${bankAccount.accountNumber}`,
      originalPaymentType: ar.type || 'CREDIT_CARD_SALE'
    }, { transaction });
    
    // Update bank account balance
    const newBankAccountBalance = Number(bankAccount.balance) + amount;
    await bankAccount.update({
      balance: newBankAccountBalance,
    }, { transaction });
    
    console.log(` Bank register entry created for AR collection: ${amount}`);
  }

  private async updateARRecord(ar: AccountsReceivable, actualPaymentToAR: number, paymentData: RecordPaymentRequest, transaction: any): Promise<AccountsReceivable> {
    let newReceivedAmount: number;
    let newBalanceAmount: number;
    
    // Special handling for credit card sales
    if (paymentData.isCardSale && (ar.type === 'CREDIT_CARD_SALE' || ar.type === 'DEBIT_CARD_SALE')) {
      // For credit card sales, customer has paid the FULL amount
      // The processing fee is a separate business expense, not a customer debt
      newReceivedAmount = Number(ar.amount); // Full invoice amount
      newBalanceAmount = 0; // Customer owes nothing
    } else {
      // Regular logic for other sale types
      newReceivedAmount = Number(ar.receivedAmount) + actualPaymentToAR;
      newBalanceAmount = Number(ar.amount) - newReceivedAmount;
    }
    
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
      actualBankDeposit: paymentData.isCardSale ? actualPaymentToAR : undefined, // This shows the actual bank deposit (₹9.00)
      expectedBankDeposit: paymentData.isCardSale ? actualPaymentToAR : undefined, // ✅ Set expected deposit to actual payment amount (₹9, not ₹10)
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
export const getAllAccountsReceivable = (options?: any) => accountsReceivableService.getAllAccountsReceivable(options);
export const getAllAccountsReceivableWithPagination = (options?: any) => accountsReceivableService.getAllAccountsReceivable(options);
export const getAccountsReceivableById = (id: number) => accountsReceivableService.getAccountsReceivableById(id);
export const getPendingAccountsReceivable = () => accountsReceivableService.getPendingAccountsReceivable();
export const createAccountsReceivable = (data: CreateARRequest) => accountsReceivableService.createAccountsReceivable(data);
export const recordPayment = (id: number, paymentData: RecordPaymentRequest) => accountsReceivableService.recordPayment(id, paymentData);
export const deleteAccountsReceivable = (id: number) => accountsReceivableService.deleteAccountsReceivable(id);