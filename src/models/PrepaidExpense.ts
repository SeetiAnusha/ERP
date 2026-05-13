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
  registrationNumber?: string;
  date?: Date;
  expenseCategoryId?: number;
  amortizationPeriod?: string;
  // Payment fields
  paymentType?: string;
  bankAccountId?: number;
  cardId?: number;
  chequeNumber?: string;
  chequeDate?: Date;
  transferNumber?: string;
  transferDate?: Date;
  paymentReference?: string;
  voucherDate?: Date;
  supplierRnc?: string;
  ncf?: string;
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
  public registrationNumber?: string;
  public date?: Date;
  public expenseCategoryId?: number;
  public amortizationPeriod?: string;
  // Payment fields
  public paymentType?: string;
  public bankAccountId?: number;
  public cardId?: number;
  public chequeNumber?: string;
  public chequeDate?: Date;
  public transferNumber?: string;
  public transferDate?: Date;
  public paymentReference?: string;
  public voucherDate?: Date;
  public supplierRnc?: string;
  public ncf?: string;
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
      field: 'start_date', // Map to database column
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'end_date', // Map to database column
    },
    totalAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      field: 'total_amount', // Map to database column
    },
    amortizedAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'amortized_amount', // Map to database column
    },
    remainingAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      field: 'remaining_amount', // Map to database column
    },
    monthlyAmortization: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      field: 'monthly_amortization', // Map to database column
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'supplier_id', // Map to database column
    },
    registrationNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'registration_number',
    },
    date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expenseCategoryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'expense_category_id',
    },
    amortizationPeriod: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'amortization_period',
    },
    // Payment fields
    paymentType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'payment_type',
    },
    bankAccountId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'bank_account_id',
    },
    cardId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'card_id',
    },
    chequeNumber: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'cheque_number',
    },
    chequeDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'cheque_date',
    },
    transferNumber: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'transfer_number',
    },
    transferDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'transfer_date',
    },
    paymentReference: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'payment_reference',
    },
    voucherDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'voucher_date',
    },
    supplierRnc: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'supplier_rnc',
    },
    ncf: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'prepaid_expenses',
    timestamps: true,
    underscored: true, // This converts createdAt -> created_at, updatedAt -> updated_at
  }
);

export default PrepaidExpense;
