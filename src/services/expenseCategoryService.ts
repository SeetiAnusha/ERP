import ExpenseCategory from '../models/ExpenseCategory';
import ExpenseType from '../models/ExpenseType';
import { BaseService } from '../core/BaseService';
import { ValidationFramework, CommonValidators } from '../core/ValidationFramework';
import { ValidationError, NotFoundError, BusinessLogicError } from '../core/AppError';

/**
 * Expense Category Service - Enhanced with BaseService & ValidationFramework
 * 
 * Provides business logic for expense category management with:
 * - Centralized error handling via BaseService
 * - Input validation via ValidationFramework
 * - Consistent error responses
 */

class ExpenseCategoryService extends BaseService {
  /**
   * Get all categories with pagination and filtering
   */
  async getAllCategories(options: {
    includeInactive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { includeInactive = false, page = 1, limit = 50 } = options;
    const offset = (page - 1) * limit;

    const whereClause: any = {};
    if (!includeInactive) {
      whereClause.isActive = true;
    }

    const { count, rows } = await ExpenseCategory.findAndCountAll({
      where: whereClause,
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
      limit,
      offset
    });

    return {
      categories: rows,
      total: count
    };
  }

  /**
   * Get category by ID with optional related data
   */
  async getCategoryById(id: number, options: {
    includeTypes?: boolean;
    includeSubcategories?: boolean;
  } = {}) {
    // Validate ID
    this.validateNumeric(id, 'Category ID', { min: 1, required: true });

    const { includeTypes = false, includeSubcategories = false } = options;

    const include: any[] = [];
    
    if (includeTypes) {
      include.push({
        model: ExpenseType,
        as: 'expenseTypes',
        where: { isActive: true },
        required: false
      });
    }

    if (includeSubcategories) {
      include.push({
        model: ExpenseCategory,
        as: 'subCategories',
        where: { isActive: true },
        required: false
      });
    }

    const category = await ExpenseCategory.findByPk(id, {
      include: include.length > 0 ? include : undefined
    });

    if (!category) {
      throw new NotFoundError(`Expense category with ID ${id} not found`);
    }

    return category;
  }

  /**
   * Create new expense category with validation
   */
  async createCategory(data: any) {
    // Validate required fields
    this.validateRequired(data, ['name', 'code'], 'expense category');

    // Validate individual fields
    ValidationFramework.validate(data, {
      rules: [
        { 
          field: 'name', 
          validator: CommonValidators.minLength(2).validator, 
          message: 'Category name must be at least 2 characters',
          required: true 
        },
        { 
          field: 'code', 
          validator: CommonValidators.minLength(2).validator, 
          message: 'Category code must be at least 2 characters',
          required: true 
        },
        { 
          field: 'sortOrder', 
          validator: CommonValidators.isNonNegative().validator, 
          message: 'Sort order must be zero or positive',
          required: false 
        }
      ]
    });

    try {
      return await ExpenseCategory.create(data);
    } catch (error: any) {
      throw this.handleError(error, 'Failed to create expense category');
    }
  }

  /**
   * Update expense category with validation
   */
  async updateCategory(id: number, data: any) {
    // Validate ID
    this.validateNumeric(id, 'Category ID', { min: 1, required: true });

    const category = await ExpenseCategory.findByPk(id);
    if (!category) {
      throw new NotFoundError(`Expense category with ID ${id} not found`);
    }

    // Validate fields if provided
    if (data.name !== undefined) {
      ValidationFramework.validate(data, {
        rules: [
          { 
            field: 'name', 
            validator: CommonValidators.minLength(2).validator, 
            message: 'Category name must be at least 2 characters',
            required: true 
          }
        ]
      });
    }

    if (data.sortOrder !== undefined) {
      this.validateNumeric(data.sortOrder, 'Sort order', { min: 0 });
    }

    try {
      await category.update(data);
      return category;
    } catch (error: any) {
      throw this.handleError(error, 'Failed to update expense category');
    }
  }

  /**
   * Delete expense category (soft delete) with validation
   */
  async deleteCategory(id: number) {
    // Validate ID
    this.validateNumeric(id, 'Category ID', { min: 1, required: true });

    const category = await ExpenseCategory.findByPk(id);
    if (!category) {
      throw new NotFoundError(`Expense category with ID ${id} not found`);
    }

    // Check if category has active expense types
    const activeTypes = await ExpenseType.count({
      where: { categoryId: id, isActive: true }
    });

    if (activeTypes > 0) {
      throw new BusinessLogicError(
        `Cannot delete category '${category.name}' because it has ${activeTypes} active expense type(s). Please deactivate or reassign the expense types first.`
      );
    }

    try {
      await category.update({ isActive: false });
      return { success: true, message: 'Category deleted successfully' };
    } catch (error: any) {
      throw this.handleError(error, 'Failed to delete expense category');
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    const totalCategories = await ExpenseCategory.count();
    const activeCategories = await ExpenseCategory.count({ where: { isActive: true } });

    return {
      totalCategories,
      activeCategories,
      status: 'healthy'
    };
  }
}

// Create singleton instance
const expenseCategoryService = new ExpenseCategoryService();

// Export static methods for backward compatibility
export default {
  getAllCategories: (options: any) => expenseCategoryService.getAllCategories(options),
  getCategoryById: (id: number, options?: any) => expenseCategoryService.getCategoryById(id, options),
  createCategory: (data: any) => expenseCategoryService.createCategory(data),
  updateCategory: (id: number, data: any) => expenseCategoryService.updateCategory(id, data),
  deleteCategory: (id: number) => expenseCategoryService.deleteCategory(id),
  healthCheck: () => expenseCategoryService.healthCheck()
};