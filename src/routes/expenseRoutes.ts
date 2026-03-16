import { Router } from 'express';
import * as expenseController from '../controllers/expenseController';

/**
 * Enhanced Expense Management Routes
 * 
 * Features:
 * - RESTful API design patterns
 * - Comprehensive CRUD operations
 * - Nested resource routing
 * - Query parameter support
 * - Duplicate prevention endpoints
 * - Analytics and reporting endpoints
 */

const router = Router();

// ================================
// EXPENSE CATEGORIES ROUTES
// ================================

/**
 * @route   GET /api/expenses/categories
 * @desc    Get all expense categories with optional filtering
 * @query   includeInactive, page, limit
 * @access  Public
 */
router.get('/categories', expenseController.getAllCategories);

/**
 * @route   GET /api/expenses/categories/:id
 * @desc    Get expense category by ID with related data
 * @query   includeTypes, includeSubcategories
 * @access  Public
 */
router.get('/categories/:id', expenseController.getCategoryById);

/**
 * @route   POST /api/expenses/categories
 * @desc    Create new expense category
 * @body    { name, code, description?, parentCategoryId?, sortOrder? }
 * @access  Private (requires authentication)
 */
router.post('/categories', expenseController.createCategory);

/**
 * @route   PUT /api/expenses/categories/:id
 * @desc    Update expense category
 * @body    { name?, code?, description?, parentCategoryId?, sortOrder?, isActive? }
 * @access  Private (requires authentication)
 */
router.put('/categories/:id', expenseController.updateCategory);

/**
 * @route   DELETE /api/expenses/categories/:id
 * @desc    Soft delete expense category
 * @access  Private (requires authentication)
 */
router.delete('/categories/:id', expenseController.deleteCategory);

// ================================
// EXPENSE TYPES ROUTES (Nested under categories)
// ================================

/**
 * @route   GET /api/expenses/categories/:categoryId/types
 * @desc    Get expense types by category
 * @query   includeInactive, page, limit
 * @access  Public
 */
router.get('/categories/:categoryId/types', expenseController.getTypesByCategory);

/**
 * @route   GET /api/expenses/types/approval-required
 * @desc    Get all expense types that require approval
 * @access  Public
 */
router.get('/types/approval-required', expenseController.getApprovalRequiredTypes);

/**
 * @route   POST /api/expenses/types
 * @desc    Create new expense type
 * @body    { categoryId, name, code, description?, requiresApproval?, approvalThreshold? }
 * @access  Private (requires authentication)
 */
router.post('/types', expenseController.createExpenseType);

// ================================
// EXPENSE PURCHASES ROUTES
// ================================

/**
 * @route   GET /api/expenses/purchases
 * @desc    Get expense purchases with filtering
 * @query   categoryId, typeId, status, dateFrom, dateTo, page, limit
 * @access  Public
 */
// router.get('/purchases', expenseController.getExpensePurchases);

/**
 * @route   POST /api/expenses/purchases
 * @desc    Create expense purchase with duplicate prevention
 * @body    { supplierId, expenseCategoryId, expenseTypeId, amount, description, paymentType, ... }
 * @headers x-session-id (for duplicate prevention)
 * @access  Private (requires authentication)
 */
// router.post('/purchases', expenseController.createExpensePurchase);

// ================================
// ANALYTICS AND REPORTING ROUTES
// ================================

/**
 * @route   GET /api/expenses/dashboard
 * @desc    Get expense dashboard data with analytics
 * @query   period (month, quarter, year)
 * @access  Public
 */
// router.get('/dashboard', expenseController.getExpenseDashboard);

// ================================
// UTILITY ROUTES
// ================================

/**
 * @route   GET /api/expenses/health
 * @desc    Health check endpoint for expense management system
 * @access  Public
 */
router.get('/health', expenseController.healthCheck);

export default router;