import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import User from './User';
import ApprovalRequest from './ApprovalRequest';

interface TransactionAuditTrailAttributes {
  id: number;
  audit_hash: string;
  previous_hash?: string;
  entity_type: string;
  entity_id: number;
  action_type: string;
  action_data: any;
  user_id: number;
  ip_address?: string;
  user_agent?: string;
  approval_id?: number;
  createdAt?: Date;
}

interface TransactionAuditTrailCreationAttributes extends Optional<TransactionAuditTrailAttributes, 'id'> {}

class TransactionAuditTrail extends Model<TransactionAuditTrailAttributes, TransactionAuditTrailCreationAttributes> implements TransactionAuditTrailAttributes {
  public id!: number;
  public audit_hash!: string;
  public previous_hash?: string;
  public entity_type!: string;
  public entity_id!: number;
  public action_type!: string;
  public action_data!: any;
  public user_id!: number;
  public ip_address?: string;
  public user_agent?: string;
  public approval_id?: number;
  public readonly createdAt!: Date;

  // Associations
  public user?: any;
  public approval?: any;
}

TransactionAuditTrail.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    audit_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    previous_hash: {
      type: DataTypes.STRING(64),
    },
    entity_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    entity_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    action_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    action_data: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    ip_address: {
      type: DataTypes.STRING(45),
    },
    user_agent: {
      type: DataTypes.TEXT,
    },
    approval_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'approval_requests',
        key: 'id',
      },
    },
  },
  {
    sequelize,
    modelName: 'TransactionAuditTrail',
    tableName: 'transaction_audit_trail',
    timestamps: false,
    createdAt: 'createdAt',
    updatedAt: false,
    underscored: true,
  }
);

export default TransactionAuditTrail;