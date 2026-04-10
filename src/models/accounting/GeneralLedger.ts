import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../config/database';
import ChartOfAccounts from './ChartOfAccounts';
import User from '../User';

/**
 * General Ledger Model
 * 
 * Core double-entry accounting table.
 * Every transaction creates at least 2 GL entries (debit and credit).
 * Maintains the accounting equation: Assets = Liabilities + Equity
 */

export enum EntryType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT'
}

export enum SourceModule {
  PURCHASE = 'PURCHASE',
  SALE = 'SALE',
  ACCOUNTS_PAYABLE = 'ACCOUNTS_PAYABLE',
  ACCOUNTS_RECEIVABLE = 'ACCOUNTS_RECEIVABLE',
  BANK_REGISTER = 'BANK_REGISTER',
  CASH_REGISTER = 'CASH_REGISTER',
  BUSINESS_EXPENSE = 'BUSINESS_EXPENSE',
  PAYMENT = 'PAYMENT',
  ADJUSTMENT = 'ADJUSTMENT',
  MANUAL_JOURNAL = 'MANUAL_JOURNAL',
  OPENING_BALANCE = 'OPENING_BALANCE',
  CLOSING = 'CLOSING'
}

interface GeneralLedgerAttributes {
  id: number;
  entryNumber: string;
  entryDate: Date;
  accountId: number;
  entryType: EntryType;
  amount: number;
  sourceModule: SourceModule;
  sourceTransactionId: number;
  sourceTransactionNumber: string;
  description: string;
  fiscalPeriodId?: number;
  isPosted: boolean;
  postedAt?: Date;
  postedBy?: number;
  isReversed: boolean;
  reversalEntryId?: number;
  originalEntryId?: number;
  isOpeningBalance: boolean;
  createdBy?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface GeneralLedgerCreationAttributes extends Optional<GeneralLedgerAttributes, 'id' | 'isOpeningBalance'> {}

class GeneralLedger extends Model<GeneralLedgerAttributes, GeneralLedgerCreationAttributes> implements GeneralLedgerAttributes {
  public id!: number;
  public entryNumber!: string;
  public entryDate!: Date;
  public accountId!: number;
  public entryType!: EntryType;
  public amount!: number;
  public sourceModule!: SourceModule;
  public sourceTransactionId!: number;
  public sourceTransactionNumber!: string;
  public description!: string;
  public fiscalPeriodId?: number;
  public isPosted!: boolean;
  public postedAt?: Date;
  public postedBy?: number;
  public isReversed!: boolean;
  public reversalEntryId?: number;
  public originalEntryId?: number;
  public isOpeningBalance!: boolean;
  public createdBy?: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public account?: ChartOfAccounts;
  public ChartOfAccount?: ChartOfAccounts;
  public creator?: User;
  public poster?: User;
}

GeneralLedger.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    entryNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'GL entry number (e.g., JE-2024-0001)',
    },
    entryDate: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Transaction date',
    },
    accountId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'chart_of_accounts',
        key: 'id',
      },
      comment: 'GL account being debited or credited',
    },
    entryType: {
      type: DataTypes.ENUM(...Object.values(EntryType)),
      allowNull: false,
      comment: 'DEBIT or CREDIT',
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      comment: 'Transaction amount (always positive)',
    },
    sourceModule: {
      type: DataTypes.ENUM(...Object.values(SourceModule)),
      allowNull: false,
      comment: 'Module that created this entry',
    },
    sourceTransactionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'ID of source transaction',
    },
    sourceTransactionNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Registration number of source transaction',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Entry description',
    },
    fiscalPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'fiscal_periods',
        key: 'id',
      },
      comment: 'Fiscal period for this entry',
    },
    isPosted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether entry is posted to GL',
    },
    postedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When entry was posted',
    },
    postedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'auth_users',
        key: 'id',
      },
      comment: 'User who posted the entry',
    },
    isReversed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether entry has been reversed',
    },
    reversalEntryId: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'ID of reversal entry if reversed',
    },
    originalEntryId: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'ID of original entry if this is a reversal',
    },
    isOpeningBalance: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Flag indicating if this entry is an opening balance entry',
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'auth_users',
        key: 'id',
      },
      comment: 'User who created the entry',
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
    tableName: 'general_ledger',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['entry_number'] },
      { fields: ['entry_date'] },
      { fields: ['account_id'] },
      { fields: ['entry_type'] },
      { fields: ['source_module'] },
      { fields: ['source_transaction_id'] },
      { fields: ['source_transaction_number'] },
      { fields: ['fiscal_period_id'] },
      { fields: ['is_posted'] },
      { fields: ['is_reversed'] },
      { fields: ['is_opening_balance'] },
      { fields: ['created_at'] },
    ],
  }
);

export default GeneralLedger;
