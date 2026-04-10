import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../config/database';

/**
 * Account Classification Model
 * 
 * Maps accounts to cash flow activity types and identifies special account characteristics.
 * Used for Cash Flow Statement generation and financial reporting.
 */

export enum ActivityType {
  OPERATING = 'OPERATING',
  INVESTING = 'INVESTING',
  FINANCING = 'FINANCING'
}

interface AccountClassificationAttributes {
  id: number;
  accountId: number;
  activityType: ActivityType;
  isCashAccount: boolean;
  isNonCashItem: boolean;
  isWorkingCapital: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AccountClassificationCreationAttributes extends Optional<AccountClassificationAttributes, 'id' | 'isCashAccount' | 'isNonCashItem' | 'isWorkingCapital'> {}

class AccountClassification extends Model<AccountClassificationAttributes, AccountClassificationCreationAttributes> implements AccountClassificationAttributes {
  public id!: number;
  public accountId!: number;
  public activityType!: ActivityType;
  public isCashAccount!: boolean;
  public isNonCashItem!: boolean;
  public isWorkingCapital!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  
  // Association
  public readonly account?: any;
}

AccountClassification.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    accountId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: 'chart_of_accounts',
        key: 'id',
      },
      comment: 'Foreign key to chart_of_accounts table',
    },
    activityType: {
      type: DataTypes.ENUM(...Object.values(ActivityType)),
      allowNull: false,
      validate: {
        isIn: {
          args: [Object.values(ActivityType)],
          msg: 'Activity type must be OPERATING, INVESTING, or FINANCING',
        },
      },
      comment: 'Cash flow activity classification',
    },
    isCashAccount: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Indicates if this is a cash or bank account',
    },
    isNonCashItem: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Indicates if this represents a non-cash expense/income (e.g., depreciation)',
    },
    isWorkingCapital: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Indicates if this is a working capital account (AR, Inventory, AP)',
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
    tableName: 'account_classification',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['account_id'], unique: true },
      { fields: ['activity_type'] },
      { fields: ['is_cash_account'] },
    ],
  }
);

export default AccountClassification;
