/**
 * Enterprise-Grade Cash Register Service
 * 
 * Class-based architecture with comprehensive validation and error handling
 * Time Complexity: O(1) for single transactions, O(n) for multi-invoice processing
 * Space Complexity: O(1) for processing, O(n) for invoice data
 */

import CashRegister from '../models/CashRegister';
import CashRegisterMaster from '../models/CashRegisterMaster';
import BankAccount from '../models/BankAccount';
import BankRegister from '../models/BankRegister';
import AccountsReceivable from '../models/AccountsReceivable';
import { Op } from 'sequelize';
import sequelize from '../config/database';
import { BaseService } from '../core/BaseService';
import { ValidationFramework, CommonValidators, ValidationSchema } from '../core/ValidationFramework';
import { 
  ValidationError, 
  NotFoundError, 
  BusinessLogicError, 
  InsufficientBalanceError 
} from '../core/AppError';
import * as creditBalanceService from './creditBalanceService';

/**
 * Cash Transaction Request Interface
 */
interface CashTransactionRequest {
  registrationDate: Date;
  transactionType: 'INFLOW' | 'OUTFLOW';
  amount: number;
  paymentMethod: string;
  relatedDocumentType: string;
  relatedDocumentNumber?: string;
  description: string;
  customerId?: number;
  customerName?: string;
  cashRegisterId?: number;
  invoiceIds?: string;
  bankAccountId?: number;
  investmentAgreementId?: number;
  // Flag to prevent duplicate credit balance creation when called from Customer Credit Aware Payment Service
  skipCreditBalanceCreation?: boolean;
}

/**
 * Validation Schema for Cash Transactions
 */
const CASH_TRANSACTION_SCHEMA: ValidationSchema<CashTransactionRequest> = {
  rules: [
    { 
      field: 'registrationDate', 
      validator: CommonValidators.isDate().validator, 
      message: 'Valid registration date is required', 
      required: true 
    },
    { 
      field: 'transactionType', 
      validator: CommonValidators.isEnum(['INFLOW', 'OUTFLOW']).validator, 
      message: 'Transaction type must be INFLOW or OUTFLOW', 
      required: true 
    },
    { 
      field: 'amount', 
      validator: CommonValidators.isPositive().validator, 
      message: 'Amount must be greater than 0', 
      required: true 
    },
    { 
      field: 'paymentMethod', 
      validator: CommonValidators.isString().validator, 
      message: 'Payment method is required', 
      required: true 
    },
    { 
      field: 'relatedDocumentType', 
      validator: CommonValidators.isString().validator, 
      message: 'Related document type is required', 
      required: true 
    },
    { 
      field: 'description', 
      validator: CommonValidators.minLength(5).validator, 
      message: 'Description must be at least 5 characters', 
      required: true 
    }
  ],
  customValidators: [
    (data: CashTransactionRequest) => {
      // Amount validation
      if (data.amount > 10000000) {
        throw new ValidationError('Transaction amount cannot exceed ₹10,000,000');
      }
      
      // Description validation
      if (data.description && data.description.length > 500) {
        throw new ValidationError('Description cannot exceed 500 characters');
      }
      
      // AR Collection specific validation
      if (data.relatedDocumentType === 'AR_COLLECTION') {
        if (!data.customerId) {
          throw new ValidationError('Customer ID is required for AR Collection');
        }
        if (!data.invoiceIds) {
          throw new ValidationError('Invoice IDs are required for AR Collection');
        }
      }
      
      // Bank deposit specific validation
      if (data.paymentMethod === 'BANK_DEPOSIT' && data.transactionType === 'OUTFLOW') {
        if (!data.bankAccountId) {
          throw new ValidationError('Bank Account ID is required for bank deposits');
        }
      }
      
      // Investment specific validation
      if (data.relatedDocumentType === 'CONTRIBUTION' || data.relatedDocumentType === 'LOAN') {
        if (!data.investmentAgreementId) {
          throw new ValidationError('Investment Agreement ID is required for contributions/loans');
        }
      }
    }
  ]
};

/**
 * Cash Register Service Class
 * 
 * Features:
 * - Enterprise-grade validation using ValidationFramework
 * - Comprehensive error handling with AppError hierarchy
 * - Transaction management with rollback protection
 * - Balance validation and insufficient funds protection
 * - Automatic credit balance creation for overpayments
 */
class CashRegisterService extends BaseService {
  
