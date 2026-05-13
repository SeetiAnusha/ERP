/**
 * Prepaid Expense Service
 * 
 * Business logic for prepaid expense management with automatic amortization
 * Time Complexity: O(1) for CRUD operations, O(n) for batch processing
 * Space Complexity: O(1) for single operations, O(n) for list operations
 * 
 * @author Senior Developer
 * @version 1.0.0
 */

import PrepaidExpense from '../models/PrepaidExpense';
import BankRegister from '../models/BankRegister';
import AccountsPayable from '../models/AccountsPayable';
import BankAccount from '../models/BankAccount';
import { Op } from 'sequelize';
import { BaseService } from '../core/BaseService';
import { NotFoundError } from '../core/AppError';
import { UniversalPaymentProcessor, PaymentData, TransactionContext } from './shared/UniversalPaymentProcessor';

interface PrepaidExpenseInput {
  code: string;
  name: string;
  type: string;
  description: string;
  startDate: Date;
  endDate: Date;
  totalAmount: number;
  supplierId?: number;
}

/**
 * Calculate monthly amortization amount
 * Formula: totalAmount / number of months
 * 
 * @param startDate - Start date of prepaid period
 * @param endDate - End date of prepaid period
 * @param totalAmount - Total prepaid amount
 * @returns Monthly amortization amount
 */
export const calculateMonthlyAmortization = (
  startDate: Date,
  endDate: Date,
  totalAmount: number
): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Calculate months difference
  const months = (end.getFullYear() - start.getFullYear()) * 12 + 
                 (end.getMonth() - start.getMonth()) + 1;
  
  if (months <= 0) {
    throw new Error('End date must be after start date');
  }
  
  return totalAmount / months;
};

/**
 * Calculate days remaining until end date
 * 
 * @param endDate - End date of prepaid period
 * @returns Number of days remaining
 */
