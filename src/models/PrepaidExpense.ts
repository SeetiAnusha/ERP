import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface PrepaidExpenseAttributes {
  id: number;
  code: string;
  name: string;
  type: string;
  description: string;
  startDate: Date;
  endDate: Date;
  totalAmount: number;
  amortizedAmount: number;
  remainingAmount: number;
  monthlyAmortization: number;
  status: string;
  supplierId?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PrepaidExpenseCreationAttributes extends Optional<PrepaidExpenseAttributes, 'id'> {}

class PrepaidExpense extends Model<PrepaidExpenseAttributes, PrepaidExpenseCreationAttributes> implements PrepaidExpenseAttributes {
  public id!: number;
  public code!: string;
  public name!: string;
  public type!: string;
  public description!: string;
  public startDate!: Date;
  public endDate!: Date;
  public totalAmount!: number;
  public amortizedAmount!: number;
  public remainingAmount!: number;
  public monthlyAmortization!: number;
  public status!: string;
  public supplierId?: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PrepaidExpense.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    totalAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    amortizedAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    remainingAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    monthlyAmortization: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'prepaid_expenses',
    timestamps: true,
  }
);

export default PrepaidExpense;
