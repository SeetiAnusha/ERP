import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import Supplier from './Supplier';
import ExpenseCategory from './ExpenseCategory';
import ExpenseType from './ExpenseType';
import BankAccount from './BankAccount';
import Card from './Card';

interface BusinessExpenseAttributes {
  id: number;
  registrationNumber: string;
  date: Date;
  supplierId: number;
  supplierRnc?: string;
  expenseCategoryId: number;
  expenseTypeId: number;
  description?: string;
  amount: number;
  expenseType: string;
  paymentType: string;
  paidAmount: number;
  balanceAmount: number;
  status: string;
  paymentStatus: string;
  
  // Payment method specific fields
  bankAccountId?: number;
  cardId?: number;
  chequeNumber?: string;
  chequeDate?: Date;
  transferNumber?: string;
  transferDate?: Date;
  paymentReference?: string;
  voucherDate?: Date;
  
  createdAt?: Date;
  updatedAt?: Date;
}

interface BusinessExpenseCreationAttributes extends Optional<BusinessExpenseAttributes, 'id'> {}

class BusinessExpense extends Model<BusinessExpenseAttributes, BusinessExpenseCreationAttributes> implements BusinessExpenseAttributes {
  public id!: number;
  public registrationNumber!: string;
  public date!: Date;
  public supplierId!: number;
  public supplierRnc?: string;
  public expenseCategoryId!: number;
  public expenseTypeId!: number;
  public description?: string;
  public amount!: number;
  public expenseType!: string;
  public paymentType!: string;
  public paidAmount!: number;
  public balanceAmount!: number;
  public status!: string;
  public paymentStatus!: string;
  
  // Payment method specific fields
  public bankAccountId?: number;
  public cardId?: number;
  public chequeNumber?: string;
  public chequeDate?: Date;
  public transferNumber?: string;
  public transferDate?: Date;
  public paymentReference?: string;
  public voucherDate?: Date;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public supplier?: any;
  public expenseCategory?: any;
  public expenseTypeModel?: any;
  public bankAccount?: any;
  public card?: any;
  public associatedCosts?: any[];
}

BusinessExpense.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    registrationNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'suppliers',
        key: 'id',
      },
    },
    supplierRnc: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    expenseCategoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'expense_categories',
        key: 'id',
      },
    },
    expenseTypeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'expense_types',
        key: 'id',
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    expenseType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'Services or other',
    },
    paymentType: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    paidAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    balanceAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'COMPLETED',
    },
    paymentStatus: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'Unpaid',
    },
    
    // Payment method specific fields
    bankAccountId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'bank_accounts',
        key: 'id',
      },
    },
    cardId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'cards',
        key: 'id',
      },
    },
    chequeNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    chequeDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    transferNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    transferDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    paymentReference: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    voucherDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'business_expenses',
    timestamps: true,
    indexes: [
      {
        fields: ['registration_number'],
        unique: true,
      },
      {
        fields: ['date'],
      },
      {
        fields: ['supplier_id'],
      },
      {
        fields: ['expense_category_id'],
      },
      {
        fields: ['payment_status'],
      },
    ],
  }
);

// Define associations
BusinessExpense.belongsTo(Supplier, { foreignKey: 'supplierId', as: 'supplier' });
BusinessExpense.belongsTo(ExpenseCategory, { foreignKey: 'expenseCategoryId', as: 'expenseCategory' });
BusinessExpense.belongsTo(ExpenseType, { foreignKey: 'expenseTypeId', as: 'expenseTypeModel' });
BusinessExpense.belongsTo(BankAccount, { foreignKey: 'bankAccountId', as: 'bankAccount' });
BusinessExpense.belongsTo(Card, { foreignKey: 'cardId', as: 'card' });

// Import BusinessExpenseAssociatedCost after to avoid circular dependency
import('./BusinessExpenseAssociatedCost').then((module) => {
  const BusinessExpenseAssociatedCost = module.default;
  BusinessExpense.hasMany(BusinessExpenseAssociatedCost, { foreignKey: 'businessExpenseId', as: 'associatedCosts' });
});

export default BusinessExpense;