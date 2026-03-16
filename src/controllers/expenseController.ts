import { Request, Response } from 'express';
import { ValidationError, UniqueConstraintError, ForeignKeyConstraintError } from 'sequelize';
import ExpenseCategoryService from '../services/expenseCategoryService';
import ExpenseTypeService from '../services/expenseTypeService';
//import EnhancedPurchaseService from '../services/enhancedPurchaseService';

/**
 * Enhanced Expense Controller with Senior Developer Implementation
 * 
 * Features:
 * - Comprehensive error handling with specific error types
 * - Input validation and sanitization
 * - Duplicate prevention mechanisms
 * - Performance optimization with pagination
 * - Detailed logging for debugging
 * - RESTful API design patterns
 * - Security best practices
 */

// ================================
// EXPENSE CATEGORIES ENDPOINTS
// ================================

/**
 * Get all active expense categories with hierarchical structure
 * GET /api/expenses/categories
 * Query params: ?includeInactive=true, ?page=1, ?limit=50
 */
export const getAllCategories = async (req: Request, res: Response) => {
  try {
    const { includeInactive = 'false', page = '1', limit = '50' } = req.query;
    
    // Input validation
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    const includeInactiveFlag = includeInactive === 'true';
    
    console.log(`[ExpenseController] Getting categories - Page: ${pageNum}, Limit: ${limitNum}, Include Inactive: ${includeInactiveFlag}`);
    
    const result = await ExpenseCategoryService.getAllCategories({
      includeInactive: includeInactiveFlag,
      page: pageNum,
      limit: limitNum
    });
    
    res.json({
      success: true,
      data: result.categories,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: result.total,
        totalPages: Math.ceil(result.total / limitNum)
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[ExpenseController] Error getting categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve expense categories',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get expense category by ID with related data
 * GET /api/expenses/categories/:id
 * Query params: ?includeTypes=true, ?includeSubcategories=true
 */
export const getCategoryById = async (req: Request, res: Response) => {
  try {
    const categoryId = parseInt(req.params.id);
    const { includeTypes = 'true', includeSubcategories = 'true' } = req.query;
    
    // Input validation
    if (isNaN(categoryId) || categoryId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category ID',
        message: 'Category ID must be a positive integer',
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`[ExpenseController] Getting category ${categoryId} with types: ${includeTypes}, subcategories: ${includeSubcategories}`);
    
    const category = await ExpenseCategoryService.getCategoryById(categoryId, {
      includeTypes: includeTypes === 'true',
      includeSubcategories: includeSubcategories === 'true'
    });
    
    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
        message: `Expense category with ID ${categoryId} does not exist`,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      data: category,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[ExpenseController] Error getting category by ID:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve expense category',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Create new expense category with validation
 * POST /api/expenses/categories
 * Body: { name, code, description?, parentCategoryId?, sortOrder? }
 */
export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, code, description, parentCategoryId, sortOrder, createdByUserId } = req.body;
    
    // Input validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Category name is required and must be a non-empty string',
        timestamp: new Date().toISOString()
      });
    }
    
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Category code is required and must be a non-empty string',
        timestamp: new Date().toISOString()
      });
    }
    
    // Sanitize input
    const sanitizedData = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description?.trim() || null,
      parentCategoryId: parentCategoryId ? parseInt(parentCategoryId) : null,
      sortOrder: sortOrder ? parseInt(sortOrder) : 0,
      createdByUserId: createdByUserId ? parseInt(createdByUserId) : null
    };
    
    console.log('[ExpenseController] Creating category:', sanitizedData);
    
    const category = await ExpenseCategoryService.createCategory(sanitizedData);
    
    res.status(201).json({
      success: true,
      data: category,
      message: 'Expense category created successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[ExpenseController] Error creating category:', error);
    
    // Handle specific error types
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
        message: 'Category name or code already exists',
        timestamp: new Date().toISOString()
      });
    }
    
    if (error instanceof ForeignKeyConstraintError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid reference',
        message: 'Parent category does not exist',
        timestamp: new Date().toISOString()
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create expense category',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Update expense category
 * PUT /api/expenses/categories/:id
 * Body: { name?, code?, description?, parentCategoryId?, sortOrder?, isActive? }
 */
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const categoryId = parseInt(req.params.id);
    const updateData = req.body;
    
    // Input validation
    if (isNaN(categoryId) || categoryId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category ID',
        message: 'Category ID must be a positive integer',
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`[ExpenseController] Updating category ${categoryId}:`, updateData);
    
    const category = await ExpenseCategoryService.updateCategory(categoryId, updateData);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found',
        message: `Expense category with ID ${categoryId} does not exist`,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      data: category,
      message: 'Expense category updated successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[ExpenseController] Error updating category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update expense category',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Soft delete expense category
 * DELETE /api/expenses/categories/:id
 */
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const categoryId = parseInt(req.params.id);
    
    // Input validation
    if (isNaN(categoryId) || categoryId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category ID',
        message: 'Category ID must be a positive integer',
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`[ExpenseController] Deleting category ${categoryId}`);
    
    const result = await ExpenseCategoryService.deleteCategory(categoryId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete category',
        message: result.message,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      message: 'Expense category deleted successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[ExpenseController] Error deleting category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete expense category',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// ================================
// EXPENSE TYPES ENDPOINTS
// ================================

/**
 * Get expense types by category
 * GET /api/expenses/categories/:categoryId/types
 * Query params: ?includeInactive=false, ?page=1, ?limit=50
 */
export const getTypesByCategory = async (req: Request, res: Response) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    const { includeInactive = 'false', page = '1', limit = '50' } = req.query;
    
    // Input validation
    if (isNaN(categoryId) || categoryId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category ID',
        message: 'Category ID must be a positive integer',
        timestamp: new Date().toISOString()
      });
    }
    
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    const includeInactiveFlag = includeInactive === 'true';
    
    console.log(`[ExpenseController] Getting types for category ${categoryId} - Page: ${pageNum}, Limit: ${limitNum}`);
    
    const result = await ExpenseTypeService.getTypesByCategory(categoryId, {
      includeInactive: includeInactiveFlag,
      page: pageNum,
      limit: limitNum
    });
    
    res.json({
      success: true,
      data: result.types,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: result.total,
        totalPages: Math.ceil(result.total / limitNum)
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[ExpenseController] Error getting types by category:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve expense types',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get all expense types that require approval
 * GET /api/expenses/types/approval-required
 */
export const getApprovalRequiredTypes = async (req: Request, res: Response) => {
  try {
    console.log('[ExpenseController] Getting approval required types');
    
    const types = await ExpenseTypeService.getApprovalRequiredTypes();
    
    res.json({
      success: true,
      data: types,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[ExpenseController] Error getting approval required types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve approval required types',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Create new expense type
 * POST /api/expenses/types
 * Body: { categoryId, name, code, description?, requiresApproval?, approvalThreshold?, defaultAccountCode? }
 */
export const createExpenseType = async (req: Request, res: Response) => {
  try {
    const { categoryId, name, code, description, requiresApproval, approvalThreshold, defaultAccountCode, createdByUserId } = req.body;
    
    // Input validation
    if (!categoryId || isNaN(parseInt(categoryId))) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Category ID is required and must be a valid integer',
        timestamp: new Date().toISOString()
      });
    }
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Expense type name is required and must be a non-empty string',
        timestamp: new Date().toISOString()
      });
    }
    
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Expense type code is required and must be a non-empty string',
        timestamp: new Date().toISOString()
      });
    }
    
    // Sanitize input
    const sanitizedData = {
      categoryId: parseInt(categoryId),
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description?.trim() || null,
      requiresApproval: Boolean(requiresApproval),
      approvalThreshold: approvalThreshold ? parseFloat(approvalThreshold) : null,
      defaultAccountCode: defaultAccountCode?.trim().toUpperCase() || null,
      createdByUserId: createdByUserId ? parseInt(createdByUserId) : null
    };
    
    console.log('[ExpenseController] Creating expense type:', sanitizedData);
    
    const expenseType = await ExpenseTypeService.createExpenseType(sanitizedData);
    
    res.status(201).json({
      success: true,
      data: expenseType,
      message: 'Expense type created successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[ExpenseController] Error creating expense type:', error);
    
    // Handle specific error types
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
        message: 'Expense type name or code already exists in this category',
        timestamp: new Date().toISOString()
      });
    }
    
    if (error instanceof ForeignKeyConstraintError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid reference',
        message: 'Category does not exist',
        timestamp: new Date().toISOString()
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create expense type',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// ================================
// EXPENSE PURCHASES ENDPOINTS
// ================================

/**
 * Get expense purchases with filtering
 * GET /api/expenses/purchases
 * Query params: ?categoryId, ?typeId, ?status, ?dateFrom, ?dateTo, ?page=1, ?limit=50
 */
// export const getExpensePurchases = async (req: Request, res: Response) => {
//   try {
//     const { categoryId, typeId, status, dateFrom, dateTo, page = '1', limit = '50' } = req.query;
    
//     // Input validation and sanitization
//     const pageNum = Math.max(1, parseInt(page as string) || 1);
//     const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    
//     const filters: any = {
//       transactionType: 'EXPENSE'
//     };
    
//     if (categoryId) filters.expenseCategoryId = parseInt(categoryId as string);
//     if (typeId) filters.expenseTypeId = parseInt(typeId as string);
//     if (status) filters.status = status;
//     if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
//     if (dateTo) filters.dateTo = new Date(dateTo as string);
    
//     console.log('[ExpenseController] Getting expense purchases with filters:', filters);
    
//     const result = await EnhancedPurchaseService.getExpensePurchases({
//       ...filters,
//       page: pageNum,
//       limit: limitNum
//     });
    
//     res.json({
//       success: true,
//       data: result.purchases,
//       pagination: {
//         page: pageNum,
//         limit: limitNum,
//         total: result.total,
//         totalPages: Math.ceil(result.total / limitNum)
//       },
//       timestamp: new Date().toISOString()
//     });
    
//   } catch (error: any) {
//     console.error('[ExpenseController] Error getting expense purchases:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to retrieve expense purchases',
//       message: error.message,
//       timestamp: new Date().toISOString()
//     });
//   }
// };

/**
 * Create expense purchase with duplicate prevention
 * POST /api/expenses/purchases
 * Body: { supplierId, expenseCategoryId, expenseTypeId, amount, description, paymentType, ... }
 */
// export const createExpensePurchase = async (req: Request, res: Response) => {
//   try {
//     const purchaseData = req.body;
    
//     // Extract client session info for duplicate prevention
//     const clientSessionId = req.headers['x-session-id'] as string;
//     const userAgent = req.headers['user-agent'];
//     const ipAddress = req.ip || req.connection.remoteAddress;
    
//     // Add duplicate prevention data
//     const enhancedData = {
//       ...purchaseData,
//       transactionType: 'EXPENSE',
//       clientSessionId,
//       submissionTimestamp: new Date(),
//       metadata: {
//         userAgent,
//         ipAddress,
//         submittedAt: new Date().toISOString()
//       }
//     };
    
//     console.log('[ExpenseController] Creating expense purchase with duplicate prevention');
    
//     const purchase = await EnhancedPurchaseService.createExpensePurchase(enhancedData);
    
//     res.status(201).json({
//       success: true,
//       data: purchase,
//       message: 'Expense purchase created successfully',
//       timestamp: new Date().toISOString()
//     });
    
//   } catch (error: any) {
//     console.error('[ExpenseController] Error creating expense purchase:', error);
    
//     // Handle duplicate submission error
//     if (error.message.includes('Duplicate submission detected')) {
//       return res.status(409).json({
//         success: false,
//         error: 'Duplicate submission',
//         message: 'This expense purchase was already submitted recently. Please wait before trying again.',
//         timestamp: new Date().toISOString()
//       });
//     }
    
//     // Handle validation errors
//     if (error instanceof ValidationError) {
//       return res.status(400).json({
//         success: false,
//         error: 'Validation failed',
//         message: error.errors.map(e => e.message).join(', '),
//         details: error.errors,
//         timestamp: new Date().toISOString()
//       });
//     }
    
//     res.status(500).json({
//       success: false,
//       error: 'Failed to create expense purchase',
//       message: error.message,
//       timestamp: new Date().toISOString()
//     });
//   }
// };

// ================================
// UTILITY ENDPOINTS
// ================================

/**
 * Get expense dashboard data
 * GET /api/expenses/dashboard
 * Query params: ?period=month (month, quarter, year)
 */
// export const getExpenseDashboard = async (req: Request, res: Response) => {
//   try {
//     const { period = 'month' } = req.query;
    
//     console.log(`[ExpenseController] Getting expense dashboard for period: ${period}`);
    
//     const dashboardData = await EnhancedPurchaseService.getExpenseDashboard(period as string);
    
//     res.json({
//       success: true,
//       data: dashboardData,
//       timestamp: new Date().toISOString()
//     });
    
//   } catch (error: any) {
//     console.error('[ExpenseController] Error getting expense dashboard:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to retrieve expense dashboard data',
//       message: error.message,
//       timestamp: new Date().toISOString()
//     });
//   }
// };

/**
 * Health check endpoint
 * GET /api/expenses/health
 */
export const healthCheck = async (req: Request, res: Response) => {
  try {
    const health = await ExpenseCategoryService.healthCheck();
    
    res.json({
      success: true,
      status: 'healthy',
      data: health,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[ExpenseController] Health check failed:', error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};