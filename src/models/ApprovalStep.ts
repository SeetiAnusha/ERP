import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import ApprovalRequest from './ApprovalRequest';
import User from './User';

interface ApprovalStepAttributes {
  id: number;
  request_id: number;
  step_number: number;
  approver_role: string;
  approver_id?: number;
  required_by?: Date;
  approved_by?: number;
  approved_at?: Date;
  approval_notes?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Skipped';
  createdAt?: Date;
  updatedAt?: Date;
}

interface ApprovalStepCreationAttributes extends Optional<ApprovalStepAttributes, 'id'> {}

class ApprovalStep extends Model<ApprovalStepAttributes, ApprovalStepCreationAttributes> implements ApprovalStepAttributes {
  public id!: number;
  public request_id!: number;
  public step_number!: number;
  public approver_role!: string;
  public approver_id?: number;
  public required_by?: Date;
  public approved_by?: number;
  public approved_at?: Date;
  public approval_notes?: string;
  public status!: 'Pending' | 'Approved' | 'Rejected' | 'Skipped';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public request?: any;
  public approver?: any;
  public approvedByUser?: any;
}

ApprovalStep.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    request_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'approval_requests',
        key: 'id',
      },
    },
    step_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    approver_role: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    approver_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'auth_users',
        key: 'id',
      },
    },
    required_by: {
      type: DataTypes.DATE,
    },
    approved_by: {
      type: DataTypes.INTEGER,
      references: {
        model: 'auth_users',
        key: 'id',
      },
    },
    approved_at: {
      type: DataTypes.DATE,
    },
    approval_notes: {
      type: DataTypes.TEXT,
    },
    status: {
      type: DataTypes.ENUM('Pending', 'Approved', 'Rejected', 'Skipped'),
      defaultValue: 'Pending',
    },
  },
  {
    sequelize,
    modelName: 'ApprovalStep',
    tableName: 'approval_steps',
    timestamps: true,
    underscored: true,
  }
);

export default ApprovalStep;