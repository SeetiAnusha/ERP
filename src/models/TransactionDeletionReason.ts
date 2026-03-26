import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface TransactionDeletionReasonAttributes {
  id: number;
  reason_code: string;
  reason_name: string;
  requires_memo: boolean;
  is_standard: boolean;
  is_active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface TransactionDeletionReasonCreationAttributes extends Optional<TransactionDeletionReasonAttributes, 'id'> {}

class TransactionDeletionReason extends Model<TransactionDeletionReasonAttributes, TransactionDeletionReasonCreationAttributes> implements TransactionDeletionReasonAttributes {
  public id!: number;
  public reason_code!: string;
  public reason_name!: string;
  public requires_memo!: boolean;
  public is_standard!: boolean;
  public is_active!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

TransactionDeletionReason.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    reason_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    reason_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    requires_memo: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_standard: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'TransactionDeletionReason',
    tableName: 'transaction_deletion_reasons',
    timestamps: true,
    underscored: true,
  }
);

export default TransactionDeletionReason;