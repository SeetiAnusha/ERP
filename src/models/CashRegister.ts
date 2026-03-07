import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface CashRegisterAttributes {
  id: number;
  registrationNumber: string;
  registrationDate: Date;
  transactionType: string;
  amount: number;
  paymentMethod: string;
  relatedDocumentType?: string;
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
  public relatedDocumentType?: string;
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
      type: DataTypes.STRING(50),
      allowNull: true,
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
  },
  {
    sequelize,
    tableName: 'cash_register',
    timestamps: true,
  }
);

export default CashRegister;
