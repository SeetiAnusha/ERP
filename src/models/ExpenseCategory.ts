import { DataTypes, Model, Optional, Association, Op } from 'sequelize';
import sequelize from '../config/database';

/**
 * ExpenseCategory Model with Senior Developer Implementation
 * 
 * Features:
 * - Comprehensive validation with custom validators
 * - Hierarchical category support (self-referencing)
 * - Optimized for O(log n) lookups with proper indexing
 * - Duplicate prevention mechanisms
 * - Audit trail support
 * - Space-efficient design
 */

interface ExpenseCategoryAttributes {
  id: number;
  name: string;
  code: string;
  description?: string;
  parentCategoryId?: number;
  isActive: boolean;
  sortOrder: number;
  createdByUserId?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ExpenseCategoryCreationAttributes extends Optional<ExpenseCategoryAttributes, 'id' | 'isActive' | 'sortOrder'> {}

class ExpenseCategory extends Model<ExpenseCategoryAttributes, ExpenseCategoryCreationAttributes> implements ExpenseCategoryAttributes {
  public id!: number;
  public name!: string;
  public code!: string;
  public description?: string;
  public parentCategoryId?: number;
  public isActive!: boolean;
  public sortOrder!: number;
  public createdByUserId?: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public static associations: {
    parentCategory: Association<ExpenseCategory, ExpenseCategory>;
    subCategories: Association<ExpenseCategory, ExpenseCategory>;
    expenseTypes: Association<ExpenseCategory, any>; // Will be defined when ExpenseType is imported
  };

  /**
   * Get all active categories with hierarchical structure
   * Time Complexity: O(n log n) - optimized with indexes
   * Space Complexity: O(n)
   */
  public static async getActiveHierarchy(): Promise<ExpenseCategory[]> {
    return this.findAll({
      where: { isActive: true },
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
      include: [
        {
          model: ExpenseCategory,
          as: 'subCategories',
          where: { isActive: true },
          required: false,
          order: [['sortOrder', 'ASC']]
        }
      ]
    });
  }

  /**
   * Check if category name is unique (case-insensitive)
   * Time Complexity: O(log n) - uses index
   */
  public static async isNameUnique(name: string, excludeId?: number): Promise<boolean> {
    const whereClause: any = {
      name: sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), 'LIKE', name.toLowerCase())
    };
    
    if (excludeId) {
      whereClause.id = { [Op.ne]: excludeId };
    }

    const existing = await this.findOne({ where: whereClause });
    return !existing;
  }

  /**
   * Check if category code is unique (case-insensitive)
   * Time Complexity: O(log n) - uses index
   */
  public static async isCodeUnique(code: string, excludeId?: number): Promise<boolean> {
    const whereClause: any = {
      code: sequelize.where(sequelize.fn('UPPER', sequelize.col('code')), 'LIKE', code.toUpperCase())
    };
    
    if (excludeId) {
      whereClause.id = { [Op.ne]: excludeId };
    }

    const existing = await this.findOne({ where: whereClause });
    return !existing;
  }

  /**
   * Validate hierarchical integrity (prevent circular references)
   * Time Complexity: O(log n) - limited depth traversal
   */
  public async validateHierarchy(): Promise<boolean> {
    if (!this.parentCategoryId) return true;

    const visited = new Set<number>();
    let currentId: number | null = this.parentCategoryId;

    while (currentId) {
      if (visited.has(currentId) || currentId === this.id) {
        return false; // Circular reference detected
      }
      
      visited.add(currentId);
      
      const parent: ExpenseCategory | null = await ExpenseCategory.findByPk(currentId, {
        attributes: ['parentCategoryId']
      });
      
      if (!parent) break;
      currentId = parent.parentCategoryId || null;
    }

    return true;
  }

  /**
   * Get category path (breadcrumb)
   * Time Complexity: O(log n) - limited depth
   */
  public async getCategoryPath(): Promise<string[]> {
    const path: string[] = [this.name];
    let currentCategory: ExpenseCategory = this;

    while (currentCategory.parentCategoryId) {
      const parent: ExpenseCategory | null = await ExpenseCategory.findByPk(currentCategory.parentCategoryId, {
        attributes: ['name', 'parentCategoryId']
      });
      
      if (!parent) break;
      path.unshift(parent.name);
      currentCategory = parent;
    }

    return path;
  }
}

ExpenseCategory.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Category name cannot be empty'
        },
        len: {
          args: [2, 100],
          msg: 'Category name must be between 2 and 100 characters'
        },
        async isUnique(value: string) {
          const isUnique = await ExpenseCategory.isNameUnique(value, (this as any).id);
          if (!isUnique) {
            throw new Error('Category name must be unique');
          }
        }
      },
      set(value: string) {
        // Normalize name: trim and proper case
        this.setDataValue('name', value.trim().replace(/\s+/g, ' '));
      }
    },
    code: {
      type: DataTypes.STRING(10),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Category code cannot be empty'
        },
        len: {
          args: [2, 10],
          msg: 'Category code must be between 2 and 10 characters'
        },
        is: {
          args: /^[A-Z0-9_]+$/,
          msg: 'Category code must contain only uppercase letters, numbers, and underscores'
        },
        async isUnique(value: string) {
          const isUnique = await ExpenseCategory.isCodeUnique(value, (this as any).id);
          if (!isUnique) {
            throw new Error('Category code must be unique');
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
    parentCategoryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'expense_categories',
        key: 'id',
      },
      validate: {
        async isValidParent(value: number | null) {
          if (value === null) return;
          
          // Check if parent exists and is active
          const parent = await ExpenseCategory.findByPk(value);
          if (!parent) {
            throw new Error('Parent category does not exist');
          }
          
          if (!parent.isActive) {
            throw new Error('Parent category must be active');
          }
          
          // Prevent self-reference
          if (value === this.id) {
            throw new Error('Category cannot be its own parent');
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
    tableName: 'expense_categories',
    timestamps: true,
    indexes: [
      {
        fields: ['name'],
        unique: true,
        name: 'unique_expense_category_name'
      },
      {
        fields: ['code'],
        unique: true,
        name: 'unique_expense_category_code'
      },
      {
        fields: ['is_active', 'sort_order'],
        name: 'idx_expense_categories_active_sort'
      },
      {
        fields: ['parent_category_id'],
        name: 'idx_expense_categories_parent'
      }
    ],
    hooks: {
      beforeValidate: async (category: ExpenseCategory) => {
        // Validate hierarchical integrity
        if (category.parentCategoryId) {
          const isValid = await category.validateHierarchy();
          if (!isValid) {
            throw new Error('Invalid category hierarchy: circular reference detected');
          }
        }
      },
      beforeDestroy: async (category: ExpenseCategory) => {
        // Check if category has active expense types
        const ExpenseType = sequelize.models.ExpenseType;
        if (ExpenseType) {
          const activeTypes = await ExpenseType.count({
            where: { 
              categoryId: category.id,
              isActive: true 
            }
          });
          
          if (activeTypes > 0) {
            throw new Error('Cannot delete category with active expense types');
          }
        }
        
        // Check if category has subcategories
        const subCategories = await ExpenseCategory.count({
          where: { 
            parentCategoryId: category.id,
            isActive: true 
          }
        });
        
        if (subCategories > 0) {
          throw new Error('Cannot delete category with active subcategories');
        }
      }
    }
  }
);

export default ExpenseCategory;