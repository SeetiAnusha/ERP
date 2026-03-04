import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class BankRegister extends Model {
  public id!: number;
  public registrationNumber!: string;
  public registrationDate!: Date;
  public transactionType!: 'INFLOW' | 'OUTFLOW';
  public amount!: number;
  public paymentMethod!: string; // 'Bank Transfer', 'Deposit'
  public relatedDocumentType!: string; // 'Purchase', 'Sale', 'Payment'
  public relatedDocumentNumber!: string;
  public clientRnc!: string;
  public clientName!: string;
  public ncf?: string;
  public description!: string;
  public balance!: number;
  public bankAccountName?: string;
  public bankAccountNumber?: string;
  public referenceNumber?: string;
  // Phase 3: Added for bank account tracking
  public bankAccountId?: number;
  // Phase 4: Added for supplier payments and auto-numbering
  public chequeNumber?: string;      // Auto-generated: CK0001, CK0002...
  public transferNumber?: string;    // Auto-generated: TF0001, TF0002...
  public supplierId?: number;        // For supplier payments
  public invoiceIds?: string;        // JSON array of AP invoice IDs
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
  },
  {
    sequelize,
    tableName: 'bank_registers',
    timestamps: true,
  }
);

export default BankRegister;
