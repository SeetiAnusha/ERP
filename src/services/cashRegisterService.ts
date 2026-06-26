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
import { Op, QueryTypes } from 'sequelize';
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
import bankRegisterService from './bankRegisterService';
import { 
  CashRegisterSourceType, 
  normalizeCashRegisterSourceType,
  CashRegisterSourceTypeLabels 
} from '../types/CashRegisterSourceType';

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
  transferNumber?: string; // ✅ NEW: User-entered transfer number for bank deposits
  // Flag to prevent duplicate credit balance creation when called from Customer Credit Aware Payment Service
  skipCreditBalanceCreation?: boolean;
  
  // ✅ NEW: Fields for AR collection with card (prevent duplicate AR records)
  fromAccountsReceivable?: boolean;      // Flag to indicate source
  accountsReceivableId?: number;         // Existing AR record ID
  
  // ✅ PROFESSIONAL: Deposit tracking fields (for sales date vs deposit date clarity)
  sales_date?: Date | string;             // When money was earned
  deposit_date?: Date | string;           // When deposit physically happened
  deposit_reference_date?: Date | string; // Which day's sales this deposit is for
  deposit_time?: string;                  // Time of deposit (HH:MM:SS)
  deposited_by?: string;                  // Who made the deposit
  deposit_reference_number?: string;      // Bank reference number
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
      if (data.relatedDocumentType === CashRegisterSourceType.AR_COLLECTION) {
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
      if (data.relatedDocumentType === CashRegisterSourceType.CONTRIBUTION || data.relatedDocumentType === CashRegisterSourceType.LOAN) {
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
    search?: string;
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
      const { page = 1, limit = 50, search, transactionType, cashRegisterId, dateFrom, dateTo } = options;
      const offset = (page - 1) * limit;
      
      // Validate pagination parameters
      this.validateNumeric(page, 'Page number', { min: 1 });
      this.validateNumeric(limit, 'Limit', { min: 1, max: 100 });
      
      const whereClause: any = {};
      
      // ✅ Add search support
      if (search) {
        whereClause[Op.or] = [
          { registrationNumber: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } },
          { clientName: { [Op.like]: `%${search}%` } },
          { clientRnc: { [Op.like]: `%${search}%` } },
          { ncf: { [Op.like]: `%${search}%` } }
        ];
      }
      
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
        include: [
          {
            model: CashRegisterMaster,
            as: 'cashRegisterMaster',
            attributes: ['id', 'code', 'name', 'location'],
            required: false  // LEFT JOIN (some transactions may not have cashRegisterId)
          },
          {
            model: BankAccount,
            as: 'bankAccount',
            attributes: ['id', 'bankName', 'accountNumber', 'accountType'],
            required: false  // LEFT JOIN (some transactions may not have bankAccountId)
          }
        ],
        order: [['registrationDate', 'DESC'], ['createdAt', 'DESC']],
        limit,
        offset
      });
      
      // ✅ PROFESSIONAL: Transform and enrich data with normalized source types
      const enrichedTransactions = transactions.map(transaction => {
        const plainTransaction = transaction.get({ plain: true });
        
        return {
          ...plainTransaction,
          // Normalize source type to ensure consistency
          relatedDocumentType: normalizeCashRegisterSourceType(plainTransaction.relatedDocumentType),
          // Ensure document number is never undefined
          relatedDocumentNumber: plainTransaction.relatedDocumentNumber || null,
          // Add human-readable source label
          sourceLabel: CashRegisterSourceTypeLabels[
            normalizeCashRegisterSourceType(plainTransaction.relatedDocumentType)
          ]
        };
      });
      
      return {
        transactions: enrichedTransactions as any,
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
      
      console.log('🔵 [Cash Register] Starting transaction creation:', {
        transactionType: data.transactionType,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        relatedDocumentType: data.relatedDocumentType,
        cashRegisterId: data.cashRegisterId,
        bankAccountId: data.bankAccountId,
        customerId: data.customerId
      });
      
      // ✅ PROFESSIONAL: Normalize source type before validation
      const normalizedData = {
        ...data,
        relatedDocumentType: normalizeCashRegisterSourceType(data.relatedDocumentType)
      };
      
      // Step 1: Comprehensive validation using ValidationFramework
      this.validateCashTransactionRequest(normalizedData);
      console.log('✅ [Cash Register] Validation passed');
      
      // Step 2: Determine if cash register is required
      const needsCashRegister = this.determineIfCashRegisterRequired(normalizedData);
      console.log(`🔍 [Cash Register] Needs cash register: ${needsCashRegister}`);
      
      // Step 3: Validate and get cash register (if needed)
      let cashRegisterMaster = null;
      let lastBalance = 0;
      
      if (needsCashRegister) {
        if (!normalizedData.cashRegisterId) {
          throw new ValidationError('Cash Register selection is required for this transaction type');
        }
        
        cashRegisterMaster = await this.validateAndGetCashRegister(normalizedData.cashRegisterId, transaction);
        lastBalance = await this.getLastCashRegisterBalance(normalizedData.cashRegisterId, cashRegisterMaster, transaction);
        console.log(`💰 [Cash Register] Current balance: ₹${lastBalance}`);
      }
      
      // Step 4: Generate registration number
      const registrationNumber = await this.generateCashRegistrationNumber(transaction);
      console.log(`📝 [Cash Register] Generated registration number: ${registrationNumber}`);
      
      // Step 5: Process transaction based on type
      if (normalizedData.transactionType === 'INFLOW') {
        console.log('→ [Cash Register] Processing INFLOW transaction');
        return await this.processInflowTransaction(
          normalizedData,
          registrationNumber,
          lastBalance,
          cashRegisterMaster,
          needsCashRegister,
          transaction
        );
      } else {
        console.log('→ [Cash Register] Processing OUTFLOW transaction');
        return await this.processOutflowTransaction(
          normalizedData,
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
   * ✅ BANK_CHEQUE follows same rules as CASH
   */
  private determineIfCashRegisterRequired(data: CashTransactionRequest): boolean {
    const isCashOrCheque = data.paymentMethod === 'CASH' || data.paymentMethod === 'BANK_CHEQUE';
    
    return (
      (data.relatedDocumentType === CashRegisterSourceType.CONTRIBUTION && isCashOrCheque) || 
      (data.relatedDocumentType === CashRegisterSourceType.LOAN && isCashOrCheque) ||
      (data.relatedDocumentType === CashRegisterSourceType.AR_COLLECTION && isCashOrCheque) ||
      (data.relatedDocumentType === CashRegisterSourceType.SHAREHOLDER_CONTRIBUTOR && isCashOrCheque) ||
      (data.relatedDocumentType === CashRegisterSourceType.FINANCIER && isCashOrCheque) ||
      (data.relatedDocumentType === CashRegisterSourceType.SHAREHOLDER_LENDER && isCashOrCheque) ||
      (data.relatedDocumentType === CashRegisterSourceType.RELATED_PARTY_LENDER && isCashOrCheque) ||
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
   * Generate cash registration number.
   * Delegates to BaseService — advisory lock + MAX() prevents duplicates.
   */
  private async generateCashRegistrationNumber(transaction: any): Promise<string> {
    return this.generateRegistrationNumber('CJ', CashRegister, transaction);
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
    
    console.log('🔵 [INFLOW] Processing inflow transaction:', {
      relatedDocumentType: data.relatedDocumentType,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      needsCashRegister,
      cashRegisterMasterId: cashRegisterMaster?.id,
      bankAccountId: data.bankAccountId
    });
    
    // ✅ CRITICAL FIX: For AR Collection with bank payment methods, route to Bank Register
    // ⚠️ IMPORTANT: CHEQUE goes to Cash Register (physical cheque in hand), not Bank Register
    const bankPaymentMethods = ['BANK_TRANSFER', 'DEPOSIT', 'UPI'];
    const isARCollectionWithBankPayment = 
      data.relatedDocumentType === CashRegisterSourceType.AR_COLLECTION && 
      bankPaymentMethods.includes(data.paymentMethod);
    
    if (isARCollectionWithBankPayment) {
      console.log('💳 [INFLOW] AR Collection with bank payment - routing to Bank Register');
      
      if (!data.bankAccountId) {
        throw new ValidationError('Bank Account ID is required for bank payment methods');
      }
      
      // Process AR Collection (updates AR status)
      await this.processARCollection(data, transaction);
      
      // Create Bank Register entry instead of Cash Register
      await this.createBankRegisterForARCollection(data, registrationNumber, transaction);
      
      // Return a placeholder cash register entry (for response consistency)
      return {
        id: 0,
        registrationNumber,
        ...data,
        balance: lastBalance
      } as CashRegister;
    }
    
    // ✅ CRITICAL FIX: For AR Collection with Credit/Debit Card, ONLY mark collection_method (NO payment processing)
    const cardPaymentMethods = ['CREDIT_CARD', 'DEBIT_CARD'];
    const isARCollectionWithCard = 
      data.relatedDocumentType === CashRegisterSourceType.AR_COLLECTION && 
      cardPaymentMethods.includes(data.paymentMethod) &&
      data.fromAccountsReceivable === true &&  // Flag from frontend
      data.accountsReceivableId != null;       // Existing AR ID
    
    if (isARCollectionWithCard) {
      console.log('💳 [INFLOW] AR Collection with Card - ONLY mark collection_method (NO payment processing yet)');
      console.log('⚠️ [INFLOW] Actual payment will be recorded later via "Record Payment" button in AR page');
      
      // Process card collection marking (ONLY sets collection_method, NO payment processing)
      await this.processARCollectionWithCard(data, registrationNumber, transaction);
      
      // Return placeholder (no cash register entry needed)
      return {
        id: 0,
        registrationNumber,
        ...data,
        balance: lastBalance
      } as CashRegister;
    }
    
    if (data.relatedDocumentType === CashRegisterSourceType.AR_COLLECTION) {
      console.log('→ [INFLOW] Processing AR Collection (Cash payment)');
      await this.processARCollection(data, transaction);
    } else if (data.relatedDocumentType === CashRegisterSourceType.CONTRIBUTION || data.relatedDocumentType === CashRegisterSourceType.LOAN) {
      console.log('→ [INFLOW] Processing Investment Transaction');
      await this.processInvestmentTransaction(data, transaction);
      
      // ✅ NEW: For non-cash CONTRIBUTION/LOAN, create Bank Register entry instead
      if (!needsCashRegister && data.paymentMethod !== 'CASH') {
        await this.createBankRegisterForInvestment(data, transaction);
        
        // Return a placeholder cash register entry (won't be saved, just for response)
        return {
          id: 0,
          registrationNumber,
          ...data,
          balance: lastBalance
        } as CashRegister;
      }
    }
    
    // Calculate new balance (INFLOW increases balance, but only if cash register is involved)
    let newBalance = lastBalance;
    if (needsCashRegister) {
      newBalance = lastBalance + parseFloat(data.amount.toString());
      console.log(`💰 [INFLOW] Balance calculation: ₹${lastBalance} + ₹${data.amount} = ₹${newBalance}`);
    }
    
    // ✅ PROFESSIONAL: Add sales date and store info for INFLOW transactions
    const salesDate = data.sales_date || new Date(data.registrationDate);
    const storeCode = cashRegisterMaster?.code || null;
    const storeName = cashRegisterMaster?.name || null;
    
    // Create cash register transaction
    const cashTransactionData: any = {
      ...data,
      registrationNumber,
      balance: newBalance,
      // Add sales date and store info
      sales_date: salesDate,
      store_code: storeCode,
      store_name: storeName
    };
    
    if (needsCashRegister) {
      cashTransactionData.cashRegisterId = data.cashRegisterId;
    }
    
    console.log('📝 [INFLOW] Creating cash register transaction:', {
      registrationNumber,
      amount: data.amount,
      balance: newBalance,
      cashRegisterId: cashTransactionData.cashRegisterId
    });
    
    const cashTransaction = await CashRegister.create(cashTransactionData, { transaction });
    console.log(`✅ [INFLOW] Cash register transaction created: ${cashTransaction.id}`);
    
    // Update cash register master balance (only if cash register is involved)
    if (needsCashRegister && cashRegisterMaster) {
      const oldBalance = parseFloat(cashRegisterMaster.balance.toString());
      await cashRegisterMaster.update({
        balance: newBalance,
      }, { transaction });
      
      // ✅ ADD: Confirmation logging
      console.log(`✅ [Cash Register Balance Updated] ${cashRegisterMaster.name}: ₹${oldBalance} → ₹${newBalance} (+₹${parseFloat(data.amount.toString())})`);
    } else {
      console.log('⚠️ [INFLOW] Cash register master NOT updated (needsCashRegister=false or no cashRegisterMaster)');
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
   * Process AR Collection with partial payment support and overpayment handling
   */
  private async processARCollection(data: CashTransactionRequest, transaction: any): Promise<void> {
    console.log('🔵 [AR Collection] Starting AR collection processing');
    
    if (!data.customerId || !data.invoiceIds) {
      throw new ValidationError('Customer ID and Invoice IDs are required for AR Collection');
    }
    
    const invoiceIdsArray = JSON.parse(data.invoiceIds);
    console.log(`📋 [AR Collection] Processing ${invoiceIdsArray.length} invoice(s):`, invoiceIdsArray);
    
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
    
    const paymentAmount = parseFloat(data.amount.toString());
    console.log(`💰 [AR Collection] Payment: ₹${paymentAmount}, Outstanding: ₹${totalOutstandingBalance}`);
    
    // 🔥 CRITICAL FIX: Support partial payments
    // Allow payment amount to be less than, equal to, or more than outstanding balance
    
    if (paymentAmount > totalOutstandingBalance) {
      // Overpayment scenario
      console.log(`⚠️ [AR Collection] Overpayment detected: ₹${paymentAmount - totalOutstandingBalance}`);
      
      await this.handleAROverpayment(
        data,
        paymentAmount,
        totalOutstandingBalance,
        invoicesToUpdate[0],
        transaction
      );
    } else if (paymentAmount < totalOutstandingBalance) {
      // Partial payment scenario
      console.log(`✅ [AR Collection] Partial payment: ₹${paymentAmount} of ₹${totalOutstandingBalance}`);
    } else {
      // Exact payment scenario
      console.log(`✅ [AR Collection] Exact payment: ₹${paymentAmount}`);
    }
    
    // Update AR invoices with the actual payment amount
    console.log('→ [AR Collection] Updating AR invoices...');
    await this.updateARInvoices(invoicesToUpdate, paymentAmount, totalOutstandingBalance, transaction);
    console.log('✅ [AR Collection] AR invoices updated successfully');
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
   * Process AR Collection with Credit/Debit Card
   * ONLY marks the collection_method field - NO payment processing yet
   * Actual payment will be recorded later via "Record Payment" button in AR page
   * 
   * Time Complexity: O(1) - Single AR record update
   * Space Complexity: O(1) - No additional data structures
   */
  private async processARCollectionWithCard(
    data: CashTransactionRequest,
    registrationNumber: string,
    transaction: any
  ): Promise<void> {
    
    console.log('💳 [AR Collection Card] Starting card collection marking (NO payment processing yet)');
    
    // Validate required fields
    if (!data.accountsReceivableId) {
      throw new ValidationError('Accounts Receivable ID is required for card collection');
    }
    
    // Get existing AR record
    const arRecord = await AccountsReceivable.findByPk(
      data.accountsReceivableId, 
      { transaction }
    );
    
    if (!arRecord) {
      throw new NotFoundError(`Accounts Receivable record with ID ${data.accountsReceivableId} not found`);
    }
    
    console.log(`📋 [AR Collection Card] Found AR record: ${arRecord.registrationNumber}`);
    console.log(`💰 [AR Collection Card] Current balance: ₹${arRecord.balanceAmount}`);
    
    // ✅ ONLY UPDATE collection_method field (NO amount changes, NO payment processing)
    await arRecord.update({
      collection_method: data.paymentMethod,  // ✅ Mark as CREDIT_CARD or DEBIT_CARD
      collectionDate: new Date(),
      collectionNotes: `Marked for ${data.paymentMethod} payment via Cash Register on ${new Date().toLocaleDateString()}. Amount: ₹${data.amount}. Payment will be recorded later.`
    }, { transaction });
    
    console.log(`✅ [AR Collection Card] Marked AR record ${arRecord.id} with collection_method: ${data.paymentMethod}`);
    console.log(`⚠️ [AR Collection Card] NO payment processed yet - amounts unchanged`);
    console.log(`⚠️ [AR Collection Card] NO Bank Register entry created - will be created when "Record Payment" is clicked`);
    console.log(`✅ [AR Collection Card] "Record Payment" button will be enabled in AR page for this record`);
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
    const agreement = await InvestmentAgreement.findByPk(data.investmentAgreementId, { transaction });
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
    
    // Update investment agreement - pass transaction to ensure atomicity
    const investmentAgreementService = (await import('../services/investmentAgreementService'));
    await investmentAgreementService.updateAgreementOnPayment(data.investmentAgreementId, receivingAmount, transaction);
  }
  
  /**
   * Create Bank Register entry for non-cash CONTRIBUTION/LOAN transactions
   */
  private async createBankRegisterForInvestment(data: CashTransactionRequest, transaction: any): Promise<void> {
    console.log('💰 [Investment] Creating Bank Register entry for non-cash CONTRIBUTION/LOAN');
    
    if (!data.bankAccountId) {
      throw new ValidationError('Bank Account ID is required for non-cash investment transactions');
    }
    
    // Get bank account details
    const bankAccount = await BankAccount.findByPk(data.bankAccountId, { transaction });
    if (!bankAccount) {
      throw new NotFoundError('Bank Account not found');
    }
    
    // Get investor details from investment agreement
    const InvestmentAgreement = (await import('../models/InvestmentAgreement')).default;
    const agreement = await InvestmentAgreement.findByPk(data.investmentAgreementId, { transaction });
    
    const investorName = agreement?.investorName || 'Unknown Investor';
    
    // Create Bank Register entry
    // bankRegisterService already imported at top
    const bankRegisterData = {
      registrationDate: data.registrationDate || new Date(),
      transactionType: 'INFLOW' as const,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      relatedDocumentType: data.relatedDocumentType, // 'CONTRIBUTION' or 'LOAN'
      relatedDocumentNumber: data.relatedDocumentNumber || '',
      clientName: investorName,
      clientRnc: '',
      description: `${data.relatedDocumentType} from ${investorName} via ${data.paymentMethod}`,
      bankAccountId: data.bankAccountId,
      bankAccountName: `${bankAccount.bankName} - ${bankAccount.accountNumber}`,
      chequeNumber: (data as any).chequeNumber,
      transferNumber: (data as any).transferNumber,
      sourceTransactionType: 'TRANSFER' as any
    };
    
    await bankRegisterService.createBankRegister(bankRegisterData, transaction);
    console.log('✅ [Investment] Bank Register entry created successfully');
  }

  /**
   * Create Bank Register entry for AR Collection with bank payment methods
   */
  private async createBankRegisterForARCollection(
    data: CashTransactionRequest,
    cashRegistrationNumber: string,
    transaction: any
  ): Promise<void> {
    console.log('💳 [AR Collection] Creating Bank Register entry for bank payment');
    
    if (!data.bankAccountId) {
      throw new ValidationError('Bank Account ID is required for bank payment methods');
    }
    
    // Get bank account details
    const bankAccount = await BankAccount.findByPk(data.bankAccountId, { transaction });
    if (!bankAccount) {
      throw new NotFoundError('Bank Account not found');
    }
    
    // Get customer name
    const customerName = data.customerName || 'Customer';
    
    // Create Bank Register entry
    const bankRegisterData = {
      registrationDate: data.registrationDate || new Date(),
      transactionType: 'INFLOW' as const,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      relatedDocumentType: 'AR_COLLECTION',
      relatedDocumentNumber: cashRegistrationNumber,
      clientName: customerName,
      clientRnc: '',
      description: data.description || `AR Collection from ${customerName} via ${data.paymentMethod}`,
      bankAccountId: data.bankAccountId,
      bankAccountName: `${bankAccount.bankName} - ${bankAccount.accountNumber}`,
      chequeNumber: (data as any).chequeNumber,
      transferNumber: (data as any).transferNumber,
      sourceTransactionType: 'TRANSFER' as any
    };
    
    await bankRegisterService.createBankRegister(bankRegisterData, transaction);
    
    console.log(`✅ [AR Collection] Bank Register entry created successfully`);
    console.log(`✅ [Bank Account Balance Updated] ${bankAccount.bankName} (${bankAccount.accountNumber}): Bank balance updated with ₹${parseFloat(data.amount.toString())}`);
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
    
    // ✅ Deposit tracking: classify by calendar YYYY-MM-DD (not clock time) so "yesterday's takings deposited today" is reliable
    const extractYmd = (v: unknown): string => {
      if (v == null || v === '') return '';
      if (typeof v === 'string') return v.slice(0, 10);
      try {
        return new Date(v as Date).toISOString().slice(0, 10);
      } catch {
        return '';
      }
    };
    const depYmd = extractYmd((data as any).deposit_date ?? data.registrationDate);
    const salesYmd = extractYmd(data.sales_date ?? data.registrationDate);
    const isPreviousDayDeposit =
      salesYmd.length >= 10 && depYmd.length >= 10 && salesYmd < depYmd;
    const tSales = Date.UTC(
      parseInt(salesYmd.slice(0, 4), 10),
      parseInt(salesYmd.slice(5, 7), 10) - 1,
      parseInt(salesYmd.slice(8, 10), 10)
    );
    const tDep = Date.UTC(
      parseInt(depYmd.slice(0, 4), 10),
      parseInt(depYmd.slice(5, 7), 10) - 1,
      parseInt(depYmd.slice(8, 10), 10)
    );
    const daysDifference =
      salesYmd.length >= 10 && depYmd.length >= 10
        ? Math.floor((tDep - tSales) / (1000 * 60 * 60 * 24))
        : 0;

    const salesDate = data.sales_date ? new Date(data.sales_date as any) : new Date(data.registrationDate);
    const depositDate = (data as any).deposit_date
      ? new Date((data as any).deposit_date)
      : new Date(data.registrationDate);
    const depositReferenceDate = data.deposit_reference_date
      ? new Date(data.deposit_reference_date)
      : salesDate;
    
    // Get store info from cash register master
    const storeCode = cashRegisterMaster.code;
    const storeName = cashRegisterMaster.name;
    
    // Create cash register OUTFLOW transaction with deposit tracking
    const cashTransaction = await CashRegister.create({
      ...data,
      registrationNumber,
      balance: newCashBalance,
      cashRegisterId: data.cashRegisterId,
      // Deposit tracking fields (all properly typed as Date)
      sales_date: salesDate,
      deposit_date: depositDate,
      deposit_reference_date: depositReferenceDate,
      is_previous_day_deposit: isPreviousDayDeposit,
      deposit_time: data.deposit_time || new Date().toTimeString().split(' ')[0],
      deposited_by: data.deposited_by || 'System',
      deposit_reference_number: data.deposit_reference_number || data.transferNumber || registrationNumber,
      store_code: storeCode,
      store_name: storeName
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
      registrationNumber,
      registrationDate: data.registrationDate,
      transactionType: data.transactionType,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      relatedDocumentType: data.relatedDocumentType,
      relatedDocumentNumber: data.relatedDocumentNumber,
      description: data.description,
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
      bankAccountName: `${bankAccount.bankName} - ${bankAccount.accountNumber}`, // ✅ ADD: Bank name for display
      transferNumber: data.transferNumber || cashRegistrationNumber,  // ✅ UPDATED: Use user-entered transfer number or fallback to cash register number
      originalPaymentType: 'BANK_DEPOSIT',     // ✅ ADD: Clearly identify as bank deposit transaction
      accountType: bankAccount.accountType,     // ✅ ADD: Store account type (CHECKING/SAVINGS) from bank account
    }, { transaction });
    
    // Update bank account balance
    const newBankAccountBalance = parseFloat(bankAccount.balance.toString()) + parseFloat(data.amount.toString());
    await bankAccount.update({
      balance: newBankAccountBalance,
    }, { transaction });
    
    // ✅ ADD: Confirmation logging
    console.log(`✅ [Bank Account Balance Updated] ${bankAccount.bankName} (${bankAccount.accountNumber}): ₹${parseFloat(bankAccount.balance.toString())} → ₹${newBankAccountBalance} (+₹${parseFloat(data.amount.toString())})`);
  }
}

// Export singleton instance
export const cashRegisterService = new CashRegisterService();

// Export individual methods for backward compatibility
export const getAllCashTransactions = (options?: any) => 
  cashRegisterService.getAllCashTransactions(options);

export const getAllCashTransactionsWithPagination = (options?: any) => 
  cashRegisterService.getAllCashTransactions(options);

export const getCashTransactionById = (id: number) => 
  cashRegisterService.getCashTransactionById(id);

export default cashRegisterService;

export const createCashTransaction = async (data: any, externalTransaction?: any) => {
  return cashRegisterService.createCashTransaction(data, externalTransaction);
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

const EOD_REPORT_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * End-of-day report source of truth: full history (no pagination), opening = last running balance before report day.
 */
export const getEndOfDayReportData = async (reportDateStr: string) => {
  if (!EOD_REPORT_DATE_REGEX.test(reportDateStr)) {
    throw new ValidationError('Invalid date: expected YYYY-MM-DD');
  }

  // UTC calendar day [start, nextStart) — matches frontend filter on ISO date prefix (YYYY-MM-DD)
  const [y, mo, d] = reportDateStr.split('-').map((n) => parseInt(n, 10));
  const dayStartUtc = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
  const nextDayStartUtc = new Date(Date.UTC(y, mo - 1, d + 1, 0, 0, 0, 0));

  const masters = await CashRegisterMaster.findAll({
    where: { status: 'ACTIVE' },
    order: [['id', 'ASC']]
  });

  const include = [
    {
      model: CashRegisterMaster,
      as: 'cashRegisterMaster',
      attributes: ['id', 'code', 'name', 'location'],
      required: false
    },
    {
      model: BankAccount,
      as: 'bankAccount',
      attributes: ['id', 'bankName', 'accountNumber', 'accountType'],
      required: false
    }
  ];

  const stores: any[] = [];

  for (const master of masters) {
    const cid = master.id;

    const lastBefore = await CashRegister.findOne({
      where: {
        cashRegisterId: cid,
        registrationDate: { [Op.lt]: dayStartUtc }
      },
      // registrationDate alone is wrong when e.g. deposit is date-only midnight UTC
      // but sale is same calendar day at noon — DESC by date picks sale (6000) not final cash (3000).
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC']
      ]
    });

    const openingBalance = lastBefore ? parseFloat(String(lastBefore.get('balance'))) : 0;

    const dayRows = await CashRegister.findAll({
      where: {
        cashRegisterId: cid,
        registrationDate: { [Op.gte]: dayStartUtc, [Op.lt]: nextDayStartUtc }
      },
      include: include as any,
      order: [['registrationDate', 'ASC'], ['id', 'ASC']]
    });

    const transactions = dayRows.map((row) => {
      const plain = row.get({ plain: true }) as any;
      return {
        ...plain,
        relatedDocumentType: normalizeCashRegisterSourceType(plain.relatedDocumentType),
        relatedDocumentNumber: plain.relatedDocumentNumber || null,
        sourceLabel:
          CashRegisterSourceTypeLabels[
            normalizeCashRegisterSourceType(plain.relatedDocumentType)
          ]
      };
    });

    stores.push({
      id: master.id,
      name: master.name,
      code: master.code,
      location: master.location,
      openingBalance,
      transactions
    });
  }

  return { reportDate: reportDateStr, stores };
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

/**
 * Create Shareholder Contribution Transaction
 * 
 * Business Rules:
 * - IMMEDIATE PAYMENT (increase equity NOW): CASH, CHECK, TRANSFER
 * - FUTURE PAYMENT (mark AR, increase equity LATER): CREDIT/DEBIT CARD
 * 
 * @param data Shareholder contribution data
 * @returns Created transaction
 */
export const createShareholderContribution = async (data: {
  registrationDate: Date;
  shareholderId: number;
  shareholderAmount: number;
  paymentMethod: string;
  description: string;
  cashRegisterId?: number;
  bankAccountId?: number;
  relatedDocumentType: string; // Should be one of the financer types
}) => {
  return sequelize.transaction(async (transaction) => {
    console.log('🔵 [Shareholder Contribution] Starting transaction:', {
      shareholderId: data.shareholderId,
      amount: data.shareholderAmount,
      paymentMethod: data.paymentMethod,
      relatedDocumentType: data.relatedDocumentType
    });
    
    // Validate shareholder exists
    const Financer = require('../models/Financer').default;
    const shareholder = await Financer.findByPk(data.shareholderId, { transaction });
    if (!shareholder) {
      throw new NotFoundError(`Shareholder with ID ${data.shareholderId} not found`);
    }
    
    // Validate shareholder is active
    if (shareholder.status !== 'ACTIVE') {
      throw new BusinessLogicError('Cannot record contribution for inactive shareholder');
    }
    
    // Validate amount
    if (!data.shareholderAmount || data.shareholderAmount <= 0) {
      throw new ValidationError('Shareholder contribution amount must be greater than 0');
    }
    
    const cardPaymentMethods = ['CREDIT_CARD', 'DEBIT_CARD'];
    const isCardPayment = cardPaymentMethods.includes(data.paymentMethod);
    
    if (isCardPayment) {
      // FUTURE PAYMENT: Create AR record (like Credit Card Sale Collection)
      console.log('💳 [Shareholder Contribution] Card payment - creating AR record (FUTURE payment)');
      
      const registrationNumber = await generateARRegistrationNumber(transaction);
      
      await AccountsReceivable.create({
        registrationNumber,
        registrationDate: data.registrationDate,
        type: 'SHAREHOLDER_CONTRIBUTION_PENDING', // ✅ Specific type for shareholder contribution
        relatedDocumentType: data.relatedDocumentType,
        relatedDocumentId: data.shareholderId,
        relatedDocumentNumber: shareholder.code,
        clientName: shareholder.name,
        amount: data.shareholderAmount,
        receivedAmount: 0,
        balanceAmount: data.shareholderAmount,
        expectedBankDeposit: data.shareholderAmount, // ✅ Required field
        status: 'Pending',
        collection_method: data.paymentMethod,
        notes: data.description || `Shareholder contribution from ${shareholder.name} via ${data.paymentMethod}`
      }, { transaction });
      
      console.log(`✅ [Shareholder Contribution] AR record created: ${registrationNumber}`);
      console.log('⚠️ [Shareholder Contribution] Equity will increase ONLY when payment is actually received');
      
      return {
        message: 'Shareholder contribution marked as pending (Card payment)',
        registrationNumber,
        shareholderName: shareholder.name,
        amount: data.shareholderAmount,
        paymentMethod: data.paymentMethod,
        note: 'Equity will increase when payment is received via AR page'
      };
      
    } else {
      // IMMEDIATE PAYMENT: Process now (CASH, CHECK, TRANSFER)
      console.log('💰 [Shareholder Contribution] Immediate payment - processing now');
      
      // Determine transaction routing
      // ✅ BANK_CHEQUE follows same rules as CASH (goes to Cash Register)
      const needsCashRegister = data.paymentMethod === 'CASH' || data.paymentMethod === 'CHECK' || data.paymentMethod === 'BANK_CHEQUE';
      // ✅ BANK_TRANSFER and DEPOSIT go to Bank Account (immediate payment)
      const needsBankAccount = data.paymentMethod === 'BANK_TRANSFER' || data.paymentMethod === 'DEPOSIT' || data.paymentMethod === 'UPI';
      
      if (needsCashRegister && !data.cashRegisterId) {
        throw new ValidationError('Cash Register selection is required for CASH/CHECK/BANK_CHEQUE payments');
      }
      
      if (needsBankAccount && !data.bankAccountId) {
        throw new ValidationError('Bank Account selection is required for BANK_TRANSFER/DEPOSIT/UPI payments');
      }
      
      // Generate registration number
      const registrationNumber = await generateCashRegistrationNumber(transaction);
      
      // Create cash register entry (if needed)
      let cashTransaction = null;
      if (needsCashRegister) {
        const cashRegisterMaster = await CashRegisterMaster.findByPk(data.cashRegisterId, { transaction });
        if (!cashRegisterMaster) {
          throw new NotFoundError('Cash Register not found');
        }
        
        const lastBalance = await getLastCashRegisterBalance(data.cashRegisterId!, cashRegisterMaster, transaction);
        const newBalance = lastBalance + data.shareholderAmount;
        
        cashTransaction = await CashRegister.create({
          registrationNumber,
          registrationDate: data.registrationDate,
          transactionType: 'INFLOW',
          amount: data.shareholderAmount,
          paymentMethod: data.paymentMethod,
          relatedDocumentType: data.relatedDocumentType,
          relatedDocumentNumber: shareholder.code,
          description: data.description,
          cashRegisterId: data.cashRegisterId,
          shareholderId: data.shareholderId,
          shareholderAmount: data.shareholderAmount,
          balance: newBalance
        }, { transaction });
        
        // Update cash register master balance
        await cashRegisterMaster.update({ balance: newBalance }, { transaction });
        
        console.log(`✅ [Cash Register] Balance updated: ₹${lastBalance} → ₹${newBalance}`);
      }
      
      // Create bank register entry (if needed)
      if (needsBankAccount) {
        const TransactionType = require('../types/TransactionType').TransactionType;
        
        await bankRegisterService.createBankRegister({
          registrationDate: data.registrationDate,
          transactionType: 'INFLOW',
          amount: data.shareholderAmount,
          paymentMethod: data.paymentMethod,
          sourceTransactionType: TransactionType.PAYMENT, // Generic payment type for shareholder contributions
          relatedDocumentType: data.relatedDocumentType,
          relatedDocumentNumber: shareholder.code,
          description: data.description,
          bankAccountId: data.bankAccountId,
          transferNumber: registrationNumber,
          clientName: shareholder.name
        }, transaction);
        
        console.log(`✅ [Bank Register] Entry created for ${data.paymentMethod}`);
      }
      
      // Update shareholder equity (IMMEDIATE)
      const newTotalContributed = Number(shareholder.total_contributed) + data.shareholderAmount;
      const newOutstandingBalance = Number(shareholder.outstanding_balance) + data.shareholderAmount;
      
      await shareholder.update({
        total_contributed: newTotalContributed,
        outstanding_balance: newOutstandingBalance
      }, { transaction });
      
      console.log(`✅ [Shareholder Equity] Updated ${shareholder.name}:`);
      console.log(`   Total Contributed: ₹${shareholder.total_contributed} → ₹${newTotalContributed}`);
      console.log(`   Outstanding Balance: ₹${shareholder.outstanding_balance} → ₹${newOutstandingBalance}`);
      
      return {
        message: 'Shareholder contribution recorded successfully',
        registrationNumber,
        shareholderName: shareholder.name,
        amount: data.shareholderAmount,
        paymentMethod: data.paymentMethod,
        cashTransaction,
        newTotalContributed,
        newOutstandingBalance
      };
    }
  });
};

/**
 * Create Loan Receipt from Lenders (FINANCIER, SHAREHOLDER_LENDER, RELATED_PARTY_LENDER)
 * 
 * Business Rules:
 * - Creates ACCOUNTS PAYABLE record (liability, not equity)
 * - Updates financer balance (total_contributed, outstanding_balance)
 * - Routes money based on payment method:
 *   - IMMEDIATE PAYMENT (goes to register NOW): CASH, CHECK, BANK_CHEQUE
 *   - BANK PAYMENT (goes to bank NOW): BANK_TRANSFER, DEPOSIT, UPI
 *   - FUTURE PAYMENT (mark AR, receive LATER): CREDIT/DEBIT CARD
 * 
 * @param data Loan receipt data
 * @returns Created transaction
 */
export const createLoanReceipt = async (data: {
  registrationDate: Date;
  lenderId: number;
  lenderType: 'FINANCIER' | 'SHAREHOLDER_LENDER' | 'RELATED_PARTY_LENDER';
  loanAmount: number;
  paymentMethod: string;
  description: string;
  cashRegisterId?: number;
  bankAccountId?: number;
  relatedDocumentType: string; // Should be one of the lender types
}) => {
  return sequelize.transaction(async (transaction) => {
    console.log('🔵 [Loan Receipt] Starting transaction:', {
      lenderId: data.lenderId,
      lenderType: data.lenderType,
      amount: data.loanAmount,
      paymentMethod: data.paymentMethod,
      relatedDocumentType: data.relatedDocumentType
    });
    
    // Validate lender exists
    const Financer = require('../models/Financer').default;
    const lender = await Financer.findByPk(data.lenderId, { transaction });
    if (!lender) {
      throw new NotFoundError(`Lender with ID ${data.lenderId} not found`);
    }
    
    // Validate lender is active
    if (lender.status !== 'ACTIVE') {
      throw new BusinessLogicError('Cannot record loan receipt for inactive lender');
    }
    
    // Validate lender type matches
    if (lender.financer_type !== data.lenderType) {
      throw new ValidationError(`Lender type mismatch: expected ${data.lenderType}, got ${lender.financer_type}`);
    }
    
    // Validate amount
    if (!data.loanAmount || data.loanAmount <= 0) {
      throw new ValidationError('Loan amount must be greater than 0');
    }
    
    const cardPaymentMethods = ['CREDIT_CARD', 'DEBIT_CARD'];
    const isCardPayment = cardPaymentMethods.includes(data.paymentMethod);
    
    // Generate registration numbers
    const apRegistrationNumber = await generateAPRegistrationNumber(transaction);
    const cashRegistrationNumber = await generateCashRegistrationNumber(transaction);
    
    if (isCardPayment) {
      // FUTURE PAYMENT: Create AR record (like Credit Card Sale Collection)
      console.log('💳 [Loan Receipt] Card payment - creating AR record (FUTURE payment)');
      
      const arRegistrationNumber = await generateARRegistrationNumber(transaction);
      
      await AccountsReceivable.create({
        registrationNumber: arRegistrationNumber,
        registrationDate: data.registrationDate,
        type: `${data.lenderType}_LOAN_PENDING`, // e.g., FINANCIER_LOAN_PENDING
        relatedDocumentType: data.relatedDocumentType,
        relatedDocumentId: data.lenderId,
        relatedDocumentNumber: lender.code,
        clientName: lender.name,
        amount: data.loanAmount,
        receivedAmount: 0,
        balanceAmount: data.loanAmount,
        expectedBankDeposit: data.loanAmount,
        status: 'Pending',
        collection_method: data.paymentMethod,
        notes: data.description || `Loan from ${lender.name} (${data.lenderType}) via ${data.paymentMethod}`
      }, { transaction });
      
      console.log(`✅ [Loan Receipt] AR record created: ${arRegistrationNumber}`);
      console.log('⚠️ [Loan Receipt] AP and financer balance will be updated ONLY when payment is actually received');
      
      return {
        message: 'Loan receipt marked as pending (Card payment)',
        registrationNumber: arRegistrationNumber,
        lenderName: lender.name,
        lenderType: data.lenderType,
        amount: data.loanAmount,
        paymentMethod: data.paymentMethod,
        note: 'Accounts Payable will be created when payment is received via AR page'
      };
      
    } else {
      // IMMEDIATE PAYMENT: Process now (CASH, CHECK, TRANSFER)
      console.log('💰 [Loan Receipt] Immediate payment - processing now');
      
      // Determine transaction routing
      const needsCashRegister = data.paymentMethod === 'CASH' || data.paymentMethod === 'CHECK' || data.paymentMethod === 'BANK_CHEQUE';
      const needsBankAccount = data.paymentMethod === 'BANK_TRANSFER' || data.paymentMethod === 'DEPOSIT' || data.paymentMethod === 'UPI';
      
      if (needsCashRegister && !data.cashRegisterId) {
        throw new ValidationError('Cash Register selection is required for CASH/CHECK/BANK_CHEQUE payments');
      }
      
      if (needsBankAccount && !data.bankAccountId) {
        throw new ValidationError('Bank Account selection is required for BANK_TRANSFER/DEPOSIT/UPI payments');
      }
      
      // Create cash register entry (if needed)
      let cashTransaction = null;
      if (needsCashRegister) {
        const cashRegisterMaster = await CashRegisterMaster.findByPk(data.cashRegisterId, { transaction });
        if (!cashRegisterMaster) {
          throw new NotFoundError('Cash Register not found');
        }
        
        const lastBalance = await getLastCashRegisterBalance(data.cashRegisterId!, cashRegisterMaster, transaction);
        const newBalance = lastBalance + data.loanAmount;
        
        cashTransaction = await CashRegister.create({
          registrationNumber: cashRegistrationNumber,
          registrationDate: data.registrationDate,
          transactionType: 'INFLOW',
          amount: data.loanAmount,
          paymentMethod: data.paymentMethod,
          relatedDocumentType: data.relatedDocumentType,
          relatedDocumentNumber: lender.code,
          description: data.description,
          cashRegisterId: data.cashRegisterId,
          balance: newBalance
        }, { transaction });
        
        // Update cash register master balance
        await cashRegisterMaster.update({ balance: newBalance }, { transaction });
        
        console.log(`✅ [Cash Register] Balance updated: ₹${lastBalance} → ₹${newBalance}`);
      }
      
      // Create bank register entry (if needed)
      if (needsBankAccount) {
        const TransactionType = require('../types/TransactionType').TransactionType;
        
        await bankRegisterService.createBankRegister({
          registrationDate: data.registrationDate,
          transactionType: 'INFLOW',
          amount: data.loanAmount,
          paymentMethod: data.paymentMethod,
          sourceTransactionType: TransactionType.PAYMENT, // Generic payment type for loan receipts
          relatedDocumentType: data.relatedDocumentType,
          relatedDocumentNumber: lender.code,
          description: data.description,
          bankAccountId: data.bankAccountId,
          transferNumber: cashRegistrationNumber,
          clientName: lender.name
        }, transaction);
        
        console.log(`✅ [Bank Register] Entry created for ${data.paymentMethod}`);
      }
      
      // Create Accounts Payable record (LIABILITY)
      const AccountsPayable = require('../models/AccountsPayable').default;
      const TransactionType = require('../types/TransactionType').TransactionType;
      
      const apType = `${data.lenderType}_LOAN`; // e.g., FINANCIER_LOAN, SHAREHOLDER_LENDER_LOAN
      
      await AccountsPayable.create({
        registrationNumber: apRegistrationNumber,
        registrationDate: data.registrationDate,
        type: apType,
        sourceTransactionType: TransactionType.PAYMENT,
        relatedDocumentType: data.relatedDocumentType,
        relatedDocumentId: data.lenderId,
        relatedDocumentNumber: lender.code,
        financerId: data.lenderId,
        financerName: lender.name,
        loanAmount: data.loanAmount,
        interestRate: lender.interest_rate,
        amount: data.loanAmount,
        paidAmount: 0,
        balanceAmount: data.loanAmount,
        status: 'Pending',
        notes: data.description || `Loan received from ${lender.name} (${data.lenderType})`
      }, { transaction });
      
      console.log(`✅ [Accounts Payable] Record created: ${apRegistrationNumber} (${apType})`);
      
      // Update lender balance (IMMEDIATE)
      const newTotalContributed = Number(lender.total_contributed) + data.loanAmount;
      const newOutstandingBalance = Number(lender.outstanding_balance) + data.loanAmount;
      
      await lender.update({
        total_contributed: newTotalContributed,
        outstanding_balance: newOutstandingBalance
      }, { transaction });
      
      console.log(`✅ [Lender Balance] Updated ${lender.name}:`);
      console.log(`   Total Contributed: ₹${lender.total_contributed} → ₹${newTotalContributed}`);
      console.log(`   Outstanding Balance: ₹${lender.outstanding_balance} → ₹${newOutstandingBalance}`);
      
      return {
        message: 'Loan receipt recorded successfully',
        apRegistrationNumber,
        cashRegistrationNumber,
        lenderName: lender.name,
        lenderType: data.lenderType,
        amount: data.loanAmount,
        paymentMethod: data.paymentMethod,
        cashTransaction,
        newTotalContributed,
        newOutstandingBalance
      };
    }
  });
};

/**
 * Helper: Generate AP registration number.
 * Uses BaseService advisory lock pattern via a temporary service instance.
 */
async function generateAPRegistrationNumber(transaction: any): Promise<string> {
  const AccountsPayable = require('../models/AccountsPayable').default;
  const [results] = await AccountsPayable.sequelize.query(
    `SELECT pg_advisory_xact_lock(hashtext(:lockKey)::bigint)`,
    { replacements: { lockKey: 'accounts_payables:AP' }, type: QueryTypes.SELECT, transaction }
  );
  const [maxResult] = await AccountsPayable.sequelize.query(
    `SELECT MAX(registration_number) AS max_reg_number FROM accounts_payables WHERE registration_number LIKE :pattern`,
    { replacements: { pattern: 'AP%' }, type: QueryTypes.SELECT, transaction }
  );
  const max = (maxResult as any)?.max_reg_number;
  const next = max ? parseInt(max.substring(2), 10) + 1 : 1;
  return `AP${String(next).padStart(4, '0')}`;
}

/**
 * Helper: Generate AR registration number.
 * Uses advisory lock to prevent duplicates under concurrent load.
 */
async function generateARRegistrationNumber(transaction: any): Promise<string> {
  const [results] = await AccountsReceivable.sequelize!.query(
    `SELECT pg_advisory_xact_lock(hashtext(:lockKey)::bigint)`,
    { replacements: { lockKey: 'accounts_receivables:AR' }, type: QueryTypes.SELECT, transaction }
  );
  const [maxResult] = await AccountsReceivable.sequelize!.query(
    `SELECT MAX(registration_number) AS max_reg_number FROM accounts_receivables WHERE registration_number LIKE :pattern`,
    { replacements: { pattern: 'AR%' }, type: QueryTypes.SELECT, transaction }
  );
  const max = (maxResult as any)?.max_reg_number;
  const next = max ? parseInt(max.substring(2), 10) + 1 : 1;
  return `AR${String(next).padStart(4, '0')}`;
}

/**
 * Helper: Generate cash registration number.
 * Uses advisory lock to prevent duplicates under concurrent load.
 */
async function generateCashRegistrationNumber(transaction: any): Promise<string> {
  const [results] = await CashRegister.sequelize!.query(
    `SELECT pg_advisory_xact_lock(hashtext(:lockKey)::bigint)`,
    { replacements: { lockKey: 'cash_registers:CJ' }, type: QueryTypes.SELECT, transaction }
  );
  const [maxResult] = await CashRegister.sequelize!.query(
    `SELECT MAX(registration_number) AS max_reg_number FROM cash_registers WHERE registration_number LIKE :pattern`,
    { replacements: { pattern: 'CJ%' }, type: QueryTypes.SELECT, transaction }
  );
  const max = (maxResult as any)?.max_reg_number;
  const next = max ? parseInt(max.substring(2), 10) + 1 : 1;
  return `CJ${String(next).padStart(4, '0')}`;
}

/**
 * Helper: Get last cash register balance
 */
async function getLastCashRegisterBalance(
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
