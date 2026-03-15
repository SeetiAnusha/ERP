import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface CreditBalanceAttributes {
  id: number;
  registrationNumber: string;
  registrationDate: Date;
  type: 'CUSTOMER_CREDIT' | 'SUPPLIER_CREDIT'; // AR overpayment or AP overpayment
  relatedEntityType: 'CLIENT' | 'SUPPLIER'; // Who has the credit
  relatedEntityId: number; // Client ID or Supplier ID
  relatedEntityName: string; // Client name or Supplier name
  originalTransactionType: 'AR' | 'AP'; // Original transaction that created the credit
  originalTransactionId: number; // Original AR or AP ID
  originalTransactionNumber: string; // Original AR or AP registration number
  creditAmount: number; // Total credit amount created
  usedAmount: number; // Amount of credit already used
  availableAmount: number; // Remaining credit available
  status: 'ACTIVE' | 'FULLY_USED' | 'EXPIRED'; // Credit status
  expiryDate?: Date; // Optional credit expiry
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface CreditBalanceCreationAttributes extends Optional<CreditBalanceAttributes, 'id'> {}

class CreditBalance extends Model<CreditBalanceAttributes, CreditBalanceCreationAttributes> implements CreditBalanceAttributes {
  public id!: number;
  public registrationNumber!: string;
  public registrationDate!: Date;
  public type!: 'CUSTOMER_CREDIT' | 'SUPPLIER_CREDIT';
  public relatedEntityType!: 'CLIENT' | 'SUPPLIER';
  public relatedEntityId!: number;
  public relatedEntityName!: string;
  public originalTransactionType!: 'AR' | 'AP';
  public originalTransactionId!: number;
  public originalTransactionNumber!: string;
  public creditAmount!: number;
  public usedAmount!: number;
  public availableAmount!: number;
  public status!: 'ACTIVE' | 'FULLY_USED' | 'EXPIRED';
  public expiryDate?: Date;
  public notes?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CreditBalance.init(
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
    type: {
      type: DataTypes.ENUM('CUSTOMER_CREDIT', 'SUPPLIER_CREDIT'),
      allowNull: false,
    },
    relatedEntityType: {
      type: DataTypes.ENUM('CLIENT', 'SUPPLIER'),
      allowNull: false,
    },
    relatedEntityId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    relatedEntityName: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    originalTransactionType: {
      type: DataTypes.ENUM('AR', 'AP'),
      allowNull: false,
    },
    originalTransactionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    originalTransactionNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    creditAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    usedAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    availableAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'FULLY_USED', 'EXPIRED'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    expiryDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'credit_balances',
    timestamps: true,
  }
);

export default CreditBalance;