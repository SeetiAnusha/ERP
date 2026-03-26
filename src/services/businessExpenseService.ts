import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database';
import BusinessExpense from '../models/BusinessExpense';
import BusinessExpenseAssociatedCost from '../models/BusinessExpenseAssociatedCost';
import Supplier from '../models/Supplier';
import ExpenseCategory from '../models/ExpenseCategory';
import ExpenseType from '../models/ExpenseType';
import BankAccount from '../models/BankAccount';
import Card from '../models/Card';
import { TransactionType } from '../types/TransactionType';

/**
 * BusinessExpenseService - Handles all business expense operations
 * Separate from purchases to maintain clean data separation
 */

interface CreateBusinessExpenseData {
  date: Date;
  supplierId: number;
  supplierRnc?: string;
  expenseCategoryId: number;
  expenseTypeId: number;
  description?: string;
  amount: number;
  expenseType: string;
  paymentType: string;
  paidAmount: number;
  balanceAmount: number;
  status?: string;
  paymentStatus?: string; // Add this field
  
  // Payment method specific fields
  bankAccountId?: number;
  cardId?: number;
  chequeNumber?: string;
  chequeDate?: Date;
  transferNumber?: string;
  transferDate?: Date;
  paymentReference?: string;
  voucherDate?: Date;
  
  // Associated costs
  associatedCosts?: Array<{
    supplierRnc?: string;
    supplierName?: string;
    concept: string;
    ncf?: string;
    date: Date;
    amount: number;
    expenseType: string;
    paymentType: string;
    bankAccountId?: number;
    cardId?: number;
  }>;
}

interface GetBusinessExpensesFilters {
  categoryId?: number;
  typeId?: number;
  supplierId?: number;
  status?: string;
  paymentStatus?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

class BusinessExpenseService {
  /**
   * Generate unique registration number for business expense
   */
  private static async generateRegistrationNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    const prefix = `BE-${year}${month}${day}`;
    
    // Find the last expense for today
    const lastExpense = await BusinessExpense.findOne({
      where: {
        registrationNumber: {
          [Op.like]: `${prefix}%`
        }
      },
      order: [['registrationNumber', 'DESC']]
    });
    
    let sequence = 1;
    if (lastExpense) {
      const lastSequence = parseInt(lastExpense.registrationNumber.split('-').pop() || '0');
      sequence = lastSequence + 1;
    }
    
    return `${prefix}-${String(sequence).padStart(4, '0')}`;
  }

  /**
   * Calculate payment status based on amounts
   */
  private static calculatePaymentStatus(total: number, paid: number): string {
    if (paid === 0) return 'Unpaid';
    if (paid >= total) return 'Paid';
    return 'Partial';
  }

  /**
   * Create new business expense with associated costs and register entries
   */
  static async createBusinessExpense(data: CreateBusinessExpenseData): Promise<BusinessExpense> {
    const transaction: Transaction = await sequelize.transaction();
    
    try {
      // Step 1: Comprehensive validation
      await this.validateBusinessExpenseData(data);
      
      // Step 2: Generate registration number
      const registrationNumber = await this.generateRegistrationNumber();
      
      // Step 3: Calculate payment status and amounts based on payment type
      const paymentInfo = this.calculatePaymentInfo(data.paymentType, data.amount);
      
      // Step 4: Create main business expense record
      const businessExpense = await BusinessExpense.create({
        registrationNumber,
        date: data.date,
        supplierId: data.supplierId,
        supplierRnc: data.supplierRnc,
        expenseCategoryId: data.expenseCategoryId,
        expenseTypeId: data.expenseTypeId,
        description: data.description,
        amount: data.amount,
        expenseType: data.expenseType,
        paymentType: data.paymentType,
        paidAmount: paymentInfo.paidAmount,
        balanceAmount: paymentInfo.balanceAmount,
        status: data.status || 'COMPLETED',
        paymentStatus: paymentInfo.paymentStatus,
        
        // Payment method specific fields
        bankAccountId: data.bankAccountId,
        cardId: data.cardId,
        chequeNumber: data.chequeNumber,
        chequeDate: data.chequeDate,
        transferNumber: data.transferNumber,
        transferDate: data.transferDate,
        paymentReference: data.paymentReference,
        voucherDate: data.voucherDate,
      }, { transaction });

      // Step 5: Process payment based on type (dual recording)
      await this.processExpensePayment(data, businessExpense, transaction);

      // Step 6: Create associated costs if provided
      if (data.associatedCosts && data.associatedCosts.length > 0) {
        await this.processAssociatedCosts(data.associatedCosts, businessExpense.id, transaction);
      }

      await transaction.commit();
      
      // Return with associations
      return await this.getBusinessExpenseById(businessExpense.id);
      
    } catch (error) {
      await transaction.rollback();
      console.error('Error creating business expense:', error);
      throw error;
    }
  }

