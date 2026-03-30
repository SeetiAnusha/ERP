﻿/**
 * Enterprise-Grade Accounts Payable Service
 * 
 * Unified service combining basic operations with enhanced features:
 * - Transaction type tracking for audit trails
 * - Analytics and reporting capabilities
 * - Class-based architecture with validation framework
 * - Error handling and retry mechanisms
 * - Source system identification
 * - Payment processing with balance validation
 * - Credit card and bank account management
 */

import { Op } from 'sequelize';
import sequelize from '../config/database';
import AccountsPayable from '../models/AccountsPayable';
import { TransactionType } from '../types/TransactionType';
import { BaseService } from '../core/BaseService';
import { TransactionFactory } from './shared/TransactionFactory';
import { APContext, APBankPaymentOptions, APCardPaymentOptions, APPaymentRequest } from '../types/APTransactionTypes';
import { 
  ValidationError, 
  InsufficientBalanceError, 
  BusinessLogicError, 
  NotFoundError 
} from '../core/AppError';

/**
 * Interfaces for type safety and documentation
 */
interface CreateAccountsPayableRequest {
  type: string;
  sourceTransactionType?: TransactionType;
  relatedDocumentType: string;
  relatedDocumentId?: number;
  relatedDocumentNumber: string;
  supplierId?: number;
  supplierName: string;
  supplierRnc?: string;
  cardId?: number;
  cardIssuer?: string;
  ncf?: string;
  purchaseDate?: Date;
  purchaseType?: string;
  paymentType: string;
  amount: number;
  dueDate?: Date;
  notes?: string;
}

interface PaymentRequest {
  amount: number;
  paidDate?: Date;
  notes?: string;
  cardId?: number;
  paymentMethod?: string;
  bankAccountId?: number;
  reference?: string;
  description?: string;
}
interface AccountsPayableAnalytics {
  totalTransactions: number;
  totalAmount: number;
  totalPaidAmount: number;
  totalBalanceAmount: number;
  byTransactionType: Record<TransactionType, {
    count: number;
    amount: number;
    paidAmount: number;
    balanceAmount: number;
    percentage: number;
  }>;
  byStatus: Record<string, {
    count: number;
    amount: number;
  }>;
  dateRange: {
    from: Date;
    to: Date;
  };
}

/**
 * Unified Accounts Payable Service Class
 * 
 * Features:
 * - Enterprise-grade class-based architecture
 * - Comprehensive validation and error handling
 * - Transaction management with rollback protection
 * - Payment processing with balance validation
 * - Analytics and reporting capabilities
 * - Source system tracking
 */
class AccountsPayableService extends BaseService {
  
  // ==================== PUBLIC API METHODS ====================
  
