import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import User from './User';
import TransactionDeletionReason from './TransactionDeletionReason';

interface ApprovalRequestAttributes {
  id: number;
  request_number: string;
  workflow_id: number;
  entity_type: string;
  entity_id: number;
  requested_by: number;
  request_reason: string;
  deletion_reason_code?: string;
  custom_memo?: string;
  impact_analysis: any;
  current_step: number;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  approved_at?: Date;
  executed_at?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ApprovalRequestCreationAttributes extends Optional<ApprovalRequestAttributes, 'id'> {}

class ApprovalRequest extends Model<ApprovalRequestAttributes, ApprovalRequestCreationAttributes> implements ApprovalRequestAttributes {
  public id!: number;
  public request_number!: string;
  public workflow_id!: number;
  public entity_type!: string;
  public entity_id!: number;
  public requested_by!: number;
  public request_reason!: string;
  public deletion_reason_code?: string;
  public custom_memo?: string;
  public impact_analysis!: any;
  public current_step!: number;
  public status!: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  public approved_at?: Date;
  public executed_at?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public requester?: any;
  public deletionReason?: any;
  public steps?: any[];
}

ApprovalRequest.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    request_number: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    workflow_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    entity_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    entity_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    requested_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'auth_users',
        key: 'id',
      },
    },
    request_reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    deletion_reason_code: {
      type: DataTypes.STRING(50),
      references: {
        model: 'transaction_deletion_reasons',
        key: 'reason_code',
      },
    },
    custom_memo: {
      type: DataTypes.TEXT,
    },
    impact_analysis: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    current_step: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    status: {
      type: DataTypes.ENUM('Pending', 'Approved', 'Rejected', 'Cancelled'),
      defaultValue: 'Pending',
    },
    approved_at: {
      type: DataTypes.DATE,
    },
    executed_at: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    modelName: 'ApprovalRequest',
    tableName: 'approval_requests',
    timestamps: true,
    underscored: true,
  }
);

export default ApprovalRequest;