  /**
   * Get all cash transactions with pagination and filtering
   */
  async getAllCashTransactions(options: {
    page?: number;
    limit?: number;
    transactionType?: 'INFLOW' | 'OUTFLOW';
    cashRegisterId?: number;
    dateFrom?: Date;
    dateTo?: Date;
  } = {}): Promise<{
    transactions: CashRegister[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.executeWithRetry(async () => {
      const { page = 1, limit = 50, transactionType, cashRegisterId, dateFrom, dateTo } = options;
      const offset = (page - 1) * limit;
      
      // Validate pagination parameters
      this.validateNumeric(page, 'Page number', { min: 1 });
      this.validateNumeric(limit, 'Limit', { min: 1, max: 100 });
      
      const whereClause: any = {};
      
      if (transactionType) {
        this.validateEnum(transactionType, 'Transaction type', ['INFLOW', 'OUTFLOW']);
        whereClause.transactionType = transactionType;
      }
      
      if (cashRegisterId) {
        this.validateNumeric(cashRegisterId, 'Cash Register ID', { min: 1 });
        whereClause.cashRegisterId = cashRegisterId;
      }
      
      if (dateFrom || dateTo) {
        whereClause.registrationDate = {};
        if (dateFrom) whereClause.registrationDate[Op.gte] = dateFrom;
        if (dateTo) whereClause.registrationDate[Op.lte] = dateTo;
      }
      
      const { rows: transactions, count: total } = await CashRegister.findAndCountAll({
        where: whereClause,
        order: [['registrationDate', 'DESC'], ['createdAt', 'DESC']],
        limit,
        offset
      });
      
      return {
        transactions,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    });
  }
  
  /**
   * Get cash transaction by ID with validation
   */
  async getCashTransactionById(id: number): Promise<CashRegister> {
    return this.executeWithRetry(async () => {
      this.validateNumeric(id, 'Cash Transaction ID', { min: 1 });
      
      const transaction = await CashRegister.findByPk(id);
      if (!transaction) {
        throw new NotFoundError(`Cash transaction with ID ${id} not found`);
      }
      
      return transaction;
    });
  }
  
  /**
   * Create cash transaction with comprehensive validation and error handling
   * Time Complexity: O(n) where n = number of invoices for AR_COLLECTION
   * Space Complexity: O(n) for invoice processing
   */
  async createCashTransaction(
    data: CashTransactionRequest, 
    externalTransaction?: any
  ): Promise<CashRegister> {
    return this.executeWithTransaction(async (transaction) => {
      
      // Step 1: Comprehensive validation using ValidationFramework
      this.validateCashTransactionRequest(data);
      
      // Step 2: Determine if cash register is required
      const needsCashRegister = this.determineIfCashRegisterRequired(data);
      
      // Step 3: Validate and get cash register (if needed)
      let cashRegisterMaster = null;
      let lastBalance = 0;
      
      if (needsCashRegister) {
        if (!data.cashRegisterId) {
          throw new ValidationError('Cash Register selection is required for this transaction type');
        }
        
        cashRegisterMaster = await this.validateAndGetCashRegister(data.cashRegisterId, transaction);
        lastBalance = await this.getLastCashRegisterBalance(data.cashRegisterId, cashRegisterMaster, transaction);
      }
      
      // Step 4: Generate registration number
      const registrationNumber = await this.generateCashRegistrationNumber(transaction);
      
      // Step 5: Process transaction based on type
      if (data.transactionType === 'INFLOW') {
        return await this.processInflowTransaction(
          data,
          registrationNumber,
          lastBalance,
          cashRegisterMaster,
          needsCashRegister,
          transaction
        );
      } else {
        return await this.processOutflowTransaction(
          data,
          registrationNumber,
          lastBalance,
          cashRegisterMaster,
          transaction
        );
      }
    }, externalTransaction);
  }
  
  // ==================== PRIVATE VALIDATION METHODS ====================
  
  /**
   * Validate cash transaction request using ValidationFramework
   */
  private validateCashTransactionRequest(data: CashTransactionRequest): void {
    try {
      ValidationFramework.validate(data, CASH_TRANSACTION_SCHEMA);
    } catch (error: any) {
      throw new ValidationError(`Cash transaction validation failed: ${error.message}`);
    }
  }
  
  /**
   * Determine if cash register is required for this transaction
   */
  private determineIfCashRegisterRequired(data: CashTransactionRequest): boolean {
    return (
      data.relatedDocumentType === 'CONTRIBUTION' || 
      data.relatedDocumentType === 'LOAN' ||
      (data.relatedDocumentType === 'AR_COLLECTION' && data.paymentMethod === 'CASH') ||
      data.transactionType === 'OUTFLOW' // All outflows require cash register
    );
  }
  
  /**
   * Validate and get cash register master
   */
  private async validateAndGetCashRegister(
    cashRegisterId: number, 
    transaction: any
  ): Promise<any> {
    const cashRegisterMaster = await CashRegisterMaster.findByPk(cashRegisterId, { transaction });
    if (!cashRegisterMaster) {
      throw new NotFoundError('Cash Register not found');
    }
    return cashRegisterMaster;
  }
  
  /**
   * Get last cash register balance
   */
  private async getLastCashRegisterBalance(
    cashRegisterId: number,
    cashRegisterMaster: any,
    transaction: any
  ): Promise<number> {
    const lastRegisterTransaction = await CashRegister.findOne({
      where: { cashRegisterId },
      order: [['id', 'DESC']],
      transaction
    });
    
    return lastRegisterTransaction 
      ? parseFloat(lastRegisterTransaction.balance.toString()) 
      : parseFloat(cashRegisterMaster.balance.toString());
  }
  
  /**
   * Generate cash registration number
   */
  private async generateCashRegistrationNumber(transaction: any): Promise<string> {
    const lastTransaction = await CashRegister.findOne({
      where: {
        registrationNumber: {
          [Op.like]: 'CJ%'
        }
      },
      order: [['id', 'DESC']],
      transaction
    });
    
    let nextNumber = 1;
    if (lastTransaction) {
      const lastNumber = parseInt(lastTransaction.registrationNumber.substring(2));
      nextNumber = lastNumber + 1;
    }
    
    return `CJ${String(nextNumber).padStart(4, '0')}`;
  }
  
  // ==================== TRANSACTION PROCESSING METHODS ====================
  
  /**
   * Process INFLOW transaction with comprehensive validation
   */
  private async processInflowTransaction(
    data: CashTransactionRequest,
    registrationNumber: string,
    lastBalance: number,
    cashRegisterMaster: any,
    needsCashRegister: boolean,
    transaction: any
  ): Promise<CashRegister> {
    
    if (data.relatedDocumentType === 'AR_COLLECTION') {
      await this.processARCollection(data, transaction);
    } else if (data.relatedDocumentType === 'CONTRIBUTION' || data.relatedDocumentType === 'LOAN') {
      await this.processInvestmentTransaction(data, transaction);
    }
    
    // Calculate new balance (INFLOW increases balance, but only if cash register is involved)
    let newBalance = lastBalance;
    if (needsCashRegister) {
      newBalance = lastBalance + parseFloat(data.amount.toString());
    }
    
    // Create cash register transaction
    const cashTransactionData: any = {
      ...data,
      registrationNumber,
      balance: newBalance
    };
    
    if (needsCashRegister) {
      cashTransactionData.cashRegisterId = data.cashRegisterId;
    }
    
    const cashTransaction = await CashRegister.create(cashTransactionData, { transaction });
    
    // Update cash register master balance (only if cash register is involved)
    if (needsCashRegister && cashRegisterMaster) {
      await cashRegisterMaster.update({
        balance: newBalance,
      }, { transaction });
    }
    
    return cashTransaction;
  }
  
  /**
   * Process OUTFLOW transaction with balance validation
   */
  private async processOutflowTransaction(
    data: CashTransactionRequest,
    registrationNumber: string,
    lastBalance: number,
    cashRegisterMaster: any,
    transaction: any
  ): Promise<CashRegister> {
    
    // For OUTFLOW, cash register is always required
    if (!data.cashRegisterId || !cashRegisterMaster) {
      throw new ValidationError('Cash Register selection is required for OUTFLOW transactions');
    }
    
    // Critical validation: Check if cash register has sufficient balance
    const outflowAmount = parseFloat(data.amount.toString());
    this.validateSufficientBalance(
      lastBalance,
      outflowAmount,
      `OUTFLOW transaction ${registrationNumber}`,
      `cash register "${cashRegisterMaster.name}"`
    );
    
    if (data.paymentMethod === 'BANK_DEPOSIT') {
      return await this.processBankDeposit(
        data,
        registrationNumber,
        lastBalance,
        outflowAmount,
        cashRegisterMaster,
        transaction
      );
    } else if (data.paymentMethod === 'CORRECTION') {
      return await this.processCorrection(
        data,
        registrationNumber,
        lastBalance,
        outflowAmount,
        cashRegisterMaster,
        transaction
      );
    } else {
      throw new ValidationError('OUTFLOW only allows BANK_DEPOSIT or CORRECTION payment methods');
    }
  }
  
  /**
   * Process AR Collection with overpayment handling
   */
  private async processARCollection(data: CashTransactionRequest, transaction: any): Promise<void> {
    if (!data.customerId || !data.invoiceIds) {
      throw new ValidationError('Customer ID and Invoice IDs are required for AR Collection');
    }
    
    const invoiceIdsArray = JSON.parse(data.invoiceIds);
    let totalOutstandingBalance = 0;
    const invoicesToUpdate = [];
    
    // Validate and calculate total outstanding balance
    for (const invoiceId of invoiceIdsArray) {
      const arInvoice = await AccountsReceivable.findByPk(invoiceId, { transaction });
      if (!arInvoice) {
        throw new NotFoundError(`Invoice with ID ${invoiceId} not found`);
      }
      
      // Verify this is from allowed types
      const allowedTypes = ['CREDIT_SALE', 'CLIENT_CREDIT', 'CREDIT_CARD_SALE', 'DEBIT_CARD_SALE'];
      if (!allowedTypes.includes(arInvoice.type)) {
        throw new BusinessLogicError(
          `Invoice ${arInvoice.registrationNumber} is not from a Credit Sale or Credit Card Sale. ` +
          `Only Credit Sales and Credit Card Sales with customer information can be collected through Cash Register.`
        );
      }
      
      // For credit card sales, ensure customer information is available
      if ((arInvoice.type === 'CREDIT_CARD_SALE' || arInvoice.type === 'DEBIT_CARD_SALE') && !arInvoice.clientId) {
        throw new BusinessLogicError(
          `Invoice ${arInvoice.registrationNumber} is a Credit Card Sale without customer information. ` +
          `Only Credit Card Sales with customer information can be collected through Cash Register.`
        );
      }
      
      totalOutstandingBalance += parseFloat(arInvoice.balanceAmount.toString());
      invoicesToUpdate.push(arInvoice);
    }
    
    // Handle overpayment
    const paymentAmount = parseFloat(data.amount.toString());
    if (paymentAmount > totalOutstandingBalance) {
      await this.handleAROverpayment(
        data,
        paymentAmount,
        totalOutstandingBalance,
        invoicesToUpdate[0],
        transaction
      );
    }
    
    // Update AR invoices
    await this.updateARInvoices(invoicesToUpdate, paymentAmount, totalOutstandingBalance, transaction);
  }
  
  /**
   * Handle AR overpayment with credit balance creation
   */
  private async handleAROverpayment(
    data: CashTransactionRequest,
    paymentAmount: number,
    totalOutstandingBalance: number,
    firstInvoice: any,
    transaction: any
  ): Promise<void> {
    const customerName = firstInvoice ? firstInvoice.clientName : 'Customer';
    
    const validation = await creditBalanceService.validatePaymentAmount(
      totalOutstandingBalance,
      paymentAmount,
      'CLIENT',
      customerName || 'Customer'
    );
    
    if (validation.isOverpayment) {
      // 🔥 CRITICAL: Skip credit balance creation if called from Customer Credit Aware Payment Service
      if (data.skipCreditBalanceCreation) {
        console.log('⚠️ Skipping credit balance creation - handled by Customer Credit Aware Payment Service');
        return;
      }
      
      const overpaymentAmount = validation.overpaymentAmount;
      
      await creditBalanceService.createCreditBalance({
        type: 'CUSTOMER_CREDIT',
        relatedEntityType: 'CLIENT',
        relatedEntityId: data.customerId!,
        relatedEntityName: customerName || 'Customer',
        originalTransactionType: 'AR',
        originalTransactionId: firstInvoice.id,
        originalTransactionNumber: firstInvoice.registrationNumber,
        creditAmount: overpaymentAmount,
        notes: `Credit created from overpayment in Cash Register transaction`
      }, transaction);
    }
  }
  
  /**
   * Update AR invoices with payment allocation
   */
  private async updateARInvoices(
    invoicesToUpdate: any[],
    paymentAmount: number,
    totalOutstandingBalance: number,
    transaction: any
  ): Promise<void> {
    for (const arInvoice of invoicesToUpdate) {
      const currentReceived = parseFloat(arInvoice.receivedAmount.toString());
      const invoiceTotal = parseFloat(arInvoice.amount.toString());
      const invoiceBalance = parseFloat(arInvoice.balanceAmount.toString());
      
      // Calculate how much to apply to this invoice
      let amountToApply = paymentAmount;
      if (invoicesToUpdate.length > 1) {
        // Proportional distribution based on balance amount
        const proportion = invoiceBalance / totalOutstandingBalance;
        amountToApply = Math.min(paymentAmount * proportion, invoiceBalance);
      } else {
        // Single invoice - apply up to the balance amount
        amountToApply = Math.min(paymentAmount, invoiceBalance);
      }
      
      const newReceivedAmount = currentReceived + amountToApply;
      const newBalanceAmount = invoiceTotal - newReceivedAmount;
      const newStatus = newBalanceAmount <= 0.01 ? 'Received' : 'Partial';
      
      await arInvoice.update({
        receivedAmount: this.roundCurrency(newReceivedAmount),
        balanceAmount: this.roundCurrency(Math.max(0, newBalanceAmount)),
        status: newStatus,
      }, { transaction });
    }
  }
  
  /**
   * Process investment transaction (CONTRIBUTION/LOAN)
   */
  private async processInvestmentTransaction(data: CashTransactionRequest, transaction: any): Promise<void> {
    if (!data.investmentAgreementId) {
      throw new ValidationError('Investment Agreement ID is required for Contribution/Loan');
    }
    
    // Get and validate investment agreement
    const InvestmentAgreement = (await import('../models/InvestmentAgreement')).default;
    const agreement = await InvestmentAgreement.findByPk(data.investmentAgreementId);
    if (!agreement) {
      throw new NotFoundError('Investment Agreement not found');
    }
    
    if (agreement.status !== 'ACTIVE') {
      throw new BusinessLogicError('Investment Agreement is not active');
    }
    
    const receivingAmount = parseFloat(data.amount.toString());
    const currentBalance = parseFloat(agreement.balanceAmount.toString());
    
    if (receivingAmount > currentBalance) {
      throw new BusinessLogicError(
        `Cannot receive more than remaining balance. ` +
        `Agreement balance: ₹${currentBalance.toFixed(2)}, ` +
        `Trying to receive: ₹${receivingAmount.toFixed(2)}`
      );
    }
    
    // Update investment agreement
    const investmentAgreementService = (await import('../services/investmentAgreementService'));
    await investmentAgreementService.updateAgreementOnPayment(data.investmentAgreementId, receivingAmount);
  }
  
  /**
   * Process bank deposit
   */
  private async processBankDeposit(
    data: CashTransactionRequest,
    registrationNumber: string,
    lastBalance: number,
    outflowAmount: number,
    cashRegisterMaster: any,
    transaction: any
  ): Promise<CashRegister> {
    if (!data.bankAccountId) {
      throw new ValidationError('Bank Account ID is required for Bank Deposit');
    }
    
    // Get bank account
    const bankAccount = await BankAccount.findByPk(data.bankAccountId, { transaction });
    if (!bankAccount) {
      throw new NotFoundError('Bank Account not found');
    }
    
    // Calculate new cash register balance
    const newCashBalance = lastBalance - outflowAmount;
    
    // Create cash register OUTFLOW transaction
    const cashTransaction = await CashRegister.create({
      ...data,
      registrationNumber,
      balance: newCashBalance,
      cashRegisterId: data.cashRegisterId
    }, { transaction });
    
    // Update cash register master balance
    await cashRegisterMaster.update({
      balance: newCashBalance,
    }, { transaction });
    
    // Create corresponding bank register entry
    await this.createBankRegisterEntry(
      data,
      registrationNumber,
      cashRegisterMaster.name,
      bankAccount,
      transaction
    );
    
    return cashTransaction;
  }
  
  /**
   * Process correction transaction
   */
  private async processCorrection(
    data: CashTransactionRequest,
    registrationNumber: string,
    lastBalance: number,
    correctionAmount: number,
    cashRegisterMaster: any,
    transaction: any
  ): Promise<CashRegister> {
    const newBalance = lastBalance - correctionAmount;
    
    // Additional validation for corrections
    if (newBalance < 0) {
      throw new InsufficientBalanceError(
        `Correction would result in negative balance in cash register "${cashRegisterMaster.name}". ` +
        `Current balance: ₹${lastBalance.toFixed(2)}, Correction amount: ₹${correctionAmount.toFixed(2)}. ` +
        `Resulting balance would be: ₹${newBalance.toFixed(2)}. Cannot proceed.`
      );
    }
    
    const cashTransaction = await CashRegister.create({
      ...data,
      registrationNumber,
      balance: newBalance,
      cashRegisterId: data.cashRegisterId
    }, { transaction });
    
    // Update cash register master balance
    await cashRegisterMaster.update({
      balance: newBalance,
    }, { transaction });
    
    return cashTransaction;
  }
  
  /**
   * Create bank register entry for bank deposits
   */
  private async createBankRegisterEntry(
    data: CashTransactionRequest,
    cashRegistrationNumber: string,
    cashRegisterName: string,
    bankAccount: any,
    transaction: any
  ): Promise<void> {
    // Generate bank registration number
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
    
    const bankRegistrationNumber = `BR${String(nextBankNumber).padStart(4, '0')}`;
    
    const lastBankBalance = lastBankTransaction ? parseFloat(lastBankTransaction.balance.toString()) : 0;
    const newBankBalance = lastBankBalance + parseFloat(data.amount.toString());
    
    await BankRegister.create({
      registrationNumber: bankRegistrationNumber,
      registrationDate: data.registrationDate,
      transactionType: 'INFLOW',
      sourceTransactionType: 'TRANSFER', // ✅ FIX: Add source transaction type for cash register deposits
      amount: data.amount,
      paymentMethod: 'BANK_DEPOSIT',
      relatedDocumentType: 'Cash Register Deposit',
      relatedDocumentNumber: cashRegistrationNumber,
      clientName: `From ${cashRegisterName}`,
      description: `Bank deposit from ${cashRegisterName} - ${data.description}`,
      balance: newBankBalance,
      bankAccountId: data.bankAccountId,
    }, { transaction });
    
    // Update bank account balance
    const newBankAccountBalance = parseFloat(bankAccount.balance.toString()) + parseFloat(data.amount.toString());
    await bankAccount.update({
      balance: newBankAccountBalance,
    }, { transaction });
  }
}

// Export singleton instance
export const cashRegisterService = new CashRegisterService();

// Export individual methods for backward compatibility
export const getAllCashTransactions = () => 
  cashRegisterService.getAllCashTransactions();

export const getCashTransactionById = (id: number) => 
  cashRegisterService.getCashTransactionById(id);

export default cashRegisterService;

export const createCashTransaction = async (data: any, externalTransaction?: any) => {
  const transaction = externalTransaction || await sequelize.transaction();
  const shouldCommit = !externalTransaction;
  
  try {
    // Phase 3: Conditional Cash Register Validation
    const needsCashRegister = 
      data.relatedDocumentType === 'CONTRIBUTION' || 
      data.relatedDocumentType === 'LOAN' ||
      (data.relatedDocumentType === 'AR_COLLECTION' && data.paymentMethod === 'CASH');
    
    if (needsCashRegister && !data.cashRegisterId) {
      throw new Error('Cash Register selection is required for this transaction type');
    }

    // Get cash register master (only if needed)
    let cashRegisterMaster = null;
    if (needsCashRegister) {
      cashRegisterMaster = await CashRegisterMaster.findByPk(data.cashRegisterId, { transaction });
      if (!cashRegisterMaster) {
        throw new Error('Cash Register not found');
      }
    }

    // Generate registration number
    const lastTransaction = await CashRegister.findOne({
      where: {
        registrationNumber: {
          [Op.like]: 'CJ%'
        }
      },
      order: [['id', 'DESC']],
      transaction
    });
    
    let nextNumber = 1;
    if (lastTransaction) {
      const lastNumber = parseInt(lastTransaction.registrationNumber.substring(2));
      nextNumber = lastNumber + 1;
    }
    
    const registrationNumber = `CJ${String(nextNumber).padStart(4, '0')}`;
    
    // Get last balance for this specific cash register (only if cash register is involved)
    let lastBalance = 0;
    if (needsCashRegister && cashRegisterMaster) {
      const lastRegisterTransaction = await CashRegister.findOne({
        where: { cashRegisterId: data.cashRegisterId },
        order: [['id', 'DESC']],
        transaction
      });
      
      lastBalance = lastRegisterTransaction 
        ? parseFloat(lastRegisterTransaction.balance.toString()) 
        : parseFloat(cashRegisterMaster.balance.toString());
    }
    
    // Phase 3: Handle different transaction types
    if (data.transactionType === 'INFLOW') {
      // INFLOW: Money coming into cash register
      // Allow AR_COLLECTION (for Credit Sales and Credit Card Sales with customer info), CONTRIBUTION, and LOAN
      if (data.relatedDocumentType === 'AR_COLLECTION') {
        // AR Collection: For Credit Sales and Credit Card Sales with customer info
        if (!data.customerId) {
          throw new Error('Customer is required for AR Collection');
        }
        if (!data.invoiceIds || data.invoiceIds.length === 0) {
          throw new Error('At least one invoice must be selected for AR Collection');
        }
        
        // Phase 1: Overpayment Detection & Credit Balance Creation
        const invoiceIdsArray = JSON.parse(data.invoiceIds);
        let totalOutstandingBalance = 0;
        const invoicesToUpdate = [];
        
        // Calculate total outstanding balance and validate invoices
        for (const invoiceId of invoiceIdsArray) {
          const arInvoice = await AccountsReceivable.findByPk(invoiceId, { transaction });
          if (arInvoice) {
            // Verify this is from a Credit Sale or Credit Card Sale with customer info
            const allowedTypes = ['CREDIT_SALE', 'CLIENT_CREDIT', 'CREDIT_CARD_SALE', 'DEBIT_CARD_SALE'];
            if (!allowedTypes.includes(arInvoice.type)) {
              throw new Error(`Invoice ${arInvoice.registrationNumber} is not from a Credit Sale or Credit Card Sale. Only Credit Sales and Credit Card Sales with customer information can be collected through Cash Register.`);
            }
            
            // For credit card sales, ensure customer information is available
            if ((arInvoice.type === 'CREDIT_CARD_SALE' || arInvoice.type === 'DEBIT_CARD_SALE') && !arInvoice.clientId) {
              throw new Error(`Invoice ${arInvoice.registrationNumber} is a Credit Card Sale without customer information. Only Credit Card Sales with customer information can be collected through Cash Register.`);
            }
            
            totalOutstandingBalance += parseFloat(arInvoice.balanceAmount.toString());
            invoicesToUpdate.push(arInvoice);
          }
        }
        
        // Check for overpayment using existing service
        const paymentAmount = parseFloat(data.amount);
        if (paymentAmount > totalOutstandingBalance) {
          // Get customer name for overpayment validation
          const firstInvoice = invoicesToUpdate[0];
          const customerName = firstInvoice ? firstInvoice.clientName : 'Customer';
          
          const validation = await creditBalanceService.validatePaymentAmount(
            totalOutstandingBalance,
            paymentAmount,
            'CLIENT',
            customerName || 'Customer'
          );
          
          if (validation.isOverpayment) {
            // 🔥 CRITICAL: Skip credit balance creation if called from Customer Credit Aware Payment Service
            if (data.skipCreditBalanceCreation) {
              console.log('⚠️ Skipping credit balance creation - handled by Customer Credit Aware Payment Service');
            } else {
              // Create credit balance for overpayment
              const overpaymentAmount = validation.overpaymentAmount;
              const firstInvoice = invoicesToUpdate[0];
              
              await creditBalanceService.createCreditBalance({
                type: 'CUSTOMER_CREDIT',
                relatedEntityType: 'CLIENT',
                relatedEntityId: data.customerId,
                relatedEntityName: customerName || 'Customer',
                originalTransactionType: 'AR',
                originalTransactionId: firstInvoice.id,
                originalTransactionNumber: firstInvoice.registrationNumber,
                creditAmount: overpaymentAmount,
                notes: `Credit created from overpayment in Cash Register transaction ${registrationNumber}`
              });
            }
          }
        }
        
        // Update AR invoices - Credit Sales and Credit Card Sales with customer info
        for (const arInvoice of invoicesToUpdate) {
          const currentReceived = parseFloat(arInvoice.receivedAmount.toString());
          const invoiceTotal = parseFloat(arInvoice.amount.toString());
          const invoiceBalance = parseFloat(arInvoice.balanceAmount.toString());
          
          // Calculate how much to apply to this invoice (proportional if multiple invoices)
          let amountToApply = paymentAmount;
          if (invoicesToUpdate.length > 1) {
            // Proportional distribution based on balance amount
            const proportion = invoiceBalance / totalOutstandingBalance;
            amountToApply = Math.min(paymentAmount * proportion, invoiceBalance);
          } else {
            // Single invoice - apply up to the balance amount
            amountToApply = Math.min(paymentAmount, invoiceBalance);
          }
          
          const newReceivedAmount = currentReceived + amountToApply;
          const newBalanceAmount = invoiceTotal - newReceivedAmount;
          const newStatus = newBalanceAmount <= 0.01 ? 'Received' : 'Partial'; // Allow small rounding differences
          
          await arInvoice.update({
            receivedAmount: newReceivedAmount,
            balanceAmount: Math.max(0, newBalanceAmount), // Ensure no negative balance
            status: newStatus,
          }, { transaction });
        }
      }
      
      if (data.relatedDocumentType === 'CONTRIBUTION' || data.relatedDocumentType === 'LOAN') {
        // CONTRIBUTION/LOAN: Require investment agreement instead of just financer
        if (!data.investmentAgreementId) {
          throw new Error('Investment Agreement is required for Contribution/Loan');
        }
        
        // Get and validate investment agreement
        const InvestmentAgreement = require('../models/InvestmentAgreement').default;
        const agreement = await InvestmentAgreement.findByPk(data.investmentAgreementId);
        if (!agreement) {
          throw new Error('Investment Agreement not found');
        }
        
        if (agreement.status !== 'ACTIVE') {
          throw new Error('Investment Agreement is not active');
        }
        
        const receivingAmount = parseFloat(data.amount);
        const currentBalance = parseFloat(agreement.balanceAmount.toString());
        
        if (receivingAmount > currentBalance) {
          throw new Error(
            `Cannot receive more than remaining balance. ` +
            `Agreement balance: ${currentBalance}, ` +
            `Trying to receive: ${receivingAmount}`
          );
        }
        
        // Update investment agreement
        const investmentAgreementService = require('../services/investmentAgreementService');
        await investmentAgreementService.updateAgreementOnPayment(data.investmentAgreementId, receivingAmount);
        
        // ✅ COMPLETELY REMOVED: No AccountsPayable creation for CONTRIBUTION/LOAN transactions
        // These transactions are tracked through CashRegister + InvestmentAgreement only
        // AccountsPayable is only for credit/unpaid transactions, not cash transactions
      }
      
      // Calculate new balance (INFLOW increases balance, but only if cash register is involved)
      let newBalance = lastBalance;
      if (needsCashRegister) {
        newBalance = lastBalance + parseFloat(data.amount);
      }
      
      // Create cash register transaction
      const cashTransaction = await CashRegister.create({
        ...data,
        registrationNumber,
        balance: newBalance,
        // Set cashRegisterId to null if not needed
        cashRegisterId: needsCashRegister ? data.cashRegisterId : null,
      }, { transaction });
      
      // Update cash register master balance (only if cash register is involved)
      if (needsCashRegister && cashRegisterMaster) {
        await cashRegisterMaster.update({
          balance: newBalance,
        }, { transaction });
      }
      
      if (shouldCommit) await transaction.commit();
      return cashTransaction;
      
    } else if (data.transactionType === 'OUTFLOW') {
      // OUTFLOW: Money leaving cash register
      // Phase 3: Only allow BANK_DEPOSIT or CORRECTION
      
      // For OUTFLOW, cash register is always required (money must leave from somewhere)
      if (!data.cashRegisterId) {
        throw new Error('Cash Register selection is required for OUTFLOW transactions');
      }
      
      if (!cashRegisterMaster) {
        cashRegisterMaster = await CashRegisterMaster.findByPk(data.cashRegisterId, { transaction });
        if (!cashRegisterMaster) {
          throw new Error('Cash Register not found');
        }
        
        // Get last balance for OUTFLOW
        const lastRegisterTransaction = await CashRegister.findOne({
          where: { cashRegisterId: data.cashRegisterId },
          order: [['id', 'DESC']],
          transaction
        });
        
        lastBalance = lastRegisterTransaction 
          ? parseFloat(lastRegisterTransaction.balance.toString()) 
          : parseFloat(cashRegisterMaster.balance.toString());
      }
      
      // ✅ CRITICAL VALIDATION: Check if cash register has sufficient balance
      const outflowAmount = parseFloat(data.amount);
      if (lastBalance < outflowAmount) {
        throw new Error(
          `Insufficient balance in cash register "${cashRegisterMaster.name}". ` +
          `Available: ${lastBalance.toFixed(2)}, Required: ${outflowAmount.toFixed(2)}. ` +
          `Cannot perform transaction that would result in negative balance.`
        );
      }
      
      if (data.paymentMethod === 'BANK_DEPOSIT') {
        // Bank Deposit: Require bank account
        if (!data.bankAccountId) {
          throw new Error('Bank Account is required for Bank Deposit');
        }
        
        // Get bank account
        const bankAccount = await BankAccount.findByPk(data.bankAccountId, { transaction });
        if (!bankAccount) {
          throw new Error('Bank Account not found');
        }
        
        // Calculate new cash register balance (OUTFLOW decreases balance)
        const newCashBalance = lastBalance - outflowAmount;
        
        // Create cash register OUTFLOW transaction
        const cashTransaction = await CashRegister.create({
          ...data,
          registrationNumber,
          balance: newCashBalance,
        }, { transaction });
        
        // Update cash register master balance
        await cashRegisterMaster.update({
          balance: newCashBalance,
        }, { transaction });
        
        // Create bank register INFLOW transaction (money going into bank)
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
        
        const bankRegistrationNumber = `BR${String(nextBankNumber).padStart(4, '0')}`;
        
        const lastBankBalance = lastBankTransaction ? lastBankTransaction.balance : 0;
        const newBankBalance = lastBankBalance + parseFloat(data.amount);
        
        await BankRegister.create({
          registrationNumber: bankRegistrationNumber,
          registrationDate: data.registrationDate,
          transactionType: 'INFLOW',
          sourceTransactionType: 'TRANSFER', // ✅ FIX: Add source transaction type for cash register deposits
          amount: data.amount,
          paymentMethod: 'BANK_DEPOSIT',
          relatedDocumentType: 'Cash Register Deposit',
          relatedDocumentNumber: registrationNumber,
          clientName: `From ${cashRegisterMaster.name}`,
          description: `Bank deposit from ${cashRegisterMaster.name} - ${data.description}`,
          balance: newBankBalance,
          bankAccountId: data.bankAccountId,
        }, { transaction });
        
        // Update bank account balance
        const newBankAccountBalance = parseFloat(bankAccount.balance.toString()) + parseFloat(data.amount);
        await bankAccount.update({
          balance: newBankAccountBalance,
        }, { transaction });
        
        if (shouldCommit) await transaction.commit();
        return cashTransaction;
        
      } else if (data.paymentMethod === 'CORRECTION') {
        // Correction: Just adjust balance
        // ✅ VALIDATION: Also check balance for corrections to prevent negative
        const correctionAmount = parseFloat(data.amount);
        const newBalance = lastBalance - correctionAmount;
        
        if (newBalance < 0) {
          throw new Error(
            `Correction would result in negative balance in cash register "${cashRegisterMaster.name}". ` +
            `Current balance: ${lastBalance.toFixed(2)}, Correction amount: ${correctionAmount.toFixed(2)}. ` +
            `Resulting balance would be: ${newBalance.toFixed(2)}. Cannot proceed.`
          );
        }
        
        const cashTransaction = await CashRegister.create({
          ...data,
          registrationNumber,
          balance: newBalance,
        }, { transaction });
        
        // Update cash register master balance
        await cashRegisterMaster.update({
          balance: newBalance,
        }, { transaction });
        
        if (shouldCommit) await transaction.commit();
        return cashTransaction;
        
      } else {
        throw new Error('OUTFLOW only allows BANK_DEPOSIT or CORRECTION payment methods');
      }
    }
    
    throw new Error('Invalid transaction type');
    
  } catch (error) {
    if (shouldCommit) await transaction.rollback();
    throw error;
  }
};

export const getCashBalance = async () => {
  const lastTransaction = await CashRegister.findOne({
    order: [['id', 'DESC']]
  });
  
  return {
    balance: lastTransaction ? lastTransaction.balance : 0,
    lastUpdate: lastTransaction ? lastTransaction.registrationDate : null,
  };
};

// Phase 3: Get balance for specific cash register
export const getCashRegisterBalance = async (cashRegisterId: number) => {
  const cashRegisterMaster = await CashRegisterMaster.findByPk(cashRegisterId);
  if (!cashRegisterMaster) {
    throw new Error('Cash Register not found');
  }
  
  return {
    balance: cashRegisterMaster.balance,
    cashRegisterName: cashRegisterMaster.name,
    location: cashRegisterMaster.location,
  };
};

// Get pending AR invoices for a customer - ONLY Credit Sales
// Get pending Credit Sale and Credit Card Sale invoices for customer
export const getPendingCreditSaleInvoices = async (customerId: number) => {
  const pendingInvoices = await AccountsReceivable.findAll({
    where: {
      clientId: customerId,
      type: {
        [Op.in]: ['CREDIT_SALE', 'CLIENT_CREDIT', 'DEBIT_CARD_SALE'] // Include both credit sales and card sales with customer info
      },
      status: {
        [Op.in]: ['Pending', 'Partial']
      }
    },
    order: [['registrationDate', 'ASC']]
  });
  
  return pendingInvoices;
};

export const deleteCashTransaction = async (id: number) => {
  const transaction = await CashRegister.findByPk(id);
  if (!transaction) throw new Error('Cash transaction not found');
  await transaction.destroy();
  return { message: 'Cash transaction deleted successfully' };
};
