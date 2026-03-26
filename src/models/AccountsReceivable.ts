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
  expectedBankDeposit: number; // New field for expected bank deposit
  actualBankDeposit?: number; // New field for actual amount deposited to bank
  bankAccountId?: number; // Which bank account received the deposit
  status: string; // 'Pending', 'Partial', 'Received'
  dueDate?: Date;
  receivedDate?: Date;
  notes?: string;
  // New fields for collection details
  collectionDate?: Date;
  transferReference?: string;
  collectionNotes?: string;
  
  // Soft delete attributes
  deletion_status?: 'NONE' | 'REQUESTED' | 'APPROVED' | 'EXECUTED';
  deleted_at?: Date;
  deleted_by?: number;
  deletion_reason_code?: string;
  deletion_memo?: string;
  deletion_approval_id?: number;
  reversal_transaction_id?: number;
  is_reversal?: boolean;
  original_transaction_id?: number;
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
  public expectedBankDeposit!: number; // New field for expected bank deposit
  public actualBankDeposit?: number; // New field for actual amount deposited to bank
  public bankAccountId?: number; // Which bank account received the deposit
  public status!: string;
  public dueDate?: Date;
  public receivedDate?: Date;
  public notes?: string;
  // New fields for collection details
  public collectionDate?: Date;
  public transferReference?: string;
  public collectionNotes?: string;
  
  // Soft delete attributes
  public deletion_status?: 'NONE' | 'REQUESTED' | 'APPROVED' | 'EXECUTED';
  public deleted_at?: Date;
  public deleted_by?: number;
  public deletion_reason_code?: string;
  public deletion_memo?: string;
  public deletion_approval_id?: number;
  public reversal_transaction_id?: number;
  public is_reversal?: boolean;
  public original_transaction_id?: number;
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
    expectedBankDeposit: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    actualBankDeposit: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    bankAccountId: {
      type: DataTypes.INTEGER,
      allowNull: true,
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
    // New fields for collection details
    collectionDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    transferReference: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    collectionNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  
    // Soft delete attributes
    deletion_status: {
      type: DataTypes.ENUM('NONE', 'REQUESTED', 'APPROVED', 'EXECUTED'),
      defaultValue: 'NONE',
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deleted_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    deletion_reason_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    deletion_memo: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    deletion_approval_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    reversal_transaction_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    is_reversal: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    original_transaction_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },},
  {
    sequelize,
    tableName: 'accounts_receivable',
    timestamps: true,
  }
);

export default AccountsReceivable;
