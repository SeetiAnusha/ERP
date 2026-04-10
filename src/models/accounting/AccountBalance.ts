import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../config/database';
import ChartOfAccounts from './ChartOfAccounts';

/**
 * Account Balance Model
 * 
 * Maintains running balances for each GL account.
 * Updated automatically when GL entries are posted.
 * Enables fast balance queries without summing all GL entries.
 */

interface AccountBalanceAttributes {
  id: number;
  accountId: number;
  fiscalPeriodId?: number;
  openingBalance: number;
  debitTotal: number;
  creditTotal: number;
  closingBalance: number;
  lastUpdated: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AccountBalanceCreationAttributes extends Optional<AccountBalanceAttributes, 'id'> {}

class AccountBalance extends Model<AccountBalanceAttributes, AccountBalanceCreationAttributes> implements AccountBalanceAttributes {
  public id!: number;
  public accountId!: number;
  public fiscalPeriodId?: number;
  public openingBalance!: number;
  public debitTotal!: number;
  public creditTotal!: number;
  public closingBalance!: number;
  public lastUpdated!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public account?: ChartOfAccounts;
}

AccountBalance.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    accountId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'chart_of_accounts',
        key: 'id',
      },
      comment: 'GL account',
    },
    fiscalPeriodId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'fiscal_periods',
        key: 'id',
      },
      comment: 'Fiscal period (null = current period)',
    },
    openingBalance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Opening balance for period',
    },
    debitTotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Total debits in period',
    },
    creditTotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Total credits in period',
    },
    closingBalance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Closing balance (opening + debits - credits for debit accounts)',
    },
    lastUpdated: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Last balance update timestamp',
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
    tableName: 'account_balances',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['account_id', 'fiscal_period_id'], unique: true },
      { fields: ['fiscal_period_id'] },
      { fields: ['last_updated'] },
    ],
  }
);

export default AccountBalance;