  /**
   * Create appropriate financial entry (Bank Register or Accounts Payable)
   * based on payment type
   */
  /**
   * Comprehensive validation for business expense data
   */
  private static async validateBusinessExpenseData(data: CreateBusinessExpenseData): Promise<void> {
    // Basic validations
    if (!data.supplierId) throw new Error('Supplier is required');
    if (!data.amount || data.amount <= 0) throw new Error('Amount must be greater than 0');
    if (!data.paymentType) throw new Error('Payment type is required');
    if (!data.expenseCategoryId) throw new Error('Expense category is required');
    if (!data.expenseTypeId) throw new Error('Expense type is required');
    
    // Payment method specific validations
    const paymentType = data.paymentType.toUpperCase();
    
    // Bank payment validations
    if (['BANK_TRANSFER', 'CHEQUE', 'DEPOSIT'].includes(paymentType)) {
      if (!data.bankAccountId) {
        throw new Error(`Bank account selection is mandatory for ${data.paymentType} payments`);
      }
      
      // Validate bank account exists and has sufficient balance
      const BankAccount = (await import('../models/BankAccount')).default;
      const bankAccount = await BankAccount.findByPk(data.bankAccountId);
      if (!bankAccount) {
        throw new Error('Selected bank account not found');
      }
      
      if (bankAccount.status !== 'ACTIVE') {
        throw new Error('Selected bank account is not active');
      }
      
      const currentBalance = Number(bankAccount.balance || 0);
      if (currentBalance < data.amount) {
        throw new Error(
          `Insufficient balance in ${bankAccount.bankName} (${bankAccount.accountNumber}). ` +
          `Available: ₹${currentBalance.toFixed(2)}, Required: ₹${data.amount.toFixed(2)}`
        );
      }
    }
    
    // Credit card validations
    if (paymentType === 'CREDIT_CARD') {
      if (!data.cardId) {
        throw new Error('Credit card selection is mandatory for credit card payments');
      }
      
      // Validate credit card exists and has sufficient limit
      const Card = (await import('../models/Card')).default;
      const card = await Card.findByPk(data.cardId);
      if (!card) {
        throw new Error('Selected credit card not found');
      }
      
      if (card.status !== 'ACTIVE') {
        throw new Error('Selected credit card is not active');
      }
      
      const creditLimit = Number(card.creditLimit || 0);
      const usedCredit = Number(card.usedCredit || 0);
      const availableCredit = creditLimit - usedCredit;
      
      if (availableCredit < data.amount) {
        throw new Error(
          `Insufficient credit limit on ${card.cardName || 'Credit Card'}. ` +
          `Available: ₹${availableCredit.toFixed(2)}, Required: ₹${data.amount.toFixed(2)}`
        );
      }
    }
    
    // Supplier validation
    const Supplier = (await import('../models/Supplier')).default;
    const supplier = await Supplier.findByPk(data.supplierId);
    if (!supplier) {
      throw new Error('Selected supplier not found');
    }
    
    if (supplier.status !== 'ACTIVE') {
      throw new Error('Selected supplier is not active');
    }
  }

  /**
   * Calculate payment information based on payment type
   */
  private static calculatePaymentInfo(paymentType: string, amount: number): {
    paidAmount: number;
    balanceAmount: number;
    paymentStatus: string;
  } {
    const paymentTypeUpper = paymentType.toUpperCase();
    
    // Immediate payment methods (paid immediately)
    const immediatePaymentTypes = ['BANK_TRANSFER', 'CHEQUE', 'DEBIT_CARD', 'CASH', 'DEPOSIT'];
    
    if (immediatePaymentTypes.includes(paymentTypeUpper)) {
      return {
        paidAmount: amount,
        balanceAmount: 0,
        paymentStatus: 'Paid'
      };
    }
    
    // Credit payment methods (creates payable)
    const creditPaymentTypes = ['CREDIT', 'CREDIT_CARD'];
    
    if (creditPaymentTypes.includes(paymentTypeUpper)) {
      return {
        paidAmount: 0,
        balanceAmount: amount,
        paymentStatus: 'Unpaid'
      };
    }
    
    // Default to unpaid
    return {
      paidAmount: 0,
      balanceAmount: amount,
      paymentStatus: 'Unpaid'
    };
  }

