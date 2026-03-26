import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface PaymentAttributes {
  id: number;
  registrationNumber: string;
  registrationDate: Date;
  paymentMethod: string;
  paymentAmount: number;
  type: string;
  relatedEntityType: string;
  relatedEntityId: number;
  supplierRnc?: string;
  supplierName?: string;
  clientRnc?: string;
  clientName?: string;
  outstandingCreditInvoices?: string;
  outstandingCashInvoices?: string;
  invoiceApplications?: string; // JSON string of invoice applications
  excessAmount?: number; // Amount exceeding invoice totals (creates credit)
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

interface PaymentCreationAttributes extends Optional<PaymentAttributes, 'id'> {}

class Payment extends Model<PaymentAttributes, PaymentCreationAttributes> implements PaymentAttributes {
  public id!: number;
  public registrationNumber!: string;
  public registrationDate!: Date;
  public paymentMethod!: string;
  public paymentAmount!: number;
  public type!: string;
  public relatedEntityType!: string;
  public relatedEntityId!: number;
  public supplierRnc?: string;
  public supplierName?: string;
  public clientRnc?: string;
  public clientName?: string;
  public outstandingCreditInvoices?: string;
  public outstandingCashInvoices?: string;
  public invoiceApplications?: string;
  public excessAmount?: number;
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

  // Associations
  public applications?: any[];
}

Payment.init(
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
    paymentMethod: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    paymentAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    relatedEntityType: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    relatedEntityId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    supplierRnc: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    supplierName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    clientRnc: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    clientName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    outstandingCreditInvoices: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    outstandingCashInvoices: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    invoiceApplications: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    excessAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0,
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
    },
  },
  {
    sequelize,
    tableName: 'payments',
    timestamps: true,
  }
);

export default Payment;
