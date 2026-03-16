import { Request, Response } from 'express';
import { ValidationError, UniqueConstraintError, ForeignKeyConstraintError } from 'sequelize';
import BusinessExpenseService from '../services/businessExpenseService';

/**
 * BusinessExpenseController - Handles business expense operations
 * Separate from purchases to maintain clean separation of concerns
 */

/**
 * Create new business expense
 * POST /api/business-expenses
 */
export const createBusinessExpense = async (req: Request, res: Response) => {
  try {
    const {
      date,
      supplierId,
      supplierRnc,
      expenseCategoryId,
      expenseTypeId,
      description,
      amount,
      expenseType,
      paymentType,
      paidAmount,
      balanceAmount,
      
      // Payment method specific fields
      bankAccountId,
      cardId,
      chequeNumber,
      chequeDate,
      transferNumber,
      transferDate,
      paymentReference,
      voucherDate,
      
      // Associated costs
      associatedCosts
    } = req.body;

    // Input validation
    if (!supplierId || !expenseCategoryId || !expenseTypeId || !amount || !paymentType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Supplier, expense category, expense type, amount, and payment type are required',
        timestamp: new Date().toISOString()
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount',
        message: 'Amount must be greater than 0',
        timestamp: new Date().toISOString()
      });
    }

    console.log('[BusinessExpenseController] Creating business expense:', {
      supplierId,
      expenseCategoryId,
      expenseTypeId,
      amount,
      paymentType
    });

    const expenseData = {
      date: new Date(date),
      supplierId: parseInt(supplierId),
      supplierRnc,
      expenseCategoryId: parseInt(expenseCategoryId),
      expenseTypeId: parseInt(expenseTypeId),
      description,
      amount: parseFloat(amount),
      expenseType: expenseType || 'Services or other',
      paymentType,
      paidAmount: parseFloat(paidAmount || 0),
      balanceAmount: parseFloat(balanceAmount || amount),
      
      // Payment method specific fields
      bankAccountId: bankAccountId ? parseInt(bankAccountId) : undefined,
      cardId: cardId ? parseInt(cardId) : undefined,
      chequeNumber,
      chequeDate: chequeDate ? new Date(chequeDate) : undefined,
      transferNumber,
      transferDate: transferDate ? new Date(transferDate) : undefined,
      paymentReference,
      voucherDate: voucherDate ? new Date(voucherDate) : undefined,
      
      // Associated costs
      associatedCosts: associatedCosts?.map((cost: any) => ({
        supplierRnc: cost.supplierRnc,
        supplierName: cost.supplierName,
        concept: cost.concept,
        ncf: cost.ncf,
        date: new Date(cost.date),
        amount: parseFloat(cost.amount),
        expenseType: cost.expenseType,
        paymentType: cost.paymentType,
        bankAccountId: cost.bankAccountId ? parseInt(cost.bankAccountId) : undefined,
        cardId: cost.cardId ? parseInt(cost.cardId) : undefined,
      })) || []
    };

    const businessExpense = await BusinessExpenseService.createBusinessExpense(expenseData);

    res.status(201).json({
      success: true,
      data: businessExpense,
      message: 'Business expense created successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[BusinessExpenseController] Error creating business expense:', error);
    
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: error.errors.map(e => e.message).join(', '),
        details: error.errors,
        timestamp: new Date().toISOString()
      });
    }
    
    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({
        success: false,
        error: 'Duplicate entry',
        message: 'Registration number already exists',
        timestamp: new Date().toISOString()
      });
    }
    
    if (error instanceof ForeignKeyConstraintError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid reference',
        message: 'Referenced supplier, category, or type does not exist',
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create business expense',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
/**
 * Get all business expenses with filtering
 * GET /api/business-expenses
 */
export const getBusinessExpenses = async (req: Request, res: Response) => {
  try {
    const {
      categoryId,
      typeId,
      supplierId,
      status,
      paymentStatus,
      dateFrom,
      dateTo,
      page = '1',
      limit = '50'
    } = req.query;

    const filters = {
      categoryId: categoryId ? parseInt(categoryId as string) : undefined,
      typeId: typeId ? parseInt(typeId as string) : undefined,
      supplierId: supplierId ? parseInt(supplierId as string) : undefined,
      status: status as string,
      paymentStatus: paymentStatus as string,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
      page: Math.max(1, parseInt(page as string) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit as string) || 50))
    };

    console.log('[BusinessExpenseController] Getting business expenses with filters:', filters);

    const result = await BusinessExpenseService.getBusinessExpenses(filters);

    res.json({
      success: true,
      data: result.expenses,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[BusinessExpenseController] Error getting business expenses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve business expenses',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get business expense by ID
 * GET /api/business-expenses/:id
 */
export const getBusinessExpenseById = async (req: Request, res: Response) => {
  try {
    const expenseId = parseInt(req.params.id);

    if (isNaN(expenseId) || expenseId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid expense ID',
        message: 'Expense ID must be a positive integer',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`[BusinessExpenseController] Getting business expense ${expenseId}`);

    const expense = await BusinessExpenseService.getBusinessExpenseById(expenseId);

    res.json({
      success: true,
      data: expense,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[BusinessExpenseController] Error getting business expense by ID:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Expense not found',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve business expense',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Update business expense
 * PUT /api/business-expenses/:id
 */
export const updateBusinessExpense = async (req: Request, res: Response) => {
  try {
    const expenseId = parseInt(req.params.id);
    const updateData = req.body;

    if (isNaN(expenseId) || expenseId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid expense ID',
        message: 'Expense ID must be a positive integer',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`[BusinessExpenseController] Updating business expense ${expenseId}:`, updateData);

    const expense = await BusinessExpenseService.updateBusinessExpense(expenseId, updateData);

    res.json({
      success: true,
      data: expense,
      message: 'Business expense updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[BusinessExpenseController] Error updating business expense:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Expense not found',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update business expense',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Delete business expense
 * DELETE /api/business-expenses/:id
 */
export const deleteBusinessExpense = async (req: Request, res: Response) => {
  try {
    const expenseId = parseInt(req.params.id);

    if (isNaN(expenseId) || expenseId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid expense ID',
        message: 'Expense ID must be a positive integer',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`[BusinessExpenseController] Deleting business expense ${expenseId}`);

    await BusinessExpenseService.deleteBusinessExpense(expenseId);

    res.json({
      success: true,
      message: 'Business expense deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[BusinessExpenseController] Error deleting business expense:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Expense not found',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to delete business expense',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get business expense dashboard data
 * GET /api/business-expenses/dashboard
 */
export const getBusinessExpenseDashboard = async (req: Request, res: Response) => {
  try {
    const { period = 'month' } = req.query;

    console.log(`[BusinessExpenseController] Getting dashboard data for period: ${period}`);

    const dashboardData = await BusinessExpenseService.getDashboardData(period as string);

    res.json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[BusinessExpenseController] Error getting dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard data',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};