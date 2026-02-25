import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface AccountsReceivableAttributes {
  id: number;
  registrationNumber: string;
  registrationDate: Date;
  type: string; // 'CREDIT_CARD_SALE', 'CLIENT_CREDIT', etc.
  relatedDocumentType: string; // 'Sale', 'Invoice', etc.
  relatedDocumentId: number;
  relatedDocumentNumber: string;
  clientId?: number;
  clientName?: string;
  clientRnc?: string;
  ncf?: string;
  saleOf?: string;
  cardNetwork?: string; // 'Visa', 'Mastercard', 'Amex', etc.
  amount: number;
  receivedAmount: number;
  balanceAmount: number;
  status: string; // 'Pending', 'Partial', 'Received'
  dueDate?: Date;
  receivedDate?: Date;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AccountsReceivableCreationAttributes extends Optional<AccountsReceivableAttributes, 'id'> {}

class AccountsReceivable extends Model<AccountsReceivableAttributes, AccountsReceivableCreationAttributes> implements AccountsReceivableAttributes {
  public id!: number;
  public registrationNumber!: string;
  public registrationDate!: Date;
  public type!: string;
  public relatedDocumentType!: string;
  public relatedDocumentId!: number;
  public relatedDocumentNumber!: string;
  public clientId?: number;
  public clientName?: string;
  public clientRnc?: string;
  public ncf?: string;
  public saleOf?: string;
  public cardNetwork?: string;
  public amount!: number;
  public receivedAmount!: number;
  public balanceAmount!: number;
  public status!: string;
  public dueDate?: Date;
  public receivedDate?: Date;
  public notes?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AccountsReceivable.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    registrationNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: false, // Changed from true - allow duplicate registration numbers
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
    clientId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    clientName: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    clientRnc: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    ncf: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    saleOf: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cardNetwork: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    receivedAmount: {
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
    receivedDate: {
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
    tableName: 'accounts_receivable',
    timestamps: true,
  }
);

export default AccountsReceivable;
