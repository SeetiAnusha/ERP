import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class BankAccount extends Model {
  public id!: number;
  public code!: string;
  public bankName!: string;
  public accountNumber!: string;
  public accountType!: 'CHECKING' | 'SAVINGS';
  public balance!: number;
  public status!: 'ACTIVE' | 'INACTIVE';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

BankAccount.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    bankName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    accountNumber: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        is: {
          args: /^\d{4}$/,
          msg: 'Account number must be exactly 4 digits (last 4 digits of your account)'
        },
        len: {
          args: [4, 4],
          msg: 'Account number must be exactly 4 digits'
        }
      }
    },
    accountType: {
      type: DataTypes.ENUM('CHECKING', 'SAVINGS'),
      allowNull: false,
    },
    balance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
  },
  {
    sequelize,
    tableName: 'bank_accounts',
    timestamps: true,
  }
);

export default BankAccount;
