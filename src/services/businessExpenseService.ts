import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database';
import BusinessExpense from '../models/BusinessExpense';
import BusinessExpenseAssociatedCost from '../models/BusinessExpenseAssociatedCost';
import Supplier from '../models/Supplier';
import ExpenseCategory from '../models/ExpenseCategory';
import ExpenseType from '../models/ExpenseType';
import BankAccount from '../models/BankAccount';
import Card from '../models/Card';
import EnhancedBankRegisterService from './enhancedBankRegisterService';
import EnhancedAccountsPayableService from './enhancedAccountsPayableService';
import { transactionTypeTracker, BANK_PAYMENT_TYPES, ACCOUNTS_PAYABLE_PAYMENT_TYPES } from './transactionTypeTracker';

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
      // Generate registration number
      const registrationNumber = await this.generateRegistrationNumber();
      
      // Determine payment amounts based on payment type
      // Immediate payment methods: BANK_TRANSFER, CHEQUE, DEBIT_CARD, CASH
      // Credit payment methods: CREDIT, CREDIT_CARD
      const immediatePaymentTypes = ['BANK_TRANSFER', 'CHEQUE', 'DEBIT_CARD', 'CASH'];
      const isImmediatePayment = immediatePaymentTypes.includes(data.paymentType.toUpperCase());
      
      const actualPaidAmount = isImmediatePayment ? data.amount : 0;
      const actualBalanceAmount = isImmediatePayment ? 0 : data.amount;
      
      // Calculate payment status
      const paymentStatus = this.calculatePaymentStatus(data.amount, actualPaidAmount);
      
      // Create main business expense
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
        paidAmount: actualPaidAmount, // Use calculated amount
        balanceAmount: actualBalanceAmount, // Use calculated amount
        status: data.status || 'COMPLETED',
        paymentStatus,
        
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

      // Create associated costs if provided
      if (data.associatedCosts && data.associatedCosts.length > 0) {
        const associatedCostsData = data.associatedCosts.map(cost => ({
          businessExpenseId: businessExpense.id,
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
      }

      // Create Bank Register or Accounts Payable entry based on payment type
      await this.createFinancialEntry(businessExpense, transaction);

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
  private static async createFinancialEntry(
    businessExpense: BusinessExpense, 
    transaction: Transaction
  ): Promise<void> {
    try {
      // Get supplier information
      const supplier = await Supplier.findByPk(businessExpense.supplierId, { transaction });
      if (!supplier) {
        throw new Error(`Supplier with ID ${businessExpense.supplierId} not found`);
      }

      const paymentTypeUpper = businessExpense.paymentType.toUpperCase();

      // Determine destination based on payment type
      if (BANK_PAYMENT_TYPES.includes(paymentTypeUpper)) {
        // Create Bank Register entry
        await EnhancedBankRegisterService.createFromBusinessExpense({
          registrationNumber: businessExpense.registrationNumber,
          date: businessExpense.date,
          amount: businessExpense.amount,
          paymentMethod: businessExpense.paymentType,
          supplierId: businessExpense.supplierId,
          supplierName: supplier.name,
          supplierRnc: businessExpense.supplierRnc,
          description: businessExpense.description || `Business Expense - ${businessExpense.expenseType}`,
          bankAccountId: businessExpense.bankAccountId,
          chequeNumber: businessExpense.chequeNumber,
          transferNumber: businessExpense.transferNumber
        });
        
        console.log(`✓ Created Bank Register entry for business expense ${businessExpense.registrationNumber}`);
        
      } else if (ACCOUNTS_PAYABLE_PAYMENT_TYPES.includes(paymentTypeUpper)) {
        // Create Accounts Payable entry
        await EnhancedAccountsPayableService.createFromBusinessExpense({
          registrationNumber: businessExpense.registrationNumber,
          date: businessExpense.date,
          amount: businessExpense.amount,
          paymentType: businessExpense.paymentType,
          supplierId: businessExpense.supplierId,
          supplierName: supplier.name,
          supplierRnc: businessExpense.supplierRnc,
          cardId: businessExpense.cardId,
          description: businessExpense.description,
          notes: `Business Expense - ${businessExpense.expenseType}`
        });
        
        console.log(`✓ Created Accounts Payable entry for business expense ${businessExpense.registrationNumber}`);
        
      } else {
        console.warn(`⚠️ Unknown payment type ${businessExpense.paymentType} for business expense ${businessExpense.registrationNumber}`);
      }
      
    } catch (error) {
      console.error('Error creating financial entry for business expense:', error);
      throw error;
    }
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
          attributes: ['name']
        }
      ]
    });

    const totalAmount = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount.toString()), 0);
    const paidAmount = expenses.reduce((sum, expense) => sum + parseFloat(expense.paidAmount.toString()), 0);
    const pendingAmount = totalAmount - paidAmount;

    const byCategory = expenses.reduce((acc: any, expense) => {
      const categoryName = expense.expenseCategory?.name || 'Uncategorized';
      if (!acc[categoryName]) {
        acc[categoryName] = 0;
      }
      acc[categoryName] += parseFloat(expense.amount.toString());
      return acc;
    }, {});

    const byStatus = expenses.reduce((acc: any, expense) => {
      if (!acc[expense.paymentStatus]) {
        acc[expense.paymentStatus] = 0;
      }
      acc[expense.paymentStatus] += parseFloat(expense.amount.toString());
      return acc;
    }, {});

    return {
      summary: {
        totalExpenses: expenses.length,
        totalAmount,
        paidAmount,
        pendingAmount
      },
      byCategory,
      byStatus,
      period,
      dateRange: {
        from: startDate,
        to: now
      }
    };
  }
}

export default BusinessExpenseService;