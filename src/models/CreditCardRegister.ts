import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface CreditCardRegisterAttributes {
  id: number;
  registrationNumber: string;
  registrationDate: Date;
  transactionType: 'CHARGE' | 'REFUND' | 'ADJUSTMENT';
  sourceTransactionType: string;
  amount: number;
  paymentMethod: string;
  relatedDocumentType: string;
  relatedDocumentId?: number;
  relatedDocumentNumber: string;
  clientName?: string;
  clientRnc?: string;
  supplierName?: string;
  supplierRnc?: string;
  ncf?: string;
  description: string;
  cardId: number;
  cardIssuer?: string;
  cardBrand?: string;
  cardNumberLast4?: string;
  authorizationCode?: string;
  merchantId?: string;
  terminalId?: string;
  batchNumber?: string;
  referenceNumber?: string;
  notes?: string;
  balance: number;
  availableCredit: number;
  usedCredit: number;
  
  // Legacy status column (not used)
  status?: string;
  
  // Soft delete columns
  deletion_status?: string;
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

interface CreditCardRegisterCreationAttributes extends Optional<CreditCardRegisterAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class CreditCardRegister extends Model<CreditCardRegisterAttributes, CreditCardRegisterCreationAttributes> implements CreditCardRegisterAttributes {
  public id!: number;
  public registrationNumber!: string;
  public registrationDate!: Date;
  public transactionType!: 'CHARGE' | 'REFUND' | 'ADJUSTMENT';
  public sourceTransactionType!: string;
  public amount!: number;
  public paymentMethod!: string;
  public relatedDocumentType!: string;
  public relatedDocumentId?: number;
  public relatedDocumentNumber!: string;
  public clientName?: string;
  public clientRnc?: string;
  public supplierName?: string;
  public supplierRnc?: string;
  public ncf?: string;
  public description!: string;
  public cardId!: number;
  public cardIssuer?: string;
  public cardBrand?: string;
  public cardNumberLast4?: string;
  public authorizationCode?: string;
  public merchantId?: string;
  public terminalId?: string;
  public batchNumber?: string;
  public referenceNumber?: string;
  public notes?: string;
  public balance!: number;
  public availableCredit!: number;
  public usedCredit!: number;
  
  // Legacy status column (not used)
  public status?: string;
  
  // Soft delete columns
  public deletion_status?: string;
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

CreditCardRegister.init(
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
      field: 'registration_number',
    },
    registrationDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'registration_date',
    },
    transactionType: {
      type: DataTypes.ENUM('CHARGE', 'REFUND', 'ADJUSTMENT'),
      allowNull: false,
      field: 'transaction_type',
    },
    sourceTransactionType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'source_transaction_type',
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    paymentMethod: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'CREDIT_CARD',
      field: 'payment_method',
    },
    relatedDocumentType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'related_document_type',
    },
    relatedDocumentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'related_document_id',
    },
    relatedDocumentNumber: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'related_document_number',
    },
    clientName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'client_name',
    },
    clientRnc: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'client_rnc',
    },
    supplierName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'supplier_name',
    },
    supplierRnc: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'supplier_rnc',
    },
    ncf: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    cardId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'card_id',
    },
    cardIssuer: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'card_issuer',
    },
    cardBrand: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'card_brand',
    },
    cardNumberLast4: {
      type: DataTypes.STRING(4),
      allowNull: true,
      field: 'card_number_last4',
    },
    authorizationCode: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'authorization_code',
    },
    merchantId: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'merchant_id',
    },
    terminalId: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'terminal_id',
    },
    batchNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'batch_number',
    },
    referenceNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'reference_number',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    balance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    availableCredit: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'available_credit',
    },
    usedCredit: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'used_credit',
    },
    
    // Legacy status column (not used, kept for backward compatibility)
    status: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'status',
    },
    
    // Soft delete columns
    deletion_status: {
      type: DataTypes.STRING(20),
      allowNull: true,
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
      allowNull: true,
      defaultValue: false,
    },
    original_transaction_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'credit_card_registers',
    timestamps: true,
    indexes: [
      {
        fields: ['registration_number'],
        unique: true,
      },
      {
        fields: ['card_id'],
      },
      {
        fields: ['registration_date'],
      },
      {
        fields: ['related_document_number'],
      },
      {
        fields: ['transaction_type'],
      },
      {
        fields: ['deletion_status'],
      },
    ],
  }
);

export default CreditCardRegister;