import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import BankAccount from './BankAccount';
import Card from './Card';

interface BusinessExpenseAssociatedCostAttributes {
  id: number;
  businessExpenseId: number;
  supplierRnc?: string;
  supplierName?: string;
  concept: string;
  ncf?: string;
  date: Date;
  amount: number;
  expenseType: string;
  paymentType: string;
  bankAccountId?: number;
  cardId?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface BusinessExpenseAssociatedCostCreationAttributes extends Optional<BusinessExpenseAssociatedCostAttributes, 'id'> {}

class BusinessExpenseAssociatedCost extends Model<BusinessExpenseAssociatedCostAttributes, BusinessExpenseAssociatedCostCreationAttributes> implements BusinessExpenseAssociatedCostAttributes {
  public id!: number;
  public businessExpenseId!: number;
  public supplierRnc?: string;
  public supplierName?: string;
  public concept!: string;
  public ncf?: string;
  public date!: Date;
  public amount!: number;
  public expenseType!: string;
  public paymentType!: string;
  public bankAccountId?: number;
  public cardId?: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public businessExpense?: any;
  public bankAccount?: any;
  public card?: any;
}

BusinessExpenseAssociatedCost.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    businessExpenseId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'business_expenses',
        key: 'id',
      },
    },
    supplierRnc: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    supplierName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    concept: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    ncf: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    expenseType: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    paymentType: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
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
  },
  {
    sequelize,
    tableName: 'business_expense_associated_costs',
    timestamps: true,
  }
);

// Define associations - handled in businessExpenseAssociations.ts to avoid circular dependency
// BusinessExpenseAssociatedCost.belongsTo(BusinessExpense, { foreignKey: 'businessExpenseId', as: 'businessExpense' });

BusinessExpenseAssociatedCost.belongsTo(BankAccount, { foreignKey: 'bankAccountId', as: 'bankAccount' });
BusinessExpenseAssociatedCost.belongsTo(Card, { foreignKey: 'cardId', as: 'card' });

export default BusinessExpenseAssociatedCost;