  /**
   * Process payment based on type with dual recording
   */
  private static async processExpensePayment(
    data: CreateBusinessExpenseData,
    businessExpense: BusinessExpense,
    transaction: Transaction
  ): Promise<void> {
    const paymentType = data.paymentType.toUpperCase();
    
    switch (paymentType) {
      case 'BANK_TRANSFER':
      case 'CHEQUE':
      case 'DEPOSIT':
        await this.processBankExpensePayment(data, businessExpense, transaction);
        break;
        
      case 'CREDIT_CARD':
        await this.processCreditCardExpensePayment(data, businessExpense, transaction);
        break;
        
      case 'CREDIT':
        await this.processCreditExpensePayment(data, businessExpense, transaction);
        break;
        
      case 'CASH':
        // Cash payments are recorded in expense management only
        console.log(`Cash payment for expense ${businessExpense.registrationNumber} - no additional recording needed`);
        break;
        
      default:
        console.log(`Payment type ${paymentType} processed as unpaid`);
    }
  }

  /**
   * Process bank payment (Bank Transfer, Cheque, Deposit)
   * Records in both Expense Management and Bank Register
   */
  private static async processBankExpensePayment(
    data: CreateBusinessExpenseData,
    businessExpense: BusinessExpense,
    transaction: Transaction
  ): Promise<void> {
    const BankAccount = (await import('../models/BankAccount')).default;
    const BankRegister = (await import('../models/BankRegister')).default;
    const Supplier = (await import('../models/Supplier')).default;
    
    // Get bank account and supplier info
    const bankAccount = await BankAccount.findByPk(data.bankAccountId!, { transaction });
    const supplier = await Supplier.findByPk(data.supplierId, { transaction });
    
    if (!bankAccount || !supplier) {
      throw new Error('Bank account or supplier not found');
    }
    
    // Update bank account balance (decrease for expense)
    const newBalance = Number(bankAccount.balance) - data.amount;
    await bankAccount.update({ balance: newBalance }, { transaction });
    
    // Generate bank register number
    const lastBankRegister = await BankRegister.findOne({
      order: [['id', 'DESC']],
      transaction
    });
    
    const nextNumber = lastBankRegister ? 
      parseInt(lastBankRegister.registrationNumber.substring(2)) + 1 : 1;
    const bankRegistrationNumber = `BR${String(nextNumber).padStart(4, '0')}`;
    
    // Create bank register entry (OUTFLOW for expense) with complete field population
    await BankRegister.create({
      registrationNumber: bankRegistrationNumber,
      registrationDate: businessExpense.date,
      transactionType: 'OUTFLOW',
      sourceTransactionType: 'BUSINESS_EXPENSE',
      amount: data.amount,
      paymentMethod: data.paymentType,
      relatedDocumentType: 'Business Expense',
      relatedDocumentNumber: businessExpense.registrationNumber,
      clientName: supplier.name || 'Unknown Supplier',
      clientRnc: data.supplierRnc || supplier.rnc || '',
      description: `Business Expense: ${businessExpense.description || businessExpense.expenseType} - ${supplier.name}`,
      balance: newBalance,
      bankAccountId: data.bankAccountId,
      bankAccountName: `${bankAccount.bankName} - ${bankAccount.accountNumber}`,
      chequeNumber: data.chequeNumber,
      transferNumber: data.transferNumber,
      supplierId: data.supplierId,
      originalPaymentType: data.paymentType
    }, { transaction });
    
    console.log(`✅ Bank payment processed: Expense ${businessExpense.registrationNumber} -> Bank Register ${bankRegistrationNumber}`);
  }

