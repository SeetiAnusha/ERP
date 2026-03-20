import { Router } from 'express';
import * as businessExpenseController from '../controllers/businessExpenseController';

/**
 * Business Expense Routes
 * Separate from purchases to maintain clean separation
 */

const router = Router();

/**
 * @route   POST /api/business-expenses
 * @desc    Create new business expense
 * @body    { supplierId, expenseCategoryId, expenseTypeId, amount, paymentType, ... }
 * @access  Private
 */
router.post('/', businessExpenseController.createBusinessExpense);

/**
 * @route   GET /api/business-expenses
 * @desc    Get all business expenses with filtering
 * @query   categoryId, typeId, supplierId, status, paymentStatus, dateFrom, dateTo, page, limit
 * @access  Public
 */
router.get('/', businessExpenseController.getBusinessExpenses);

/**
 * @route   GET /api/business-expenses/unpaid
 * @desc    Get unpaid business expenses (like invoices for payment)
 * @query   supplierId?, dateFrom?, dateTo?
 * @access  Public
 */
router.get('/unpaid', businessExpenseController.getUnpaidBusinessExpenses);

/**
 * @route   POST /api/business-expenses/:id/pay
 * @desc    Pay a business expense (updates both expense and AP)
 * @body    { paymentMethod, bankAccountId?, cardId?, amount, registrationDate, description }
 * @access  Private
 */
router.post('/:id/pay', businessExpenseController.payBusinessExpense);

/**
 * @route   GET /api/business-expenses/dashboard
 * @desc    Get business expense dashboard data
 * @query   period (month, quarter, year)
 * @access  Public
 */
router.get('/dashboard', businessExpenseController.getBusinessExpenseDashboard);

/**
 * @route   GET /api/business-expenses/:id
 * @desc    Get business expense by ID
 * @access  Public
 */
router.get('/:id', businessExpenseController.getBusinessExpenseById);

/**
 * @route   PUT /api/business-expenses/:id
 * @desc    Update business expense
 * @body    { amount?, paymentType?, status?, ... }
 * @access  Private
 */
router.put('/:id', businessExpenseController.updateBusinessExpense);

/**
 * @route   DELETE /api/business-expenses/:id
 * @desc    Delete business expense (soft delete)
 * @access  Private
 */
router.delete('/:id', businessExpenseController.deleteBusinessExpense);

export default router;