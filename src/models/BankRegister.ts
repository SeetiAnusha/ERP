import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';
import { TransactionType } from '../types/TransactionType';

class BankRegister extends Model {
  public id!: number;
  public registrationNumber!: string;
  public registrationDate!: Date;
  public transactionType!: 'INFLOW' | 'OUTFLOW';
  public sourceTransactionType!: TransactionType;
  public amount!: number;
  public paymentMethod!: string;
  public relatedDocumentType!: string;
  public relatedDocumentNumber!: string;
  public clientRnc!: string;
  public clientName!: string;
  public ncf?: string;
  public description!: string;
  public balance!: number;
  public bankAccountName?: string;
  public bankAccountNumber?: string;
  public referenceNumber?: string;
  
  // Bank account tracking
  public bankAccountId?: number;
  public accountType?: 'CHECKING' | 'SAVINGS';
  
  // Supplier payments and auto-numbering
  public chequeNumber?: string;
  public transferNumber?: string;
  public supplierId?: number;
  public invoiceIds?: string;
  public originalPaymentType?: string;
  
  // Soft delete and transaction reversal fields
  public deletion_status?: 'NONE' | 'REQUESTED' | 'APPROVED' | 'EXECUTED';
  public deleted_at?: Date;
  public deleted_by?: number;
  public deletion_reason_code?: string;
  public deletion_memo?: string;
  public deletion_approval_id?: number;
  public reversal_transaction_id?: number;
  public is_reversal?: boolean;
  public original_transaction_id?: number;
  
  // Timestamps (automatically added by Sequelize)
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

BankRegister.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    registrationNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: false, // Changed from true - allow duplicate registration numbers
    },
    registrationDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    transactionType: {
      type: DataTypes.ENUM('INFLOW', 'OUTFLOW'),
      allowNull: false,
    },
    sourceTransactionType: {
      type: DataTypes.ENUM('PURCHASE', 'BUSINESS_EXPENSE', 'SALE', 'PAYMENT', 'ADJUSTMENT', 'TRANSFER', 'AR_COLLECTION'),
      allowNull: true, // Changed to allow null for backward compatibility
      validate: {
        isIn: {
          args: [['PURCHASE', 'BUSINESS_EXPENSE', 'SALE', 'PAYMENT', 'ADJUSTMENT', 'TRANSFER', 'AR_COLLECTION']],
          msg: 'Source transaction type must be a valid TransactionType enum value'
        }
      }
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    paymentMethod: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    relatedDocumentType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    relatedDocumentNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    clientRnc: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    clientName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ncf: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    balance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    bankAccountName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    bankAccountNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    referenceNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Phase 3: Added for bank account tracking
    bankAccountId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'bank_accounts',
        key: 'id',
      },
    },
    // Account type from bank_accounts table
    accountType: {
      type: DataTypes.ENUM('CHECKING', 'SAVINGS'),
      allowNull: true,
    },
    // Phase 4: Added for supplier payments and auto-numbering
    chequeNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    transferNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'suppliers',
        key: 'id',
      },
    },
    invoiceIds: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    originalPaymentType: {
      type: DataTypes.STRING(50),
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
    tableName: 'bank_registers',
    timestamps: true,
  }
);

export default BankRegister;