  /**
   * Process credit card payment
   * Records in both Expense Management and Accounts Payable
   */
  private static async processCreditCardExpensePayment(
    data: CreateBusinessExpenseData,
    businessExpense: BusinessExpense,
    transaction: Transaction
  ): Promise<void> {
    const Card = (await import('../models/Card')).default;
    const AccountsPayable = (await import('../models/AccountsPayable')).default;
    
    // Get card info for validation only
    const card = await Card.findByPk(data.cardId!, { transaction });
    if (!card) {
      throw new Error('Credit card not found');
    }
    
    // ✅ FIXED: DO NOT update used credit during expense creation
    // Credit will be reduced when AP is actually paid through Accounts Payable
    console.log(`💳 [Credit Card Expense] Creating AP for ${data.amount} - Credit will be reduced when AP is paid`);
    
    // Generate AP registration number
    const lastAP = await AccountsPayable.findOne({
      order: [['id', 'DESC']],
      transaction
    });
    
    const nextNumber = lastAP ? 
      parseInt(lastAP.registrationNumber.substring(2)) + 1 : 1;
    const apRegistrationNumber = `AP${String(nextNumber).padStart(4, '0')}`;
    
    // Create Accounts Payable entry (unpaid)
    await AccountsPayable.create({
      registrationNumber: apRegistrationNumber,
      registrationDate: businessExpense.date,
      type: 'CREDIT_CARD_EXPENSE',
      sourceTransactionType: TransactionType.BUSINESS_EXPENSE,
      relatedDocumentType: 'Business Expense',
      relatedDocumentId: businessExpense.id,
      relatedDocumentNumber: businessExpense.registrationNumber,
      supplierName: card.cardName || 'Credit Card Company',
      supplierRnc: '',
      purchaseDate: businessExpense.date,
      purchaseType: 'Business Expense',
      paymentType: 'CREDIT_CARD',
      amount: data.amount,
      paidAmount: 0,
      balanceAmount: data.amount,
      status: 'Unpaid',
      cardId: data.cardId,
      notes: `Credit card expense: ${businessExpense.description || businessExpense.expenseType} - ${card.cardName}`,
    }, { transaction });
    
    console.log(`✅ Credit card expense processed: Expense ${businessExpense.registrationNumber} -> AP ${apRegistrationNumber} (Credit will be reduced when paid)`);
  }

  /**
   * Process credit payment
   * Records in both Expense Management and Accounts Payable
   */
  private static async processCreditExpensePayment(
    data: CreateBusinessExpenseData,
    businessExpense: BusinessExpense,
    transaction: Transaction
  ): Promise<void> {
    const AccountsPayable = (await import('../models/AccountsPayable')).default;
    const Supplier = (await import('../models/Supplier')).default;
    
    // Get supplier info
    const supplier = await Supplier.findByPk(data.supplierId, { transaction });
    if (!supplier) {
      throw new Error('Supplier not found');
    }
    
    // Generate AP registration number
    const lastAP = await AccountsPayable.findOne({
      order: [['id', 'DESC']],
      transaction
    });
    
    const nextNumber = lastAP ? 
      parseInt(lastAP.registrationNumber.substring(2)) + 1 : 1;
    const apRegistrationNumber = `AP${String(nextNumber).padStart(4, '0')}`;
    
    // Create Accounts Payable entry
    await AccountsPayable.create({
      registrationNumber: apRegistrationNumber,
      registrationDate: businessExpense.date,
      type: 'SUPPLIER_CREDIT_EXPENSE',
      sourceTransactionType: TransactionType.BUSINESS_EXPENSE,
      relatedDocumentType: 'Business Expense',
      relatedDocumentId: businessExpense.id,
      relatedDocumentNumber: businessExpense.registrationNumber,
      supplierId: data.supplierId,
      supplierName: supplier.name,
      supplierRnc: data.supplierRnc || supplier.rnc || '',
      purchaseDate: businessExpense.date,
      purchaseType: 'Business Expense',
      paymentType: 'CREDIT',
      amount: data.amount,
      paidAmount: 0,
      balanceAmount: data.amount,
      status: 'Unpaid',
      notes: `Credit expense from ${supplier.name}: ${businessExpense.description || businessExpense.expenseType}`,
    }, { transaction });
    
    console.log(`✅ Credit payment processed: Expense ${businessExpense.registrationNumber} -> AP ${apRegistrationNumber}`);
  }

  /**
   * Process associated costs with proper payment routing
   */
  private static async processAssociatedCosts(
    associatedCosts: any[],
    businessExpenseId: number,
    transaction: Transaction
  ): Promise<void> {
    const associatedCostsData = associatedCosts.map(cost => ({
      businessExpenseId,
      supplierRnc: cost.supplierRnc,
      supplierName: cost.supplierName,
      concept: cost.concept,
      ncf: cost.ncf,
      date: cost.date,
      amount: cost.amount,
      expenseType: cost.expenseType,
      paymentType: cost.paymentType,
      bankAccountId: cost.bankAccountId,
      cardId: cost.cardId,
    }));

    await BusinessExpenseAssociatedCost.bulkCreate(associatedCostsData, { transaction });
    
    // Process payment for each associated cost
    for (const cost of associatedCosts) {
      if (['BANK_TRANSFER', 'CHEQUE', 'DEPOSIT'].includes(cost.paymentType.toUpperCase())) {
        // Process bank payment for associated cost
        await this.processAssociatedCostBankPayment(cost, transaction);
      } else if (cost.paymentType.toUpperCase() === 'CREDIT_CARD') {
        // Process credit card payment for associated cost
        await this.processAssociatedCostCreditCardPayment(cost, transaction);
      }
    }
  }