  /**
   * Get all accounts payable with optional filtering
   * Time Complexity: O(n) where n = number of records
   * Space Complexity: O(n) for result set with pagination
   */
  async getAllAccountsPayable(options: {
    transactionType?: TransactionType;
    status?: string;
    page?: number;
    limit?: number;
    dateFrom?: Date;
    dateTo?: Date;
  } = {}): Promise<{
    entries: AccountsPayable[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.executeWithRetry(async () => {
      const { page = 1, limit = 100, transactionType, status, dateFrom, dateTo } = options;
      const offset = (page - 1) * limit;
      
      // Validate pagination parameters
      this.validateNumeric(page, 'Page number', { min: 1 });
      this.validateNumeric(limit, 'Limit', { min: 1, max: 100 });
      
      const whereClause: any = {};
      
      // Add filters with validation
      if (transactionType) {
        this.validateEnum(transactionType, 'Transaction type', Object.values(TransactionType));
        whereClause.sourceTransactionType = transactionType;
      }
      
      if (status) {
        this.validateEnum(status, 'Status', ['Pending', 'Partial', 'Paid']);
        whereClause.status = status;
      }
      
      if (dateFrom || dateTo) {
        whereClause.registrationDate = {};
        if (dateFrom) whereClause.registrationDate[Op.gte] = dateFrom;
        if (dateTo) whereClause.registrationDate[Op.lte] = dateTo;
      }
      
      const { rows: entries, count: total } = await AccountsPayable.findAndCountAll({
        where: whereClause,
        order: [['registrationDate', 'DESC'], ['createdAt', 'DESC']],
        limit,
        offset
      });
      
      return {
        entries,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    });
  }
  /**
   * Get accounts payable by ID with validation
   * Time Complexity: O(1) for primary key lookup
   * Space Complexity: O(1) for single record
   */
  async getAccountsPayableById(id: number): Promise<AccountsPayable> {
    return this.executeWithRetry(async () => {
      this.validateNumeric(id, 'Accounts Payable ID', { min: 1 });
      
      const ap = await AccountsPayable.findByPk(id);
      if (!ap) {
        throw new NotFoundError(`Accounts Payable with ID ${id} not found`);
      }
      
      return ap;
    });
  }

  /**
   * Get pending accounts payable with proper filtering
   * Time Complexity: O(n) where n = pending records
   * Space Complexity: O(n) for result set
   */
  async getPendingAccountsPayable(): Promise<AccountsPayable[]> {
    return this.executeWithRetry(async () => {
      return await AccountsPayable.findAll({
        where: {
          status: {
            [Op.in]: ['Pending', 'Partial']
          },
          // 🔥 CRITICAL: Exclude deleted transactions from payment selection
          deletion_status: {
            [Op.notIn]: ['EXECUTED'] // Don't show executed deletions
          }
        },
        order: [['dueDate', 'ASC']],
      });
    });
  }

  /**
   * Get accounts payable available for payment (excludes deleted transactions)
   * This method is specifically for payment selection dropdowns
   * Time Complexity: O(n log n) for sorting
   * Space Complexity: O(n) for result set
   */
  async getPayableAccountsPayable(): Promise<AccountsPayable[]> {
    return this.executeWithRetry(async () => {
      return await AccountsPayable.findAll({
        where: {
          status: {
            [Op.in]: ['Pending', 'Partial']
          },
          // 🔥 CRITICAL: Exclude all deleted transactions from payment selection
          deletion_status: {
            [Op.in]: ['NONE', 'REQUESTED', 'APPROVED'] // Only show non-executed deletions
          }
        },
        order: [['dueDate', 'ASC']],
      });
    });
  }

  /**
   * Create accounts payable entry with validation and transaction type tracking
   * Time Complexity: O(1) for single record creation
   * Space Complexity: O(1) for processing data
   */
  async createAccountsPayable(data: CreateAccountsPayableRequest): Promise<AccountsPayable> {
    return this.executeWithTransaction(async (transaction) => {
      
      // Step 1: Comprehensive validation
      this.validateAccountsPayableData(data);
      
      // Step 2: Generate registration number
      const registrationNumber = await this.generateAPRegistrationNumber(transaction);
      
      // Step 3: Determine source transaction type if not provided
      const sourceTransactionType = data.sourceTransactionType || TransactionType.PAYMENT;
      
      // Step 4: Create the entry with proper data structure
      const accountsPayable = await AccountsPayable.create({
        registrationNumber,
        registrationDate: new Date(),
        type: data.type,
        sourceTransactionType,
        relatedDocumentType: data.relatedDocumentType,
        relatedDocumentId: data.relatedDocumentId || 0,
        relatedDocumentNumber: data.relatedDocumentNumber,
        supplierId: data.supplierId || 0,
        supplierName: data.supplierName,
        supplierRnc: data.supplierRnc || '',
        cardId: data.cardId || undefined,
        cardIssuer: data.cardIssuer || '',
        ncf: data.ncf || '',
        purchaseDate: data.purchaseDate,
        purchaseType: data.purchaseType,
        paymentType: data.paymentType,
        amount: data.amount,
        paidAmount: 0,
        balanceAmount: data.amount,
        status: 'Pending',
        dueDate: data.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        notes: data.notes || '',
      }, { transaction });
      
      return accountsPayable;
    });
  }
  /**
   * Create accounts payable from purchase transaction
   * Time Complexity: O(1) for single record creation
   * Space Complexity: O(1) for processing data
   */
  async createFromPurchase(purchaseData: {
    registrationNumber: string;
    date: Date;
    amount: number;
    paymentType: string;
    supplierId: number;
    supplierName: string;
    supplierRnc?: string;
    cardId?: number;
    cardIssuer?: string;
    ncf?: string;
    purchaseType?: string;
    dueDate?: Date;
    notes?: string;
  }): Promise<AccountsPayable> {
    
    // 🔄 UPDATED LOGIC: Credit card purchases don't reduce credit limit until payment
    console.log(`📝 [AP Creation] Creating AP for ${purchaseData.paymentType} purchase - NO money movement yet`);
    
    const accountsPayableData: CreateAccountsPayableRequest = {
      type: purchaseData.paymentType === 'CREDIT_CARD' ? 'CREDIT_CARD_PURCHASE' : 'CREDIT_PURCHASE',
      sourceTransactionType: TransactionType.PURCHASE,
      relatedDocumentType: 'Purchase',
      relatedDocumentNumber: purchaseData.registrationNumber,
      supplierId: purchaseData.supplierId,
      supplierName: purchaseData.supplierName,
      supplierRnc: purchaseData.supplierRnc,
      cardId: purchaseData.cardId,
      cardIssuer: purchaseData.cardIssuer,
      ncf: purchaseData.ncf,
      purchaseDate: purchaseData.date,
      purchaseType: purchaseData.purchaseType,
      paymentType: purchaseData.paymentType,
      amount: purchaseData.amount,
      dueDate: purchaseData.dueDate,
      notes: purchaseData.notes
    };
    
    // ✅ NO CREDIT CARD LIMIT REDUCTION HERE - happens only when "Pay" is clicked
    console.log(`✅ [AP Created] ${purchaseData.registrationNumber}: Amount=${purchaseData.amount}, Status=Pending (no money moved)`);
    
    return this.createAccountsPayable(accountsPayableData);
  }

  /**
   * Create accounts payable from business expense transaction
   * Time Complexity: O(1) for single record creation
   * Space Complexity: O(1) for processing data
   */
  async createFromBusinessExpense(expenseData: {
    registrationNumber: string;
    date: Date;
    amount: number;
    paymentType: string;
    supplierId: number;
    supplierName: string;
    supplierRnc?: string;
    cardId?: number;
    cardIssuer?: string;
    description?: string;
    dueDate?: Date;
    notes?: string;
  }): Promise<AccountsPayable> {
    
    const accountsPayableData: CreateAccountsPayableRequest = {
      type: 'CREDIT_EXPENSE',
      sourceTransactionType: TransactionType.BUSINESS_EXPENSE,
      relatedDocumentType: 'BusinessExpense',
      relatedDocumentNumber: expenseData.registrationNumber,
      supplierId: expenseData.supplierId,
      supplierName: expenseData.supplierName,
      supplierRnc: expenseData.supplierRnc,
      cardId: expenseData.cardId,
      cardIssuer: expenseData.cardIssuer,
      purchaseDate: expenseData.date,
      paymentType: expenseData.paymentType,
      amount: expenseData.amount,
      dueDate: expenseData.dueDate,
      notes: expenseData.notes || expenseData.description
    };
    
    return this.createAccountsPayable(accountsPayableData);
  }
  /**
   * Record payment with comprehensive validation and balance management
   * Time Complexity: O(1) for payment processing
   * Space Complexity: O(1) for payment data
   */
  async recordPayment(id: number, paymentData: PaymentRequest): Promise<AccountsPayable> {
    return this.executeWithTransaction(async (transaction) => {
      // Step 1: Validate and get AP record
      this.validateNumeric(id, 'Accounts Payable ID', { min: 1 });
      this.validateNumeric(paymentData.amount, 'Payment amount', { min: 0.01 });
      
      const ap = await AccountsPayable.findByPk(id, { transaction });
      if (!ap) {
        throw new NotFoundError(`Accounts Payable with ID ${id} not found`);
      }
      
      // Step 2: Validate payment amount
      const currentBalance = Number(ap.balanceAmount);
      if (paymentData.amount > currentBalance) {
        throw new ValidationError(
          `Payment amount ${paymentData.amount.toFixed(2)} exceeds remaining balance ${currentBalance.toFixed(2)}`
        );
      }
      
      // Step 3: Process payment based on method
      const bankPaymentMethods = ['BANK_TRANSFER', 'CHECK', 'BANK', 'DEPOSIT', 'BANK_DEPOSIT', 'CHEQUE'];
      
      console.log('🔍 Payment method routing:', {
        paymentMethod: paymentData.paymentMethod,
        paymentMethodUpper: paymentData.paymentMethod?.toUpperCase(),
        bankAccountId: paymentData.bankAccountId,
        cardId: paymentData.cardId,
        isBankPaymentMethod: bankPaymentMethods.includes(paymentData.paymentMethod?.toUpperCase() || ''),
        hasBankAccountId: !!paymentData.bankAccountId,
        hasCardId: !!paymentData.cardId
      });
      
      if (paymentData.bankAccountId && bankPaymentMethods.includes(paymentData.paymentMethod?.toUpperCase() || '')) {
        console.log('🎯 Processing as BANK ACCOUNT payment');
        await this.processBankAccountPayment(ap, paymentData, transaction);
      } else if (paymentData.cardId) {
        console.log('🎯 Processing as CARD payment');
        await this.processCardPayment(ap, paymentData, transaction);
      } else if (paymentData.bankAccountId) {
        console.log('🎯 Processing as FALLBACK BANK payment');
        // Fallback: if bankAccountId is provided but no specific method, treat as bank payment
        await this.processBankAccountPayment(ap, paymentData, transaction);
      } else {
        console.log('❌ No payment processing path matched');
        throw new ValidationError('Invalid payment method or missing required payment data');
      }
      
      // Step 4: Update AP record
      const newPaidAmount = Number(ap.paidAmount) + paymentData.amount;
      const newBalanceAmount = Number(ap.amount) - newPaidAmount;
      
      let status = 'Partial';
      if (this.isEqual(newBalanceAmount, 0)) {
        status = 'Paid';
      } else if (this.isEqual(newPaidAmount, 0)) {
        status = 'Pending';
      }
      
      await ap.update({
        paidAmount: this.roundCurrency(newPaidAmount),
        balanceAmount: this.roundCurrency(Math.max(0, newBalanceAmount)),
        status: status,
        paidDate: status === 'Paid' ? (paymentData.paidDate || new Date()) : ap.paidDate,
        notes: paymentData.description || paymentData.notes || ap.notes,
      }, { transaction });
      
      // Step 5: Update related Business Expense if this AP is from a business expense
      await this.updateRelatedBusinessExpense(ap, paymentData.amount, status, transaction);
      
      return ap;
    });
  }

  /**
   * Update accounts payable with validation
   * Time Complexity: O(1) for single record update
   * Space Complexity: O(1) for update data
   */
  async updateAccountsPayable(id: number, data: Partial<CreateAccountsPayableRequest>): Promise<AccountsPayable> {
    return this.executeWithTransaction(async (transaction) => {
      this.validateNumeric(id, 'Accounts Payable ID', { min: 1 });
      
      const ap = await AccountsPayable.findByPk(id, { transaction });
      if (!ap) {
        throw new NotFoundError(`Accounts Payable with ID ${id} not found`);
      }
      
      // Validate update data
      if (data.amount !== undefined) {
        this.validateNumeric(data.amount, 'Amount', { min: 0.01 });
      }
      
      return await ap.update(data, { transaction });
    });
  }

  /**
   * Delete accounts payable with business rule validation
   * Time Complexity: O(1) for deletion
   * Space Complexity: O(1) for operation
   */
  async deleteAccountsPayable(id: number): Promise<{ message: string }> {
    return this.executeWithTransaction(async (transaction) => {
      this.validateNumeric(id, 'Accounts Payable ID', { min: 1 });
      
      const ap = await AccountsPayable.findByPk(id, { transaction });
      if (!ap) {
        throw new NotFoundError(`Accounts Payable with ID ${id} not found`);
      }
      
      // Business rule validation
      if (ap.status === 'Paid' || ap.status === 'Partial') {
        throw new BusinessLogicError('Cannot delete accounts payable with payments. Please reverse all payments first.');
      }
      
      await ap.destroy({ transaction });
      
      return { message: 'Accounts Payable deleted successfully' };
    });
  }
  // ==================== ANALYTICS METHODS ====================
  
  /**
   * Get transaction type analytics
   * Time Complexity: O(n) where n = number of records in date range
   * Space Complexity: O(k) where k = number of transaction types
   */
  async getTransactionTypeAnalytics(options: {
    dateFrom?: Date;
    dateTo?: Date;
  } = {}): Promise<AccountsPayableAnalytics> {
    return this.executeWithRetry(async () => {
      const { dateFrom, dateTo } = options;
      
      const whereClause: any = {};
      
      // Add date range filter
      if (dateFrom || dateTo) {
        whereClause.registrationDate = {};
        if (dateFrom) whereClause.registrationDate[Op.gte] = dateFrom;
        if (dateTo) whereClause.registrationDate[Op.lte] = dateTo;
      }
      
      // Get all entries for the period
      const entries = await AccountsPayable.findAll({
        where: whereClause,
        attributes: ['sourceTransactionType', 'status', 'amount', 'paidAmount', 'balanceAmount']
      });
      
      // Calculate totals
      const totalTransactions = entries.length;
      const totalAmount = entries.reduce((sum, entry) => 
        sum + parseFloat(entry.amount.toString()), 0
      );
      const totalPaidAmount = entries.reduce((sum, entry) => 
        sum + parseFloat(entry.paidAmount.toString()), 0
      );
      const totalBalanceAmount = entries.reduce((sum, entry) => 
        sum + parseFloat(entry.balanceAmount.toString()), 0
      );
      
      // Group by source transaction type
      const byTransactionType: Record<string, any> = {};
      
      Object.values(TransactionType).forEach(type => {
        const typeEntries = entries.filter(entry => entry.sourceTransactionType === type);
        const typeAmount = typeEntries.reduce((sum, entry) => 
          sum + parseFloat(entry.amount.toString()), 0
        );
        const typePaidAmount = typeEntries.reduce((sum, entry) => 
          sum + parseFloat(entry.paidAmount.toString()), 0
        );
        const typeBalanceAmount = typeEntries.reduce((sum, entry) => 
          sum + parseFloat(entry.balanceAmount.toString()), 0
        );
        
        byTransactionType[type] = {
          count: typeEntries.length,
          amount: typeAmount,
          paidAmount: typePaidAmount,
          balanceAmount: typeBalanceAmount,
          percentage: totalAmount > 0 ? (typeAmount / totalAmount) * 100 : 0
        };
      });
      
      // Group by status
      const byStatus: Record<string, { count: number; amount: number }> = {};
      const statuses = [...new Set(entries.map(entry => entry.status))];
      
      statuses.forEach(status => {
        const statusEntries = entries.filter(entry => entry.status === status);
        const statusAmount = statusEntries.reduce((sum, entry) => 
          sum + parseFloat(entry.amount.toString()), 0
        );
        
        byStatus[status] = {
          count: statusEntries.length,
          amount: statusAmount
        };
      });
      
      return {
        totalTransactions,
        totalAmount,
        totalPaidAmount,
        totalBalanceAmount,
        byTransactionType: byTransactionType as Record<TransactionType, any>,
        byStatus,
        dateRange: {
          from: dateFrom || new Date(0),
          to: dateTo || new Date()
        }
      };
    });
  }
  // ==================== VALIDATION METHODS ====================
  
  /**
   * Validate accounts payable data with comprehensive checks
   */
  private validateAccountsPayableData(data: CreateAccountsPayableRequest): void {
    // Required field validation
    this.validateRequired(data, ['supplierName', 'amount', 'paymentType', 'relatedDocumentType', 'relatedDocumentNumber'], 'Accounts Payable');
    
    // Numeric validations
    this.validateNumeric(data.amount, 'Amount', { min: 0.01 });
    
    if (data.supplierId) {
      this.validateNumeric(data.supplierId, 'Supplier ID', { min: 1 });
    }
    
    // String validations
    if (data.supplierRnc && data.supplierRnc.trim().length > 0) {
      const rnc = data.supplierRnc.replace(/\D/g, '');
      if (rnc.length !== 9 && rnc.length !== 11) {
        throw new ValidationError('RNC must be 9 or 11 digits');
      }
    }
    
    if (data.ncf && data.ncf.trim().length > 0) {
      const ncf = data.ncf.replace(/\D/g, '');
      if (ncf.length !== 8) {
        throw new ValidationError('NCF must be 8 digits');
      }
    }
    
    // Enum validations
    const validPaymentTypes = ['CASH', 'CREDIT', 'DEBIT_CARD', 'CREDIT_CARD', 'CHEQUE', 'BANK_TRANSFER'];
    this.validateEnum(data.paymentType, 'Payment type', validPaymentTypes);
    
    const validTypes = ['CREDIT_PURCHASE', 'CREDIT_EXPENSE', 'CREDIT_CARD_PURCHASE', 'SUPPLIER_CREDIT'];
    this.validateEnum(data.type, 'Type', validTypes);
    
    // Date validations
    if (data.purchaseDate && data.purchaseDate > new Date()) {
      throw new ValidationError('Purchase date cannot be in the future');
    }
    
    if (data.dueDate && data.dueDate < new Date()) {
      throw new ValidationError('Due date cannot be in the past');
    }
  }

  /**
   * Generate AP registration number with proper sequencing
   */
  private async generateAPRegistrationNumber(transaction?: any): Promise<string> {
    const lastAP = await AccountsPayable.findOne({
      where: {
        registrationNumber: {
          [Op.like]: 'AP%'
        }
      },
      order: [['id', 'DESC']],
      transaction
    });
    
    let nextNumber = 1;
    if (lastAP) {
      const lastNumber = parseInt(lastAP.registrationNumber.substring(2));
      nextNumber = lastNumber + 1;
    }
    
    return `AP${String(nextNumber).padStart(4, '0')}`;
  }
  // ==================== PAYMENT PROCESSING METHODS ====================
  
  /**
   * Update related Business Expense when AP payment is made
   */
  private async updateRelatedBusinessExpense(
    ap: any, 
    paymentAmount: number, 
    apStatus: string, 
    transaction: any
  ): Promise<void> {
    try {
      // Check if this AP is related to a business expense
      if (ap.relatedDocumentType === 'Business Expense' && ap.relatedDocumentId) {
        console.log(`🔄 Updating related business expense ${ap.relatedDocumentId} for AP payment`);
        
        // Import BusinessExpense model
        const BusinessExpense = (await import('../models/BusinessExpense')).default;
        
        // Get the business expense
        const businessExpense = await BusinessExpense.findByPk(ap.relatedDocumentId, { transaction });
        
        if (businessExpense) {
          // Calculate new payment amounts for the business expense
          const currentPaidAmount = Number(businessExpense.paidAmount || 0);
          const newPaidAmount = currentPaidAmount + paymentAmount;
          const totalAmount = Number(businessExpense.amount);
          const newBalanceAmount = totalAmount - newPaidAmount;
          
          // Determine new payment status
          let newPaymentStatus = 'Partial';
          if (newBalanceAmount <= 0) {
            newPaymentStatus = 'Paid';
          } else if (newPaidAmount <= 0) {
            newPaymentStatus = 'Unpaid';
          }
          
          // Update the business expense
          await businessExpense.update({
            paidAmount: this.roundCurrency(newPaidAmount),
            balanceAmount: this.roundCurrency(Math.max(0, newBalanceAmount)),
            paymentStatus: newPaymentStatus
          }, { transaction });
          
          console.log(`✅ Updated business expense ${businessExpense.registrationNumber}:`);
          console.log(`   - Paid Amount: ₹${currentPaidAmount} → ₹${newPaidAmount}`);
          console.log(`   - Balance: ₹${totalAmount - currentPaidAmount} → ₹${newBalanceAmount}`);
          console.log(`   - Status: ${businessExpense.paymentStatus} → ${newPaymentStatus}`);
        } else {
          console.log(`⚠️ Business expense ${ap.relatedDocumentId} not found`);
        }
      }
    } catch (error) {
      console.error('❌ Error updating related business expense:', error);
      // Don't throw - this shouldn't block the AP payment
      // The AP payment is the primary operation
    }
  }

  // ==================== PAYMENT PROCESSING METHODS ====================
  
  /**
   * Process bank account payment with balance validation
   */
  private async processBankAccountPayment(ap: AccountsPayable, paymentData: PaymentRequest, transaction: any): Promise<void> {
    console.log('🏦 processBankAccountPayment called with:', {
      apId: ap.id,
      apRegistrationNumber: ap.registrationNumber,
      paymentAmount: paymentData.amount,
      paymentMethod: paymentData.paymentMethod,
      bankAccountId: paymentData.bankAccountId
    });

    const BankAccount = (await import('../models/BankAccount')).default;
    
    const bankAccount = await BankAccount.findByPk(paymentData.bankAccountId, { transaction });
    if (!bankAccount) {
      throw new NotFoundError('Selected bank account not found');
    }
    
    const paymentAmount = paymentData.amount;
    const currentBalance = Number(bankAccount.balance);
    
    console.log('💰 Bank account validation:', {
      bankAccountId: paymentData.bankAccountId,
      bankName: bankAccount.bankName,
      accountNumber: bankAccount.accountNumber,
      currentBalance,
      paymentAmount,
      sufficientBalance: currentBalance >= paymentAmount
    });
    
    // Validate sufficient balance
    this.validateSufficientBalance(
      currentBalance,
      paymentAmount,
      `AP payment ${ap.registrationNumber}`,
      `${bankAccount.bankName} - ${bankAccount.accountNumber}`
    );

    // ✅ REMOVED: Credit card debt restoration logic - no longer needed with new approach
    // Credit card payments now directly reduce credit limit when paying (not when creating AP)
    
    console.log('🏦 Creating Bank Register entry using TransactionFactory...');
    
    // ✅ REFACTORED: Use TransactionFactory instead of manual data construction
    try {
      const bankRegisterService = (await import('./bankRegisterService')).default;
      
      // Create AP context for TransactionFactory
      const context: APContext = {
        ap: {
          id: ap.id,
          registrationNumber: ap.registrationNumber,
          supplierName: ap.supplierName || '',
          supplierRnc: ap.supplierRnc,
          ncf: ap.ncf,
          type: ap.type,
          cardId: ap.cardId,
          cardIssuer: ap.cardIssuer
        },
        amount: paymentAmount
      };

      const options: APBankPaymentOptions = {
        paymentMethod: TransactionFactory.getPaymentMethodForBankRegister(paymentData.paymentMethod),
        bankAccountId: paymentData.bankAccountId!,  // Non-null assertion since we validated it exists above
        paidDate: paymentData.paidDate,
        reference: paymentData.reference
      };

      // Use TransactionFactory to create bank register data
      const bankRegisterData = TransactionFactory.createAPBankEntry(context, options);
      
      console.log('📋 Bank Register data from TransactionFactory:', JSON.stringify(bankRegisterData, null, 2));
      
      const bankRegisterEntry = await bankRegisterService.createBankRegister(bankRegisterData, transaction);
      
      console.log('✅ Bank Register entry created successfully:', {
        registrationNumber: bankRegisterEntry.registrationNumber,
        id: bankRegisterEntry.id,
        amount: bankRegisterEntry.amount,
        transactionType: bankRegisterEntry.transactionType
      });
      
    } catch (bankRegisterError: any) {
      console.error('❌ Failed to create Bank Register entry:', bankRegisterError);
      console.error('Stack trace:', bankRegisterError.stack);
      throw bankRegisterError; // Re-throw to ensure transaction rollback
    }
  }

  /**
   * Process card payment with proper validation
   */
  private async processCardPayment(ap: AccountsPayable, paymentData: PaymentRequest, transaction: any): Promise<void> {
    const Card = (await import('../models/Card')).default;
    const BankAccount = (await import('../models/BankAccount')).default;
    
    const card = await Card.findByPk(paymentData.cardId, { transaction });
    if (!card) {
      throw new NotFoundError('Card not found');
    }
    
    const paymentAmount = paymentData.amount;
    const cardInfo = `${card.cardBrand || 'Card'} ****${card.cardNumberLast4}`;
    
    if (card.cardType === 'DEBIT') {
      await this.processDebitCardPayment(card, ap, paymentAmount, cardInfo, paymentData, transaction);
    } else if (card.cardType === 'CREDIT') {
      await this.processCreditCardPayment(card, ap, paymentAmount, cardInfo, paymentData, transaction);
    } else {
      throw new ValidationError(`Unsupported card type: ${card.cardType}`);
    }
  }

  /**
   * Process debit card payment
   */
  private async processDebitCardPayment(card: any, ap: AccountsPayable, amount: number, cardInfo: string, paymentData: PaymentRequest, transaction: any): Promise<void> {
    if (!card.bankAccountId) {
      throw new ValidationError(`DEBIT card ${cardInfo} is not linked to a bank account`);
    }
    
    const BankAccount = (await import('../models/BankAccount')).default;
    const bankAccount = await BankAccount.findByPk(card.bankAccountId, { transaction });
    if (!bankAccount) {
      throw new ValidationError(`Bank account not found for DEBIT card ${cardInfo}`);
    }
    
    // Validate balance
    const currentBalance = Number(bankAccount.balance);
    this.validateSufficientBalance(
      currentBalance,
      amount,
      `AP payment ${ap.registrationNumber}`,
      `bank account linked to DEBIT card ${cardInfo}`
    );
    
    // Deduct from bank account
    const newBankBalance = currentBalance - amount;
    await bankAccount.update({ balance: newBankBalance }, { transaction });
    
    // ✅ REFACTORED: Use TransactionFactory instead of removed createBankRegisterEntry method
    const bankRegisterService = (await import('./bankRegisterService')).default;
    
    // Create AP context for TransactionFactory
    const context: APContext = {
      ap: {
        id: ap.id,
        registrationNumber: ap.registrationNumber,
        supplierName: ap.supplierName || '',
        supplierRnc: ap.supplierRnc,
        ncf: ap.ncf,
        type: ap.type,
        cardId: ap.cardId,
        cardIssuer: ap.cardIssuer
      },
      amount: amount
    };

    const options: APCardPaymentOptions = {
      cardId: card.id,
      paidDate: paymentData.paidDate,
      reference: paymentData.reference,
      description: `AP Payment ${ap.registrationNumber} via DEBIT card ${cardInfo} - Bank: ${bankAccount.bankName}`
    };

    // Use TransactionFactory to create debit card bank register data
    const bankRegisterData = TransactionFactory.createAPDebitCardEntry(context, card, cardInfo, options);
    
    // Add bank account info to the data
    const enhancedBankRegisterData = {
      ...bankRegisterData,
      description: `AP Payment ${ap.registrationNumber} via DEBIT card ${cardInfo} - Bank: ${bankAccount.bankName}`
    };
    
    await bankRegisterService.createBankRegister(enhancedBankRegisterData, transaction);
  }
  /**
   * Process credit card payment
   */
  private async processCreditCardPayment(card: any, ap: AccountsPayable, amount: number, cardInfo: string, paymentData: PaymentRequest, transaction: any): Promise<void> {
    // 🔄 UPDATED LOGIC: Use Credit Card Register instead of Bank Register
    console.log(`💳 [Credit Card Payment] Processing payment for AP ${ap.registrationNumber} using card ${cardInfo}`);
    
    // Validate credit limit
    const creditLimit = Number(card.creditLimit || 0);
    const usedCredit = Number(card.usedCredit || 0);
    const availableCredit = creditLimit - usedCredit;
    
    if (creditLimit <= 0) {
      throw new ValidationError(`Credit card ${cardInfo} has no credit limit set`);
    }
    
    this.validateSufficientBalance(
      availableCredit,
      amount,
      `AP payment ${ap.registrationNumber}`,
      `credit available on card ${cardInfo}`
    );
    
    // ✅ Create Credit Card Register entry (this will also update the card's used credit)
    const creditCardRegisterService = (await import('./creditCardRegisterService')).default;
    
    const ccPaymentData = {
      cardId: card.id,
      amount: amount,
      relatedDocumentType: 'Accounts Payable Payment',
      relatedDocumentNumber: ap.registrationNumber,
      supplierName: ap.supplierName || '',
      supplierRnc: ap.supplierRnc && ap.supplierRnc.trim() && ap.supplierRnc.trim().length > 0 ? ap.supplierRnc.trim() : undefined,
      description: `Credit card payment to ${ap.supplierName} for ${ap.registrationNumber}`,
      authorizationCode: paymentData.reference,
      referenceNumber: paymentData.reference,
      notes: `Credit card payment via ${cardInfo}`
    };
    
    const ccRegisterEntry = await creditCardRegisterService.processCreditCardPayment(ccPaymentData);
    
    console.log(`💳 [CC Register] Created entry ${ccRegisterEntry.registrationNumber} - Credit limit reduced and payment recorded`);
  }

  /**
   * Restore credit limit when paying credit card debt
   */
  // ✅ REMOVED: restoreCreditLimit method - no longer needed with new approach
  // Credit card payments now work simply:
  // 1. Purchase creates AP (no credit limit change)
  // 2. Pay button reduces credit limit + creates bank entry
  
  // ✅ REMOVED: createCreditCardDebtEntry method - no longer needed with new approach
  // No more complex debt creation - direct payment to supplier

  /**
   * Create bank register entry
   */
  // ✅ REMOVED: createBankRegisterEntry method - now using shared bankRegisterService.createBankRegister()
  // This eliminates 45 lines of duplicated code that exists in Purchase Service

  /**
   * Get last bank balance
   */
  private async getLastBankBalance(bankAccountId?: number, transaction?: any): Promise<number> {
    const BankRegister = (await import('../models/BankRegister')).default;
    
    const whereClause = bankAccountId ? { bankAccountId } : {};
    
    const lastTransaction = await BankRegister.findOne({
      where: whereClause,
      order: [['id', 'DESC']],
      transaction
    });
    
    return lastTransaction ? Number(lastTransaction.balance) : 0;
  }

  // ✅ REMOVED: getPaymentMethodForBankRegister method - now using TransactionFactory.getPaymentMethodForBankRegister()
  // This eliminates 15 lines of duplicated code
}
// Create singleton instance
const accountsPayableService = new AccountsPayableService();

// Export methods to maintain compatibility with existing code
export const getAllAccountsPayable = (options?: any) => accountsPayableService.getAllAccountsPayable(options);
export const getAccountsPayableById = (id: number) => accountsPayableService.getAccountsPayableById(id);
export const getPendingAccountsPayable = () => accountsPayableService.getPendingAccountsPayable();
export const getPayableAccountsPayable = () => accountsPayableService.getPayableAccountsPayable();
export const createAccountsPayable = (data: CreateAccountsPayableRequest) => accountsPayableService.createAccountsPayable(data);
export const createFromPurchase = (data: any) => accountsPayableService.createFromPurchase(data);
export const createFromBusinessExpense = (data: any) => accountsPayableService.createFromBusinessExpense(data);
export const recordPayment = (id: number, paymentData: PaymentRequest) => accountsPayableService.recordPayment(id, paymentData);
export const updateAccountsPayable = (id: number, data: any) => accountsPayableService.updateAccountsPayable(id, data);
export const deleteAccountsPayable = (id: number) => accountsPayableService.deleteAccountsPayable(id);
export const getTransactionTypeAnalytics = (options?: any) => accountsPayableService.getTransactionTypeAnalytics(options);

// Export the service class for direct usage if needed
export { AccountsPayableService };
export default accountsPayableService;