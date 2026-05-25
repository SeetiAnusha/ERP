import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface CashRegisterAttributes {
  id: number;
  registrationNumber: string;
  registrationDate: Date;
  transactionType: string;
  amount: number;
  paymentMethod: string;
  relatedDocumentType?: string; // ENUM values: CREDIT_CARD_SALE_COLLECTION, SHAREHOLDER_CONTRIBUTOR, FINANCIER, SHAREHOLDER_LENDER, RELATED_PARTY_LENDER, SALE, REVERSAL
  relatedDocumentNumber?: string;
  clientRnc?: string;
  clientName?: string;
  ncf?: string;
  description: string;
  balance: number;
  // Phase 3: New fields for cash register management
  cashRegisterId?: number;      // FK to cash_register_masters (REQUIRED)
  bankAccountId?: number;        // For bank deposits
  chequeNumber?: string;         // For cheque payments
  receiptNumber?: string;        // For receipt tracking
  customerId?: number;           // For AR collections (Credit Sales only)
  invoiceIds?: string;           // JSON array of invoice IDs being paid (Credit Sales only)
  investmentAgreementId?: number; // For CONTRIBUTION/LOAN transactions
  // NEW: Shareholder contribution fields
  shareholderId?: number;        // FK to financers (for SHAREHOLDER_CONTRIBUTOR)
  shareholderAmount?: number;    // Amount of shareholder contribution
  // Deposit tracking fields (for sales date vs deposit date clarity)
  sales_date?: Date;             // When money was earned
  deposit_date?: Date;           // When deposit physically happened
  deposit_reference_date?: Date; // Which day's sales this deposit is for
  is_previous_day_deposit?: boolean; // True if deposit is for previous day sales
  deposit_time?: string;         // Time of deposit
  deposited_by?: string;         // Who made the deposit
  deposit_reference_number?: string; // Bank reference number
  // Opening and closing balance for end-of-day report
  opening_balance?: number;      // Opening cash balance at start of day
  closing_balance?: number;      // Closing cash balance at end of day
  // Store information (denormalized for reporting)
  store_code?: string;           // Store/branch code
  store_name?: string;           // Store/branch name
  store_location?: string;       // Store/branch location
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

interface CashRegisterCreationAttributes extends Optional<CashRegisterAttributes, 'id'> {}

class CashRegister extends Model<CashRegisterAttributes, CashRegisterCreationAttributes> implements CashRegisterAttributes {
  public id!: number;
  public registrationNumber!: string;
  public registrationDate!: Date;
  public transactionType!: string;
  public amount!: number;
  public paymentMethod!: string;
  public relatedDocumentType?: string; // ENUM values: CREDIT_CARD_SALE_COLLECTION, SHAREHOLDER_CONTRIBUTOR, FINANCIER, SHAREHOLDER_LENDER, RELATED_PARTY_LENDER, SALE, REVERSAL
  public relatedDocumentNumber?: string;
  public clientRnc?: string;
  public clientName?: string;
  public ncf?: string;
  public description!: string;
  public balance!: number;
  // Phase 3: New fields
  public cashRegisterId?: number;
  public bankAccountId?: number;
  public chequeNumber?: string;
  public receiptNumber?: string;
  public customerId?: number;
  public invoiceIds?: string;
  public investmentAgreementId?: number;
  // NEW: Shareholder contribution fields
  public shareholderId?: number;
  public shareholderAmount?: number;
  // Deposit tracking fields
  public sales_date?: Date;
  public deposit_date?: Date;
  public deposit_reference_date?: Date;
  public is_previous_day_deposit?: boolean;
  public deposit_time?: string;
  public deposited_by?: string;
  public deposit_reference_number?: string;
  // Opening and closing balance for end-of-day report
  public opening_balance?: number;
  public closing_balance?: number;
  // Store information (denormalized for reporting)
  public store_code?: string;
  public store_name?: string;
  public store_location?: string;
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

CashRegister.init(
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
    transactionType: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    paymentMethod: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    relatedDocumentType: {
      type: DataTypes.STRING(50), // Database has ENUM but TypeScript uses STRING for flexibility
      allowNull: true,
      comment: 'Expected values: CREDIT_CARD_SALE_COLLECTION, SHAREHOLDER_CONTRIBUTOR, FINANCIER, SHAREHOLDER_LENDER, RELATED_PARTY_LENDER, SALE, REVERSAL',
    },
    relatedDocumentNumber: {
      type: DataTypes.STRING(50),
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
    ncf: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    balance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    // Phase 3: New fields
    cashRegisterId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'cash_register_masters',
        key: 'id',
      },
    },
    bankAccountId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'bank_accounts',
        key: 'id',
      },
    },
    chequeNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    receiptNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'clients',
        key: 'id',
      },
    },
    invoiceIds: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    investmentAgreementId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'investment_agreements',
        key: 'id',
      },
    },
    // NEW: Shareholder contribution fields
    shareholderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'financers',
        key: 'id',
      },
      comment: 'Foreign key to financers table (for SHAREHOLDER_CONTRIBUTOR transactions)',
    },
    shareholderAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: 'Amount of shareholder contribution',
    },
    // Deposit tracking fields
    sales_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deposit_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deposit_reference_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_previous_day_deposit: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    deposit_time: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    deposited_by: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    deposit_reference_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    // Opening and closing balance for end-of-day report
    opening_balance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    closing_balance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    // Store information (denormalized for reporting)
    store_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    store_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    store_location: {
      type: DataTypes.STRING(255),
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
    tableName: 'cash_register',
    timestamps: true,
  }
);

export default CashRegister;
