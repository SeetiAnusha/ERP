import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import { TransactionType } from '../types/TransactionType';

interface AccountsPayableAttributes {
  id: number;
  registrationNumber: string;
  registrationDate: Date;
  type: string; // 'CREDIT_CARD_PURCHASE', 'SUPPLIER_CREDIT', etc.
  sourceTransactionType: TransactionType; // NEW FIELD
  relatedDocumentType: string; // 'Purchase', 'Invoice', etc.
  relatedDocumentId: number;
  relatedDocumentNumber: string;
  supplierId?: number;
  supplierName?: string;
  supplierRnc?: string; // Invoice supplier RNC
  cardId?: number; // Card ID for CREDIT_CARD purchases
  cardIssuer?: string; // 'Bank Name', 'Credit Card Company', etc.
  ncf?: string; // Invoice NCF
  purchaseDate?: Date; // Invoice date
  purchaseType?: string; // Invoice purchase type
  paymentType?: string; // Invoice payment type
  paymentReference?: string; // Store original payment reference to avoid duplication
  amount: number;
  paidAmount: number;
  balanceAmount: number;
  status: string; // 'Pending', 'Partial', 'Paid'
  dueDate?: Date;
  paidDate?: Date;
  notes?: string;
  
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

interface AccountsPayableCreationAttributes extends Optional<AccountsPayableAttributes, 'id'> {}

class AccountsPayable extends Model<AccountsPayableAttributes, AccountsPayableCreationAttributes> implements AccountsPayableAttributes {
  public id!: number;
  public registrationNumber!: string;
  public registrationDate!: Date;
  public type!: string;
  public sourceTransactionType!: TransactionType; // NEW FIELD
  public relatedDocumentType!: string;
  public relatedDocumentId!: number;
  public relatedDocumentNumber!: string;
  public supplierId?: number;
  public supplierName?: string;
  public supplierRnc?: string;
  public cardId?: number;
  public cardIssuer?: string;
  public ncf?: string;
  public purchaseDate?: Date;
  public purchaseType?: string;
  public paymentType?: string;
  public paymentReference?: string;
  public amount!: number;
  public paidAmount!: number;
  public balanceAmount!: number;
  public status!: string;
  public dueDate?: Date;
  public paidDate?: Date;
  public notes?: string;
  
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
      unique: false, // Changed from true - allow duplicate registration numbers (e.g., CP#### for main purchase and invoices)
    },
    registrationDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    sourceTransactionType: {
      type: DataTypes.ENUM('PURCHASE', 'BUSINESS_EXPENSE', 'SALE', 'PAYMENT', 'ADJUSTMENT', 'TRANSFER'),
      allowNull: false,
      validate: {
        isIn: {
          args: [['PURCHASE', 'BUSINESS_EXPENSE', 'SALE', 'PAYMENT', 'ADJUSTMENT', 'TRANSFER']],
          msg: 'Source transaction type must be a valid TransactionType enum value'
        }
      }
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
    cardId: {
      type: DataTypes.INTEGER,
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
    paymentReference: {
      type: DataTypes.STRING(100),
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
    tableName: 'accounts_payable',
    timestamps: true,
  }
);

export default AccountsPayable;
