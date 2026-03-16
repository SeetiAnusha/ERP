import { DataTypes, Model, Optional, Association, Op } from 'sequelize';
import sequelize from '../config/database';
import ExpenseCategory from './ExpenseCategory';

/**
 * ExpenseType Model with Senior Developer Implementation
 * 
 * Features:
 * - Comprehensive validation with business logic
 * - Approval workflow support
 * - Optimized for O(log n) lookups
 * - Duplicate prevention within categories
 * - Audit trail support
 * - Space-efficient design with proper indexing
 */

interface ExpenseTypeAttributes {
  id: number;
  categoryId: number;
  name: string;
  code: string;
  description?: string;
  defaultAccountCode?: string;
  requiresApproval: boolean;
  approvalThreshold?: number;
  isActive: boolean;
  sortOrder: number;
  createdByUserId?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ExpenseTypeCreationAttributes extends Optional<ExpenseTypeAttributes, 'id' | 'requiresApproval' | 'isActive' | 'sortOrder'> {}

class ExpenseType extends Model<ExpenseTypeAttributes, ExpenseTypeCreationAttributes> implements ExpenseTypeAttributes {
  public id!: number;
  public categoryId!: number;
  public name!: string;
  public code!: string;
  public description?: string;
  public defaultAccountCode?: string;
  public requiresApproval!: boolean;
  public approvalThreshold?: number;
  public isActive!: boolean;
  public sortOrder!: number;
  public createdByUserId?: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association properties
  public category?: ExpenseCategory;

  // Associations
  public static associations: {
    category: Association<ExpenseType, ExpenseCategory>;
  };

  /**
   * Get all active expense types by category
   * Time Complexity: O(log n) - uses category index
   * Space Complexity: O(k) where k is number of types in category
   */
  public static async getActiveByCategory(categoryId: number): Promise<ExpenseType[]> {
    return this.findAll({
      where: { 
        categoryId,
        isActive: true 
      },
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
      include: [
        {
          model: ExpenseCategory,
          as: 'category',
          attributes: ['name', 'code']
        }
      ]
    });
  }

  /**
   * Get expense types that require approval
   * Time Complexity: O(log n) - uses approval index
   */
  public static async getApprovalRequired(): Promise<ExpenseType[]> {
    return this.findAll({
      where: { 
        requiresApproval: true,
        isActive: true 
      },
      order: [['approvalThreshold', 'ASC']],
      include: [
        {
          model: ExpenseCategory,
          as: 'category',
          attributes: ['name', 'code']
        }
      ]
    });
  }

  /**
   * Check if expense type name is unique within category
   * Time Complexity: O(log n) - uses composite index
   */
  public static async isNameUniqueInCategory(categoryId: number, name: string, excludeId?: number): Promise<boolean> {
    const whereClause: any = {
      categoryId,
      name: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), 'LIKE', name.toLowerCase())
    };
    
    if (excludeId) {
      whereClause.id = { [Op.ne]: excludeId };
    }

    const existing = await this.findOne({ where: whereClause });
    return !existing;
  }

  /**
   * Check if expense type code is unique within category
   * Time Complexity: O(log n) - uses composite index
   */
  public static async isCodeUniqueInCategory(categoryId: number, code: string, excludeId?: number): Promise<boolean> {
    const whereClause: any = {
      categoryId,
      code: sequelize.where(sequelize.fn('UPPER', sequelize.col('code')), 'LIKE', code.toUpperCase())
    };
    
    if (excludeId) {
      whereClause.id = { [Op.ne]: excludeId };
    }

    const existing = await this.findOne({ where: whereClause });
    return !existing;
  }

  /**
   * Check if amount requires approval for this expense type
   * Time Complexity: O(1)
   */
  public requiresApprovalForAmount(amount: number): boolean {
    if (!this.requiresApproval) return false;
    if (!this.approvalThreshold) return true;
    return amount >= this.approvalThreshold;
  }

  /**
   * Get full expense type path (category + type)
   * Time Complexity: O(1) if category is included, O(log n) if not
   */
  public async getFullPath(): Promise<string> {
    let categoryName: string;
    
    if (this.category) {
      categoryName = this.category.name;
    } else {
      const category = await ExpenseCategory.findByPk(this.categoryId, {
        attributes: ['name']
      });
      categoryName = category?.name || 'Unknown Category';
    }
    
    return `${categoryName} > ${this.name}`;
  }

  /**
   * Validate business rules for expense type
   */
  public async validateBusinessRules(): Promise<void> {
    // If requires approval, threshold should be set
    if (this.requiresApproval && this.approvalThreshold === null) {
      throw new Error('Approval threshold must be set when approval is required');
    }

    // Validate category exists and is active
    const category = await ExpenseCategory.findByPk(this.categoryId);
    if (!category) {
      throw new Error('Category does not exist');
    }
    
    if (!category.isActive) {
      throw new Error('Cannot create expense type for inactive category');
    }
  }
}

