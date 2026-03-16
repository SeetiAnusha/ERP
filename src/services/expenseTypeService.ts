import ExpenseType from '../models/ExpenseType';
import ExpenseCategory from '../models/ExpenseCategory';

/**
 * Expense Type Service
 * 
 * Provides business logic for expense type management
 */

class ExpenseTypeService {
  /**
   * Get expense types by category with pagination
   */
  public static async getTypesByCategory(categoryId: number, options: {
    includeInactive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { includeInactive = false, page = 1, limit = 50 } = options;
    const offset = (page - 1) * limit;

    const whereClause: any = { categoryId };
    if (!includeInactive) {
      whereClause.isActive = true;
    }

    const { count, rows } = await ExpenseType.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: ExpenseCategory,
          as: 'category',
          attributes: ['id', 'name', 'code']
        }
      ],
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
      limit,
      offset
    });

    return {
      types: rows,
      total: count
    };
  }

  /**
   * Get all expense types that require approval
   */
  public static async getApprovalRequiredTypes() {
    return ExpenseType.findAll({
      where: { 
        requiresApproval: true,
        isActive: true 
      },
      include: [
        {
          model: ExpenseCategory,
          as: 'category',
          attributes: ['id', 'name', 'code']
        }
      ],
      order: [['approvalThreshold', 'ASC']]
    });
  }

  /**
   * Create new expense type
   */
  public static async createExpenseType(data: any) {
    return ExpenseType.create(data);
  }

  /**
   * Update expense type
   */
  public static async updateExpenseType(id: number, data: any) {
    const expenseType = await ExpenseType.findByPk(id);
    if (!expenseType) {
      return null;
    }

    await expenseType.update(data);
    return expenseType;
  }

  /**
   * Delete expense type (soft delete)
   */
  public static async deleteExpenseType(id: number) {
    const expenseType = await ExpenseType.findByPk(id);
    if (!expenseType) {
      return { success: false, message: 'Expense type not found' };
    }

    // Check if expense type is being used in purchases
    // This would need to be implemented based on your Purchase model relationships

    await expenseType.update({ isActive: false });
    return { success: true, message: 'Expense type deleted successfully' };
  }
}

export default ExpenseTypeService;