import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import Client from './Client';

interface SaleAttributes {
  id: number;
  registrationNumber: string;
  documentNumber: string;
  registrationDate: Date;
  date: Date;
  clientId: number;
  clientRnc?: string;
  ncf?: string;
  saleType: string;
  paymentType: string;
  cardPaymentNetworkId?: number; // New field for payment networks
  collectionStatus: string;  // Changed from paymentStatus
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  collectedAmount: number;  // Changed from paidAmount
  balanceAmount: number;
  status: string;
  
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

interface SaleCreationAttributes extends Optional<SaleAttributes, 'id'> {}

class Sale extends Model<SaleAttributes, SaleCreationAttributes> implements SaleAttributes {
  public id!: number;
  public registrationNumber!: string;
  public documentNumber!: string;
  public registrationDate!: Date;
  public date!: Date;
  public clientId!: number;
  public clientRnc?: string;
  public ncf?: string;
  public saleType!: string;
  public paymentType!: string;
  public cardPaymentNetworkId?: number; // New field for payment networks
  public collectionStatus!: string;  // Changed from paymentStatus
  public subtotal!: number;
  public tax!: number;
  public discount!: number;
  public total!: number;
  public collectedAmount!: number;  // Changed from paidAmount
  public balanceAmount!: number;
  public status!: string;
  
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

Sale.init(
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
    documentNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    registrationDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    clientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'clients',
        key: 'id',
      },
    },
    clientRnc: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    ncf: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    saleType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'Merchandise for sale',
    },
    paymentType: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    cardPaymentNetworkId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'card_payment_network_id',
      references: {
        model: 'card_payment_networks',
        key: 'id',
      },
    },
    collectionStatus: {  // Changed from paymentStatus
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'Not Collected',  // Changed from 'Unpaid'
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    tax: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    discount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    collectedAmount: {  // Changed from paidAmount
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    balanceAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
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
    tableName: 'sales',
    timestamps: true,
  }
);

// Associations will be set up in a separate file to avoid circular dependencies
export default Sale;
