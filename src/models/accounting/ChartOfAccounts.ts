import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../config/database';

/**
 * Chart of Accounts Model
 * 
 * Defines the GL account structure for double-entry accounting.
 * Follows standard accounting hierarchy: Assets, Liabilities, Equity, Revenue, Expenses
 */

export enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE'
}

export enum AccountSubType {
  // Assets
  CURRENT_ASSET = 'CURRENT_ASSET',
  FIXED_ASSET = 'FIXED_ASSET',
  INVENTORY = 'INVENTORY',
  ACCOUNTS_RECEIVABLE = 'ACCOUNTS_RECEIVABLE',
  CASH = 'CASH',
  BANK = 'BANK',
  
  // Liabilities
  CURRENT_LIABILITY = 'CURRENT_LIABILITY',
  LONG_TERM_LIABILITY = 'LONG_TERM_LIABILITY',
  ACCOUNTS_PAYABLE = 'ACCOUNTS_PAYABLE',
  CREDIT_CARD = 'CREDIT_CARD',
  
  // Equity
  CAPITAL = 'CAPITAL',
  RETAINED_EARNINGS = 'RETAINED_EARNINGS',
  DRAWINGS = 'DRAWINGS',
  
  // Revenue
  SALES_REVENUE = 'SALES_REVENUE',
  SERVICE_REVENUE = 'SERVICE_REVENUE',
  OTHER_INCOME = 'OTHER_INCOME',
  
  // Expenses
  COST_OF_GOODS_SOLD = 'COST_OF_GOODS_SOLD',
  OPERATING_EXPENSE = 'OPERATING_EXPENSE',
  ADMINISTRATIVE_EXPENSE = 'ADMINISTRATIVE_EXPENSE',
  FINANCIAL_EXPENSE = 'FINANCIAL_EXPENSE'
}

interface ChartOfAccountsAttributes {
  id: number;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  accountSubType: AccountSubType;
  parentAccountId?: number;
  level: number;
  isActive: boolean;
  isSystemAccount: boolean;
  normalBalance: 'DEBIT' | 'CREDIT';
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ChartOfAccountsCreationAttributes extends Optional<ChartOfAccountsAttributes, 'id'> {}

class ChartOfAccounts extends Model<ChartOfAccountsAttributes, ChartOfAccountsCreationAttributes> implements ChartOfAccountsAttributes {
  public id!: number;
  public accountCode!: string;
  public accountName!: string;
  public accountType!: AccountType;
  public accountSubType!: AccountSubType;
  public parentAccountId?: number;
  public level!: number;
  public isActive!: boolean;
  public isSystemAccount!: boolean;
  public normalBalance!: 'DEBIT' | 'CREDIT';
  public description?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ChartOfAccounts.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    accountCode: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      comment: 'Unique account code (e.g., 1000, 1100, 2000)',
    },
    accountName: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: 'Account name (e.g., Cash, Accounts Receivable)',
    },
    accountType: {
      type: DataTypes.ENUM(...Object.values(AccountType)),
      allowNull: false,
      comment: 'Main account category',
    },
    accountSubType: {
      type: DataTypes.ENUM(...Object.values(AccountSubType)),
      allowNull: false,
      comment: 'Detailed account classification',
    },
    parentAccountId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'chart_of_accounts',
        key: 'id',
      },
      comment: 'Parent account for hierarchical structure',
    },
    level: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: 'Hierarchy level (1 = top level, 2 = sub-account, etc.)',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether account is active for transactions',
    },
    isSystemAccount: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'System accounts cannot be deleted',
    },
    normalBalance: {
      type: DataTypes.ENUM('DEBIT', 'CREDIT'),
      allowNull: false,
      comment: 'Normal balance side for this account type',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Account description and usage notes',
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
    tableName: 'chart_of_accounts',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['account_code'], unique: true },
      { fields: ['account_type'] },
      { fields: ['account_sub_type'] },
      { fields: ['parent_account_id'] },
      { fields: ['is_active'] },
    ],
  }
);

export default ChartOfAccounts;
