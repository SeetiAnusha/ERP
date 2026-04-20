import { Request, Response, NextFunction } from 'express';
import ExpenseCategoryService from '../services/expenseCategoryService';
import ExpenseTypeService from '../services/expenseTypeService';

/**
 * Enhanced Expense Controller - Simplified with Global Error Middleware
 * 
 * All error handling is now done by the global error middleware.
 * Controllers just call services and pass errors to next().
 * 
 * Benefits:
 * - Clean, readable code
 * - Consistent error responses
 * - No code duplication
 */

// ================================
// EXPENSE CATEGORIES ENDPOINTS
// ================================

export const getAllCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { includeInactive = 'false', page = '1', limit = '50' } = req.query;
    
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
  } catch (error) {
    console.error('[ExpenseController] Error getting categories:', error);
    next(error);
  }
};

export const getCategoryById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categoryId = parseInt(req.params.id);
    const { includeTypes = 'true', includeSubcategories = 'true' } = req.query;
    
    console.log(`[ExpenseController] Getting category ${categoryId}`);
    
    const category = await ExpenseCategoryService.getCategoryById(categoryId, {
      includeTypes: includeTypes === 'true',
      includeSubcategories: includeSubcategories === 'true'
    });
    
    res.json({
      success: true,
      data: category,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[ExpenseController] Error getting category by ID:', error);
    next(error);
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, code, description, parentCategoryId, sortOrder, createdByUserId } = req.body;
    
    const sanitizedData = {
      name: name?.trim(),
      code: code?.trim().toUpperCase(),
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
  } catch (error) {
    console.error('[ExpenseController] Error creating category:', error);
    next(error);
  }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categoryId = parseInt(req.params.id);
    const updateData = req.body;
    
    console.log(`[ExpenseController] Updating category ${categoryId}:`, updateData);
    
    const category = await ExpenseCategoryService.updateCategory(categoryId, updateData);
    
    res.json({
      success: true,
      data: category,
      message: 'Expense category updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[ExpenseController] Error updating category:', error);
    next(error);
  }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categoryId = parseInt(req.params.id);
    
    console.log(`[ExpenseController] Deleting category ${categoryId}`);
    
    const result = await ExpenseCategoryService.deleteCategory(categoryId);
    
    res.json({
      success: true,
      message: result.message || 'Expense category deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[ExpenseController] Error deleting category:', error);
    next(error);
  }
};

// ================================
// EXPENSE TYPES ENDPOINTS
// ================================

export const getTypesByCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    const { includeInactive = 'false', page = '1', limit = '50' } = req.query;
    
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    const includeInactiveFlag = includeInactive === 'true';
    
    console.log(`[ExpenseController] Getting types for category ${categoryId}`);
    
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
  } catch (error) {
    console.error('[ExpenseController] Error getting types by category:', error);
    next(error);
  }
};

export const getApprovalRequiredTypes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('[ExpenseController] Getting approval required types');
    
    const types = await ExpenseTypeService.getApprovalRequiredTypes();
    
    res.json({
      success: true,
      data: types,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[ExpenseController] Error getting approval required types:', error);
    next(error);
  }
};

export const createExpenseType = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { categoryId, name, code, description, requiresApproval, approvalThreshold, defaultAccountCode, createdByUserId } = req.body;
    
    const sanitizedData = {
      categoryId: parseInt(categoryId),
      name: name?.trim(),
      code: code?.trim().toUpperCase(),
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
  } catch (error) {
    console.error('[ExpenseController] Error creating expense type:', error);
    next(error);
  }
};

// ================================
// UTILITY ENDPOINTS
// ================================

export const healthCheck = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const health = await ExpenseCategoryService.healthCheck();
    
    res.json({
      success: true,
      status: 'healthy',
      data: health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[ExpenseController] Health check failed:', error);
    next(error);
  }
};