  /**
   * Process bank payment for associated cost
   */
  private static async processAssociatedCostBankPayment(cost: any, transaction: Transaction): Promise<void> {
    if (!cost.bankAccountId) return;
    
    const BankAccount = (await import('../models/BankAccount')).default;
    const BankRegister = (await import('../models/BankRegister')).default;
    
    const bankAccount = await BankAccount.findByPk(cost.bankAccountId, { transaction });
    if (!bankAccount) return;
    
    // Update bank balance
    const newBalance = Number(bankAccount.balance) - cost.amount;
    await bankAccount.update({ balance: newBalance }, { transaction });
    
    // Create bank register entry
    const lastBankRegister = await BankRegister.findOne({
      order: [['id', 'DESC']],
      transaction
    });
    
    const nextNumber = lastBankRegister ? 
      parseInt(lastBankRegister.registrationNumber.substring(2)) + 1 : 1;
    const bankRegistrationNumber = `BR${String(nextNumber).padStart(4, '0')}`;
    
    await BankRegister.create({
      registrationNumber: bankRegistrationNumber,
      registrationDate: cost.date,
      transactionType: 'OUTFLOW',
      sourceTransactionType: 'BUSINESS_EXPENSE',
      amount: cost.amount,
      paymentMethod: cost.paymentType,
      relatedDocumentType: 'Associated Cost',
      relatedDocumentNumber: cost.concept,
      clientName: cost.supplierName || 'Unknown Supplier',
      clientRnc: cost.supplierRnc || '',
      description: `Associated Cost: ${cost.concept}`,
      balance: newBalance,
      bankAccountId: cost.bankAccountId,
      bankAccountName: `${bankAccount.bankName} - ${bankAccount.accountNumber}`,
      originalPaymentType: cost.paymentType
    }, { transaction });
  }

