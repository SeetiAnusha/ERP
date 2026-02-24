import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface AccountsPayableAttributes {
  id: number;
  registrationNumber: string;
  registrationDate: Date;
  type: string; // 'CREDIT_CARD_PURCHASE', 'SUPPLIER_CREDIT', etc.
  relatedDocumentType: string; // 'Purchase', 'Invoice', etc.
  relatedDocumentId: number;
  relatedDocumentNumber: string;
  supplierId?: number;
  supplierName?: string;
  supplierRnc?: string; // Invoice supplier RNC
  cardIssuer?: string; // 'Bank Name', 'Credit Card Company', etc.
  ncf?: string; // Invoice NCF
  purchaseDate?: Date; // Invoice date
  purchaseType?: string; // Invoice purchase type
  paymentType?: string; // Invoice payment type
  amount: number;
  paidAmount: number;
  balanceAmount: number;
  status: string; // 'Pending', 'Partial', 'Paid'
  dueDate?: Date;
  paidDate?: Date;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AccountsPayableCreationAttributes extends Optional<AccountsPayableAttributes, 'id'> {}

class AccountsPayable extends Model<AccountsPayableAttributes, AccountsPayableCreationAttributes> implements AccountsPayableAttributes {
  public id!: number;
  public registrationNumber!: string;
  public registrationDate!: Date;
  public type!: string;
  public relatedDocumentType!: string;
  public relatedDocumentId!: number;
  public relatedDocumentNumber!: string;
  public supplierId?: number;
  public supplierName?: string;
  public supplierRnc?: string;
  public cardIssuer?: string;
  public ncf?: string;
  public purchaseDate?: Date;
  public purchaseType?: string;
  public paymentType?: string;
  public amount!: number;
  public paidAmount!: number;
  public balanceAmount!: number;
  public status!: string;
  public dueDate?: Date;
  public paidDate?: Date;
  public notes?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AccountsPayable.init(
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
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    relatedDocumentType: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    relatedDocumentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    relatedDocumentNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    supplierName: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    supplierRnc: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    cardIssuer: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    ncf: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    purchaseDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    purchaseType: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    paymentType: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
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
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'Pending',
    },
    dueDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    paidDate: {
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
    tableName: 'accounts_payable',
    timestamps: true,
  }
);

export default AccountsPayable;