export const calculateDaysRemaining = (endDate: Date): number => {
  const today = new Date();
  const end = new Date(endDate);
  const diffTime = end.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

/**
 * Calculate amortization percentage
 * 
 * @param amortizedAmount - Amount already amortized
 * @param totalAmount - Total prepaid amount
 * @returns Percentage amortized (0-100)
 */
export const calculateAmortizationPercentage = (
  amortizedAmount: number,
  totalAmount: number
): number => {
  if (totalAmount === 0) return 0;
  return (amortizedAmount / totalAmount) * 100;
};

/**
 * Determine status based on dates and amounts
 * 
 * @param endDate - End date of prepaid period
 * @param remainingAmount - Remaining amount to amortize
 * @returns Status string
 */
export const determineStatus = (
  endDate: Date,
  remainingAmount: number
): string => {
  const today = new Date();
  const end = new Date(endDate);
  
  if (remainingAmount <= 0) {
    return 'FULLY_AMORTIZED';
  }
  
  if (end < today) {
    return 'EXPIRED';
  }
  
  // Check if expiring within 30 days
  const daysRemaining = calculateDaysRemaining(endDate);
  if (daysRemaining <= 30 && daysRemaining > 0) {
    return 'EXPIRING_SOON';
  }
  
  return 'ACTIVE';
};

/**
 * Create a new prepaid expense with payment processing
 * Time Complexity: O(1)
 * Space Complexity: O(1)
 */
export const createPrepaidExpense = async (data: any) => {
  const { Sequelize } = await import('sequelize');
  const sequelize = (await import('../config/database')).default;

  // ✅ Duplicate prevention — check if code already exists (outside transaction for speed)
  if (data.code) {
    const existing = await PrepaidExpense.findOne({ where: { code: data.code } });
    if (existing) {
      throw new Error(`Prepaid expense with code '${data.code}' already exists. Please use a different code.`);
    }
  }
  
  return sequelize.transaction(async (transaction: any) => {
    // Calculate monthly amortization
    const monthlyAmortization = calculateMonthlyAmortization(
      data.startDate,
      data.endDate,
      data.totalAmount
    );
    
    // Initial values
    const amortizedAmount = 0;
    const remainingAmount = data.totalAmount;
    const status = determineStatus(data.endDate, remainingAmount);
    
    // Generate registration number
    const count = await PrepaidExpense.count({ transaction });
    const registrationNumber = `PE-${String(count + 1).padStart(6, '0')}`;
    
    // Create prepaid expense
    const prepaidExpense = await PrepaidExpense.create({
      ...data,
      registrationNumber,
      monthlyAmortization,
      amortizedAmount,
      remainingAmount,
      status,
    }, { transaction });
    
    console.log(`✅ Prepaid expense created: ${prepaidExpense.registrationNumber}`);
    
    // Process payment if payment type is provided (excluding CASH which doesn't need processing yet)
    if (data.paymentType && data.paymentType !== 'CASH') {
      console.log(`💳 Processing payment for prepaid expense ${prepaidExpense.registrationNumber} - Payment Type: ${data.paymentType}`);

      const paymentData: PaymentData = {
        paymentType: data.paymentType,
        bankAccountId: data.bankAccountId,
        cardId: data.cardId,
        chequeNumber: data.chequeNumber,
        chequeDate: data.chequeDate,
        transferNumber: data.transferNumber,
        transferDate: data.transferDate,
        paymentReference: data.paymentReference,
        voucherDate: data.voucherDate,
        supplierId: data.supplierId,
        supplierRnc: data.supplierRnc,
        ncf: data.ncf,
      };

      const context: TransactionContext = {
        id: prepaidExpense.id,
        registrationNumber: prepaidExpense.registrationNumber || prepaidExpense.code,
        date: new Date(data.startDate),
        amount: data.totalAmount,
        type: 'PREPAID_EXPENSE',
        description: `Prepaid Expense: ${data.name}`,
      };

      try {
        await UniversalPaymentProcessor.processPayment(
          paymentData,
          context,
          transaction,
          {
            createBankEntry: createBankRegisterEntry,
            createAPEntry: createAccountsPayableEntry,
            updateBankBalance: updateBankAccountBalance,
          }
        );
        console.log(`✅ Payment processed successfully for ${prepaidExpense.registrationNumber}`);
      } catch (paymentError: any) {
        console.error(`❌ Payment processing failed for ${prepaidExpense.registrationNumber}:`, paymentError.message);
        throw paymentError; // Re-throw to rollback transaction
      }
    }
    
    return prepaidExpense;
  });
};

// ==================== PAYMENT PROCESSING HELPER METHODS ====================

/**
 * Create bank register entry
 */
const createBankRegisterEntry = async (data: any, transaction: any): Promise<void> => {
  await BankRegister.create(data, { transaction });
  console.log(`✅ Bank register entry created: ${data.registrationNumber}`);
};

/**
 * Create accounts payable entry
 */
const createAccountsPayableEntry = async (data: any, transaction: any): Promise<void> => {
  await AccountsPayable.create(data, { transaction });
  console.log(`✅ Accounts payable entry created: ${data.registrationNumber}`);
};

/**
 * Update bank account balance
 */
const updateBankAccountBalance = async (
  bankAccountId: number,
  amount: number,
  isDebit: boolean,
  transaction: any
): Promise<void> => {
  const bankAccount = await BankAccount.findByPk(bankAccountId, { transaction });
  if (!bankAccount) {
    throw new NotFoundError(`Bank account with ID ${bankAccountId} not found`);
  }

  const currentBalance = Number(bankAccount.balance);
  const newBalance = isDebit ? currentBalance - amount : currentBalance + amount;

  await bankAccount.update({ balance: newBalance }, { transaction });
  console.log(`✅ Bank account balance updated: ${currentBalance} → ${newBalance}`);
};

/**
 * PrepaidExpenseService class for pagination support
 */
class PrepaidExpenseService extends BaseService {
  /**
   * Get all prepaid expenses with optional filtering and pagination support
   * Time Complexity: O(n) where n is number of records
   * Space Complexity: O(n)
   */
  async getAllPrepaidExpensesWithPagination(options?: any) {
    try {
      // Use generic pagination from BaseService
      const result = await this.getAllWithPagination(
        PrepaidExpense,
        {
          ...options,
          searchFields: ['name', 'registrationNumber', 'code', 'type'],
          dateField: 'createdAt'
        }
      );

      // Enrich data with calculated fields
      if (result.data) {
        result.data = result.data.map((expense: any) => {
          const daysRemaining = calculateDaysRemaining(expense.endDate);
          const amortizationPercentage = calculateAmortizationPercentage(
            parseFloat(expense.amortizedAmount.toString()),
            parseFloat(expense.totalAmount.toString())
          );
          
          return {
            ...expense,
            daysRemaining,
            amortizationPercentage,
          };
        });
      }

      return result;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to retrieve prepaid expenses');
    }
  }
}

// Create singleton instance
const prepaidExpenseService = new PrepaidExpenseService();

/**
 * Get all prepaid expenses with optional filtering and pagination support
 * Time Complexity: O(n) where n is number of records
 * Space Complexity: O(n)
 */
export const getAllPrepaidExpenses = async (options?: any) => {
  return prepaidExpenseService.getAllPrepaidExpensesWithPagination(options);
};

/**
 * Export pagination-specific function for clarity
 */
export const getAllPrepaidExpensesWithPagination = getAllPrepaidExpenses;

/**
 * Get prepaid expense by ID
 * Time Complexity: O(1)
 * Space Complexity: O(1)
 */
export const getPrepaidExpenseById = async (id: number) => {
  const expense = await PrepaidExpense.findByPk(id);
  
  if (!expense) {
    throw new Error('Prepaid expense not found');
  }
  
  const daysRemaining = calculateDaysRemaining(expense.endDate);
  const amortizationPercentage = calculateAmortizationPercentage(
    parseFloat(expense.amortizedAmount.toString()),
    parseFloat(expense.totalAmount.toString())
  );
  
  return {
    ...expense.toJSON(),
    daysRemaining,
    amortizationPercentage,
  };
};

/**
 * Update prepaid expense
 * Time Complexity: O(1)
 * Space Complexity: O(1)
 */
export const updatePrepaidExpense = async (
  id: number,
  data: Partial<PrepaidExpenseInput>
) => {
  const expense = await PrepaidExpense.findByPk(id);
  
  if (!expense) {
    throw new Error('Prepaid expense not found');
  }
  
  // Recalculate if dates or amount changed
  if (data.startDate || data.endDate || data.totalAmount) {
    const startDate = data.startDate || expense.startDate;
    const endDate = data.endDate || expense.endDate;
    const totalAmount = data.totalAmount || parseFloat(expense.totalAmount.toString());
    
    const monthlyAmortization = calculateMonthlyAmortization(
      startDate,
      endDate,
      totalAmount
    );
    
    const remainingAmount = totalAmount - parseFloat(expense.amortizedAmount.toString());
    const status = determineStatus(endDate, remainingAmount);
    
    await expense.update({
      ...data,
      monthlyAmortization,
      remainingAmount,
      status,
    });
  } else {
    await expense.update(data);
  }
  
  return expense;
};

/**
 * Delete prepaid expense
 * Time Complexity: O(1)
 * Space Complexity: O(1)
 */
export const deletePrepaidExpense = async (id: number) => {
  const expense = await PrepaidExpense.findByPk(id);
  
  if (!expense) {
    throw new Error('Prepaid expense not found');
  }
  
  await expense.destroy();
  return { message: 'Prepaid expense deleted successfully' };
};

/**
 * Process monthly amortization for a specific prepaid expense
 * This should be called by a scheduled job
 * Time Complexity: O(1)
 * Space Complexity: O(1)
 */
export const processAmortization = async (id: number) => {
  const expense = await PrepaidExpense.findByPk(id);
  
  if (!expense) {
    throw new Error('Prepaid expense not found');
  }
  
  // Check if already fully amortized
  if (expense.status === 'FULLY_AMORTIZED') {
    return { message: 'Already fully amortized', expense };
  }
  
  const monthlyAmount = parseFloat(expense.monthlyAmortization.toString());
  const currentAmortized = parseFloat(expense.amortizedAmount.toString());
  const totalAmount = parseFloat(expense.totalAmount.toString());
  
  // Calculate new amortized amount
  const newAmortized = Math.min(currentAmortized + monthlyAmount, totalAmount);
  const newRemaining = totalAmount - newAmortized;
  
  // Update status
  const newStatus = determineStatus(expense.endDate, newRemaining);
  
  await expense.update({
    amortizedAmount: newAmortized,
    remainingAmount: newRemaining,
    status: newStatus,
  });
  
  return {
    message: 'Amortization processed successfully',
    amortizedThisMonth: monthlyAmount,
    expense,
  };
};

/**
 * Process amortization for all active prepaid expenses
 * Should be run monthly via cron job
 * Time Complexity: O(n) where n is number of active expenses
 * Space Complexity: O(n)
 */
export const processAllAmortizations = async () => {
  const activeExpenses = await PrepaidExpense.findAll({
    where: {
      status: {
        [Op.in]: ['ACTIVE', 'EXPIRING_SOON'],
      },
    },
  });
  
  const results = [];
  
  for (const expense of activeExpenses) {
    try {
      const result = await processAmortization(expense.id);
      results.push(result);
    } catch (error: any) {
      results.push({
        id: expense.id,
        error: error.message,
      });
    }
  }
  
  return {
    message: `Processed ${results.length} prepaid expenses`,
    results,
  };
};

/**
 * Get prepaid expenses expiring soon (within 30 days)
 * Time Complexity: O(n)
 * Space Complexity: O(n)
 */
export const getExpiringSoon = async () => {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  
  const expenses = await PrepaidExpense.findAll({
    where: {
      endDate: {
        [Op.lte]: thirtyDaysFromNow,
        [Op.gte]: new Date(),
      },
      status: {
        [Op.in]: ['ACTIVE', 'EXPIRING_SOON'],
      },
    },
    order: [['endDate', 'ASC']],
  });
  
  return expenses.map(expense => ({
    ...expense.toJSON(),
    daysRemaining: calculateDaysRemaining(expense.endDate),
  }));
};

/**
 * Get summary statistics
 * Time Complexity: O(n)
 * Space Complexity: O(1)
 */
export const getSummaryStatistics = async () => {
  const allExpenses = await PrepaidExpense.findAll();
  
  const totalPrepaid = allExpenses.reduce(
    (sum, exp) => sum + parseFloat(exp.totalAmount.toString()),
    0
  );
  
  const totalAmortized = allExpenses.reduce(
    (sum, exp) => sum + parseFloat(exp.amortizedAmount.toString()),
    0
  );
  
  const totalRemaining = allExpenses.reduce(
    (sum, exp) => sum + parseFloat(exp.remainingAmount.toString()),
    0
  );
  
  const activeCount = allExpenses.filter(exp => exp.status === 'ACTIVE').length;
  const expiringCount = allExpenses.filter(exp => exp.status === 'EXPIRING_SOON').length;
  
  return {
    totalPrepaid,
    totalAmortized,
    totalRemaining,
    activeCount,
    expiringCount,
    totalCount: allExpenses.length,
  };
};
