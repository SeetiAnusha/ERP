import ExpenseCategory from '../models/ExpenseCategory';
import ExpenseType from '../models/ExpenseType';

/**
 * Expense Category Service
 * 
 * Provides business logic for expense category management
 */

class ExpenseCategoryService {
  /**
   * Get all categories with pagination and filtering
   */
  public static async getAllCategories(options: {
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
  public static async getCategoryById(id: number, options: {
    includeTypes?: boolean;
    includeSubcategories?: boolean;
  } = {}) {
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

    return ExpenseCategory.findByPk(id, {
      include: include.length > 0 ? include : undefined
    });
  }

  /**
   * Create new expense category
   */
  public static async createCategory(data: any) {
    return ExpenseCategory.create(data);
  }

  /**
   * Update expense category
   */
  public static async updateCategory(id: number, data: any) {
    const category = await ExpenseCategory.findByPk(id);
    if (!category) {
      return null;
    }

    await category.update(data);
    return category;
  }

  /**
   * Delete expense category (soft delete)
   */
  public static async deleteCategory(id: number) {
    const category = await ExpenseCategory.findByPk(id);
    if (!category) {
      return { success: false, message: 'Category not found' };
    }

    // Check if category has active expense types
    const activeTypes = await ExpenseType.count({
      where: { categoryId: id, isActive: true }
    });

    if (activeTypes > 0) {
      return { 
        success: false, 
        message: 'Cannot delete category with active expense types' 
      };
    }

    await category.update({ isActive: false });
    return { success: true, message: 'Category deleted successfully' };
  }

  /**
   * Health check
   */
  public static async healthCheck() {
    const totalCategories = await ExpenseCategory.count();
    const activeCategories = await ExpenseCategory.count({ where: { isActive: true } });

    return {
      totalCategories,
      activeCategories,
      status: 'healthy'
    };
  }
}

export default ExpenseCategoryService;