ExpenseType.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'expense_categories',
        key: 'id',
      },
      validate: {
        notNull: {
          msg: 'Category is required'
        },
        async isValidCategory(value: number) {
          const category = await ExpenseCategory.findByPk(value);
          if (!category) {
            throw new Error('Selected category does not exist');
          }
          if (!category.isActive) {
            throw new Error('Selected category is not active');
          }
        }
      }
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Expense type name cannot be empty'
        },
        len: {
          args: [2, 100],
          msg: 'Expense type name must be between 2 and 100 characters'
        },
        async isUniqueInCategory(value: string) {
          const isUnique = await ExpenseType.isNameUniqueInCategory((this as any).categoryId, value, (this as any).id);
          if (!isUnique) {
            throw new Error('Expense type name must be unique within category');
          }
        }
      },
      set(value: string) {
        // Normalize name: trim and proper case
        this.setDataValue('name', value.trim().replace(/\s+/g, ' '));
      }
    },
    code: {
      type: DataTypes.STRING(15),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Expense type code cannot be empty'
        },
        len: {
          args: [2, 15],
          msg: 'Expense type code must be between 2 and 15 characters'
        },
        is: {
          args: /^[A-Z0-9_]+$/,
          msg: 'Expense type code must contain only uppercase letters, numbers, and underscores'
        },
        async isUniqueInCategory(value: string) {
          const isUnique = await ExpenseType.isCodeUniqueInCategory((this as any).categoryId, value, (this as any).id);
          if (!isUnique) {
            throw new Error('Expense type code must be unique within category');
          }
        }
      },
      set(value: string) {
        // Normalize code: uppercase and trim
        this.setDataValue('code', value.trim().toUpperCase());
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 1000],
          msg: 'Description cannot exceed 1000 characters'
        }
      }
    },
    defaultAccountCode: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        len: {
          args: [0, 20],
          msg: 'Account code cannot exceed 20 characters'
        },
        is: {
          args: /^[A-Z0-9\-\.]*$/,
          msg: 'Account code must contain only uppercase letters, numbers, hyphens, and dots'
        }
      },
      set(value: string | null) {
        if (value) {
          this.setDataValue('defaultAccountCode', value.trim().toUpperCase());
        } else {
          this.setDataValue('defaultAccountCode', undefined);
        }
      }
    },
    requiresApproval: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    approvalThreshold: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      validate: {
        min: {
          args: [0],
          msg: 'Approval threshold must be non-negative'
        },
        max: {
          args: [999999999999.99],
          msg: 'Approval threshold is too large'
        },
        isValidThreshold(value: number | null) {
          if (this.requiresApproval && value === null) {
            throw new Error('Approval threshold is required when approval is enabled');
          }
          if (!this.requiresApproval && value !== null) {
            throw new Error('Approval threshold should not be set when approval is disabled');
          }
        }
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: 'Sort order must be non-negative'
        }
      }
    },
    createdByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'expense_types',
    timestamps: true,
    indexes: [
      {
        fields: ['category_id', 'name'],
        unique: true,
        name: 'unique_expense_type_per_category'
      },
      {
        fields: ['category_id', 'code'],
        unique: true,
        name: 'unique_expense_type_code_per_category'
      },
      {
        fields: ['category_id', 'is_active', 'sort_order'],
        name: 'idx_expense_types_category_active_sort'
      },
      {
        fields: ['requires_approval', 'approval_threshold'],
        name: 'idx_expense_types_approval'
      }
    ],
    hooks: {
      beforeValidate: async (expenseType: ExpenseType) => {
        // Validate business rules
        await expenseType.validateBusinessRules();
      },
      beforeDestroy: async (expenseType: ExpenseType) => {
        // Check if expense type is being used in purchases
        const Purchase = sequelize.models.Purchase;
        if (Purchase) {
          const usageCount = await Purchase.count({
            where: { 
              expenseTypeId: expenseType.id,
              transactionType: 'EXPENSE'
            }
          });
          
          if (usageCount > 0) {
            throw new Error('Cannot delete expense type that is being used in purchases');
          }
        }
      }
    }
  }
);

// Associations will be set up in a separate file to avoid circular dependencies

export default ExpenseType;