  /**
   * Process credit card payment for associated cost
   */
  private static async processAssociatedCostCreditCardPayment(cost: any, transaction: Transaction): Promise<void> {
    if (!cost.cardId) return;
    
    const Card = (await import('../models/Card')).default;
    const card = await Card.findByPk(cost.cardId, { transaction });
    if (!card) return;
    
    // ✅ FIXED: DO NOT update used credit during expense creation
    // Credit will be reduced when the associated cost AP is actually paid
    console.log(`💳 [Associated Cost] Credit card expense for ${cost.amount} - Credit will be reduced when AP is paid`);
    
    // Note: Associated costs create their own AP entries through the main expense flow
    // The credit reduction will happen when those APs are paid through Accounts Payable
  }
  /**
   * Get business expense by ID with all associations
   */
  static async getBusinessExpenseById(id: number): Promise<BusinessExpense> {
    const expense = await BusinessExpense.findByPk(id, {
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['id', 'name', 'rnc', 'email', 'phone']
        },
        {
          model: ExpenseCategory,
          as: 'expenseCategory',
          attributes: ['id', 'name', 'code', 'description']
        },
        {
          model: ExpenseType,
          as: 'expenseTypeModel',
          attributes: ['id', 'name', 'code', 'description', 'requiresApproval', 'approvalThreshold']
        },
        {
          model: BankAccount,
          as: 'bankAccount',
          attributes: ['id', 'bankName', 'accountNumber', 'accountType', 'balance']
        },
        {
          model: Card,
          as: 'card',
          attributes: ['id', 'cardName', 'cardBrand', 'cardNumberLast4', 'cardType']
        },
        {
          model: BusinessExpenseAssociatedCost,
          as: 'associatedCosts',
          include: [
            {
              model: BankAccount,
              as: 'bankAccount',
              attributes: ['id', 'bankName', 'accountNumber']
            },
            {
              model: Card,
              as: 'card',
              attributes: ['id', 'cardName', 'cardBrand', 'cardNumberLast4']
            }
          ]
        }
      ]
    });

    if (!expense) {
      throw new Error(`Business expense with ID ${id} not found`);
    }

    return expense;
  }

  /**
   * Get all business expenses with filtering and pagination
   */
  static async getBusinessExpenses(filters: GetBusinessExpensesFilters = {}) {
    const {
      categoryId,
      typeId,
      supplierId,
      status,
      paymentStatus,
      dateFrom,
      dateTo,
      page = 1,
      limit = 50
    } = filters;

    const whereClause: any = {};

    // Apply filters
    if (categoryId) whereClause.expenseCategoryId = categoryId;
    if (typeId) whereClause.expenseTypeId = typeId;
    if (supplierId) whereClause.supplierId = supplierId;
    if (status) whereClause.status = status;
    if (paymentStatus) whereClause.paymentStatus = paymentStatus;

    // Date range filter
    if (dateFrom || dateTo) {
      whereClause.date = {};
      if (dateFrom) whereClause.date[Op.gte] = dateFrom;
      if (dateTo) whereClause.date[Op.lte] = dateTo;
    }

    const offset = (page - 1) * limit;

    const { rows: expenses, count: total } = await BusinessExpense.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['id', 'name', 'rnc']
        },
        {
          model: ExpenseCategory,
          as: 'expenseCategory',
          attributes: ['id', 'name', 'code']
        },
        {
          model: ExpenseType,
          as: 'expenseTypeModel',
          attributes: ['id', 'name', 'code']
        },
        {
          model: BankAccount,
          as: 'bankAccount',
          attributes: ['id', 'bankName', 'accountNumber']
        },
        {
          model: Card,
          as: 'card',
          attributes: ['id', 'cardName', 'cardBrand', 'cardNumberLast4']
        }
      ],
      order: [['date', 'DESC'], ['createdAt', 'DESC']],
      limit,
      offset
    });

    return {
      expenses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Update business expense
   */
  static async updateBusinessExpense(id: number, updateData: Partial<CreateBusinessExpenseData>): Promise<BusinessExpense> {
    const transaction: Transaction = await sequelize.transaction();
    
    try {
      const expense = await BusinessExpense.findByPk(id);
      if (!expense) {
        throw new Error(`Business expense with ID ${id} not found`);
      }

      // Update payment status if amounts changed
      if (updateData.amount !== undefined || updateData.paidAmount !== undefined) {
        const newAmount = updateData.amount ?? expense.amount;
        const newPaidAmount = updateData.paidAmount ?? expense.paidAmount;
        updateData.paymentStatus = this.calculatePaymentStatus(newAmount, newPaidAmount);
        updateData.balanceAmount = newAmount - newPaidAmount;
      }

      await expense.update(updateData, { transaction });
      await transaction.commit();

      return await this.getBusinessExpenseById(id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Pay a business expense (updates both expense and AP)
   */
  static async payBusinessExpense(expenseId: number, paymentData: {
    paymentMethod: string;
    bankAccountId?: number;
    cardId?: number;
    amount: number;
    registrationDate: Date;
    description: string;
    chequeNumber?: string;
    chequeDate?: Date;
    transferNumber?: string;
    transferDate?: Date;
    paymentReference?: string;
    voucherDate?: Date;
  }): Promise<any> {
    const transaction: any = await sequelize.transaction();
    
    try {
      // Step 1: Get the business expense
      const expense = await BusinessExpense.findByPk(expenseId, { transaction });
      if (!expense) {
        throw new Error(`Business expense with ID ${expenseId} not found`);
      }

      // Step 2: Validate payment
      if (expense.paymentStatus === 'Paid') {
        throw new Error('Business expense is already fully paid');
      }

      const currentBalance = parseFloat(expense.balanceAmount.toString());
      if (paymentData.amount > currentBalance) {
        throw new Error(`Payment amount ₹${paymentData.amount} exceeds remaining balance ₹${currentBalance}`);
      }

      // Step 3: Process payment based on method
      let paymentResult = null;
      const paymentMethod = paymentData.paymentMethod.toUpperCase();
      
      if (['BANK_TRANSFER', 'CHEQUE', 'DEPOSIT'].includes(paymentMethod)) {
        paymentResult = await this.processBankPaymentForExpense(expense, paymentData, transaction);
      } else if (paymentMethod === 'CREDIT_CARD') {
        paymentResult = await this.processCreditCardPaymentForExpense(expense, paymentData, transaction);
      } else if (paymentMethod === 'CASH') {
        paymentResult = await this.processCashPaymentForExpense(expense, paymentData, transaction);
      } else {
        throw new Error(`Unsupported payment method: ${paymentData.paymentMethod}`);
      }

      // Step 4: Update the business expense
      const newPaidAmount = parseFloat(expense.paidAmount.toString()) + paymentData.amount;
      const newBalanceAmount = parseFloat(expense.amount.toString()) - newPaidAmount;
      const newPaymentStatus = newBalanceAmount <= 0 ? 'Paid' : 'Partial';

      await expense.update({
        paidAmount: newPaidAmount,
        balanceAmount: Math.max(0, newBalanceAmount),
        paymentStatus: newPaymentStatus
      }, { transaction });

      // Step 5: Update related AP entry if it exists
      await this.updateRelatedAccountsPayable(expense, paymentData.amount, transaction);

      await transaction.commit();

      return {
        expense: await this.getBusinessExpenseById(expenseId),
        paymentResult,
        message: `Payment of ₹${paymentData.amount} processed successfully. New status: ${newPaymentStatus}`
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Process bank payment for expense
   */
  private static async processBankPaymentForExpense(expense: any, paymentData: any, transaction: any): Promise<any> {
    if (!paymentData.bankAccountId) {
      throw new Error('Bank account is required for bank payments');
    }

    const BankAccount = (await import('../models/BankAccount')).default;
    const BankRegister = (await import('../models/BankRegister')).default;

    // Validate bank account
    const bankAccount = await BankAccount.findByPk(paymentData.bankAccountId, { transaction });
    if (!bankAccount) {
      throw new Error('Bank account not found');
    }

    const currentBalance = Number(bankAccount.balance);
    if (currentBalance < paymentData.amount) {
      throw new Error(`Insufficient balance in ${bankAccount.bankName}. Available: ₹${currentBalance}, Required: ₹${paymentData.amount}`);
    }

    // Update bank balance
    const newBalance = currentBalance - paymentData.amount;
    await bankAccount.update({ balance: newBalance }, { transaction });

    // Create bank register entry
    const lastBankRegister = await BankRegister.findOne({
      order: [['id', 'DESC']],
      transaction
    });

    const nextNumber = lastBankRegister ? 
      parseInt(lastBankRegister.registrationNumber.substring(2)) + 1 : 1;
    const bankRegistrationNumber = `BR${String(nextNumber).padStart(4, '0')}`;

    const bankEntry = await BankRegister.create({
      registrationNumber: bankRegistrationNumber,
      registrationDate: paymentData.registrationDate,
      transactionType: 'OUTFLOW',
      sourceTransactionType: 'BUSINESS_EXPENSE',
      amount: paymentData.amount,
      paymentMethod: paymentData.paymentMethod,
      relatedDocumentType: 'Business Expense Payment',
      relatedDocumentNumber: expense.registrationNumber,
      clientName: expense.supplier?.name || 'Unknown Supplier',
      clientRnc: expense.supplierRnc || '',
      description: `Payment for business expense ${expense.registrationNumber} - ${paymentData.description}`,
      balance: newBalance,
      bankAccountId: paymentData.bankAccountId,
      bankAccountName: `${bankAccount.bankName} - ${bankAccount.accountNumber}`,
      chequeNumber: paymentData.chequeNumber,
      transferNumber: paymentData.transferNumber,
      supplierId: expense.supplierId,
      originalPaymentType: paymentData.paymentMethod
    }, { transaction });

    return { bankEntry, bankRegistrationNumber };
  }

  /**
   * Process credit card payment for expense
   */
  private static async processCreditCardPaymentForExpense(expense: any, paymentData: any, transaction: any): Promise<any> {
    if (!paymentData.cardId) {
      throw new Error('Credit card is required for credit card payments');
    }

    const Card = (await import('../models/Card')).default;
    const card = await Card.findByPk(paymentData.cardId, { transaction });
    if (!card) {
      throw new Error('Credit card not found');
    }

    const creditLimit = Number(card.creditLimit || 0);
    const usedCredit = Number(card.usedCredit || 0);
    const availableCredit = creditLimit - usedCredit;

    if (availableCredit < paymentData.amount) {
      throw new Error(`Insufficient credit limit. Available: ₹${availableCredit}, Required: ₹${paymentData.amount}`);
    }

    // Update used credit
    const newUsedCredit = usedCredit + paymentData.amount;
    await card.update({ usedCredit: newUsedCredit }, { transaction });

    return { cardPayment: true, newUsedCredit };
  }

  /**
   * Process cash payment for expense
   */
  private static async processCashPaymentForExpense(expense: any, paymentData: any, transaction: any): Promise<any> {
    // For cash payments, we just record the payment - no additional register entries needed
    return { cashPayment: true, amount: paymentData.amount };
  }

  /**
   * Update related Accounts Payable entry
   */
  private static async updateRelatedAccountsPayable(expense: any, paymentAmount: number, transaction: any): Promise<void> {
    try {
      const AccountsPayable = (await import('../models/AccountsPayable')).default;
      
      // Find related AP entry
      const apEntry = await AccountsPayable.findOne({
        where: {
          relatedDocumentType: 'Business Expense',
          relatedDocumentId: expense.id
        },
        transaction
      });

      if (apEntry) {
        const newPaidAmount = parseFloat(apEntry.paidAmount.toString()) + paymentAmount;
        const newBalanceAmount = parseFloat(apEntry.amount.toString()) - newPaidAmount;
        const newStatus = newBalanceAmount <= 0 ? 'Paid' : 'Partial';

        await apEntry.update({
          paidAmount: newPaidAmount,
          balanceAmount: Math.max(0, newBalanceAmount),
          status: newStatus
        }, { transaction });

        console.log(`✅ Updated related AP entry: ${apEntry.registrationNumber} - Status: ${newStatus}`);
      }
    } catch (error) {
      console.error('⚠️ Failed to update related AP entry:', error);
      // Don't throw - this is not critical for the expense payment
    }
  }

  /**
   * Delete business expense (soft delete by updating status)
   */
  static async deleteBusinessExpense(id: number): Promise<boolean> {
    const expense = await BusinessExpense.findByPk(id);
    if (!expense) {
      throw new Error(`Business expense with ID ${id} not found`);
    }

    await expense.update({ status: 'CANCELLED' });
    return true;
  }

  /**
   * Get expense dashboard data
   */
  static async getDashboardData(period: string = 'month') {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      default: // month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const expenses = await BusinessExpense.findAll({
      where: {
        date: {
          [Op.gte]: startDate,
          [Op.lte]: now
        }
      },
      include: [
        {
          model: ExpenseCategory,
          as: 'expenseCategory',
          attributes: ['id', 'name', 'description']
        }
      ]
    });

    const totalAmount = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount.toString()), 0);
    const paidAmount = expenses.reduce((sum, expense) => sum + parseFloat(expense.paidAmount.toString()), 0);
    const balanceAmount = totalAmount - paidAmount;
    const paymentPercentage = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

    // Group by category for topCategories
    const categoryGroups = expenses.reduce((acc: any, expense) => {
      const categoryId = expense.expenseCategoryId;
      
      if (!acc[categoryId]) {
        acc[categoryId] = {
          category: expense.expenseCategory || { id: 0, name: 'Uncategorized', description: '' },
          count: 0,
          amount: 0
        };
      }
      
      acc[categoryId].count += 1;
      acc[categoryId].amount += parseFloat(expense.amount.toString());
      return acc;
    }, {});

    const topCategories = Object.values(categoryGroups)
      .sort((a: any, b: any) => b.amount - a.amount)
      .slice(0, 10);

    // Group by status for breakdowns
    const statusGroups = expenses.reduce((acc: any, expense) => {
      const status = expense.paymentStatus;
      
      if (!acc[status]) {
        acc[status] = {
          status,
          count: 0,
          amount: 0
        };
      }
      
      acc[status].count += 1;
      acc[status].amount += parseFloat(expense.amount.toString());
      return acc;
    }, {});

    const byStatus = Object.values(statusGroups);

    // Group by payment type for breakdowns
    const typeGroups = expenses.reduce((acc: any, expense) => {
      const transactionType = expense.paymentType;
      
      if (!acc[transactionType]) {
        acc[transactionType] = {
          transactionType,
          count: 0,
          amount: 0
        };
      }
      
      acc[transactionType].count += 1;
      acc[transactionType].amount += parseFloat(expense.amount.toString());
      return acc;
    }, {});

    const byType = Object.values(typeGroups);

    return {
      period,
      dateRange: {
        start: startDate.toISOString(),
        end: now.toISOString()
      },
      summary: {
        totalPurchases: expenses.length,
        totalAmount,
        paidAmount,
        balanceAmount,
        paymentPercentage
      },
      breakdowns: {
        byStatus,
        byType
      },
      topCategories
    };
  }
}

export default BusinessExpenseService;