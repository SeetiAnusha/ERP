import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import Client from './Client';
import AccountsReceivable from './AccountsReceivable';
import User from './User';

/**
 * Credit Card Fee Model
 * 
 * Tracks credit card processing fees charged by payment processors.
 * When customers pay via credit card, processors charge a fee (typically 2-3%).
 * This model records each fee for analysis and reporting.
 */

export enum CardType {
  VISA = 'VISA',
  MASTERCARD = 'MASTERCARD',
  AMEX = 'AMEX',
  DISCOVER = 'DISCOVER',
  OTHER = 'OTHER'
}

export enum FeeStatus {
  RECORDED = 'RECORDED',
  RECONCILED = 'RECONCILED',
  DISPUTED = 'DISPUTED'
}

interface CreditCardFeeAttributes {
  id: number;
  transactionDate: Date;
  transactionNumber: string;
  customerId?: number;
  customerName: string;
  paymentAmount: number;
  feePercentage: number;
  feeAmount: number;
  netAmount: number;
  cardType?: CardType;
  cardLastFour?: string;
  arId?: number;
  arRegistrationNumber?: string;
  status: FeeStatus;
  glEntryId?: number;
  notes?: string;
  createdBy?: number;
  
  // Deletion tracking fields
  deletion_status?: string;
  deleted_at?: Date;
  deleted_by?: number;
  deletion_reason_code?: string;
  deletion_memo?: string;
  deletion_approval_id?: number;
  
  createdAt?: Date;
  updatedAt?: Date;
}

interface CreditCardFeeCreationAttributes extends Optional<CreditCardFeeAttributes, 'id' | 'status'> {}

class CreditCardFee extends Model<CreditCardFeeAttributes, CreditCardFeeCreationAttributes> implements CreditCardFeeAttributes {
  public id!: number;
  public transactionDate!: Date;
  public transactionNumber!: string;
  public customerId?: number;
  public customerName!: string;
  public paymentAmount!: number;
  public feePercentage!: number;
  public feeAmount!: number;
  public netAmount!: number;
  public cardType?: CardType;
  public cardLastFour?: string;
  public arId?: number;
  public arRegistrationNumber?: string;
  public status!: FeeStatus;
  public glEntryId?: number;
  public notes?: string;
  public createdBy?: number;
  
  // Deletion tracking fields
  public deletion_status?: string;
  public deleted_at?: Date;
  public deleted_by?: number;
  public deletion_reason_code?: string;
  public deletion_memo?: string;
  public deletion_approval_id?: number;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public customer?: Client;
  public accountsReceivable?: AccountsReceivable;
  public creator?: User;
}

CreditCardFee.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    transactionDate: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Date when payment was processed',
    },
    transactionNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Unique transaction reference number',
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'customers',
        key: 'id',
      },
      comment: 'Customer who made the payment',
    },
    customerName: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: 'Customer name (denormalized for reporting)',
    },
    paymentAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      comment: 'Original payment amount from customer',
    },
    feePercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      comment: 'Fee percentage charged by processor (e.g., 2.5)',
    },
    feeAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      comment: 'Calculated fee amount',
    },
    netAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      comment: 'Net amount received after fee deduction',
    },
    cardType: {
      type: DataTypes.ENUM(...Object.values(CardType)),
      allowNull: true,
      comment: 'Type of credit card used',
    },
    cardLastFour: {
      type: DataTypes.STRING(4),
      allowNull: true,
      comment: 'Last 4 digits of card number',
    },
    arId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'accounts_receivable',
        key: 'id',
      },
      comment: 'Related AR transaction',
    },
    arRegistrationNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'AR registration number for reference',
    },
    status: {
      type: DataTypes.ENUM(...Object.values(FeeStatus)),
      allowNull: false,
      defaultValue: FeeStatus.RECORDED,
      comment: 'Status of fee record',
    },
    glEntryId: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'general_ledger',
        key: 'id',
      },
      comment: 'Related GL entry for accounting',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes or comments',
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'auth_users',
        key: 'id',
      },
      comment: 'User who created this record',
    },
    
    // Deletion tracking fields
    deletion_status: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
      comment: 'Deletion status: null (active), REQUESTED, APPROVED, EXECUTED',
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp when record was deleted',
    },
    deleted_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'auth_users',
        key: 'id',
      },
      comment: 'User who deleted this record',
    },
    deletion_reason_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Code indicating reason for deletion',
    },
    deletion_memo: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes about deletion',
    },
    deletion_approval_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Reference to approval record if deletion required approval',
    },
    
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'credit_card_fees',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['transaction_date'] },
      { fields: ['transaction_number'] },
      { fields: ['customer_id'] },
      { fields: ['ar_id'] },
      { fields: ['card_type'] },
      { fields: ['status'] },
      { fields: ['created_at'] },
    ],
  }
);

export default CreditCardFee;
