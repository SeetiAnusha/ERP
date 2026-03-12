import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ExpenseAttributes {
  id: number;
  registrationNumber: string;
  registrationDate: Date;
  expenseType: string;
  amount: number;
  description?: string;
  relatedDocumentType?: string;
  relatedDocumentNumber?: string;
  paymentMethod: string;
  status: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ExpenseCreationAttributes extends Optional<ExpenseAttributes, 'id'> {}

class Expense extends Model<ExpenseAttributes, ExpenseCreationAttributes> implements ExpenseAttributes {
  public id!: number;
  public registrationNumber!: string;
  public registrationDate!: Date;
  public expenseType!: string;
  public amount!: number;
  public description?: string;
  public relatedDocumentType?: string;
  public relatedDocumentNumber?: string;
  public paymentMethod!: string;
  public status!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Expense.init(
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
    registrationDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    expenseType: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    relatedDocumentType: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    relatedDocumentNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    paymentMethod: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'PENDING',
    },
  },
  {
    sequelize,
    tableName: 'expenses',
    timestamps: true,
  }
);

export default Expense;