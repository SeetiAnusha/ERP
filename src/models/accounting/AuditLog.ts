import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../config/database';

/**
 * Audit Log Model
 * 
 * Provides comprehensive audit trail for all privileged operations.
 * Supports 7-year retention requirement for compliance.
 * Records are immutable - no updates or deletes allowed.
 */

interface AuditLogAttributes {
  id: number;
  timestamp: Date;
  userId?: number;
  actionType: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  success: boolean;
  createdAt?: Date;
}

interface AuditLogCreationAttributes extends Optional<AuditLogAttributes, 'id' | 'userId' | 'resourceId' | 'details' | 'ipAddress'> {}

class AuditLog extends Model<AuditLogAttributes, AuditLogCreationAttributes> implements AuditLogAttributes {
  public id!: number;
  public timestamp!: Date;
  public userId?: number;
  public actionType!: string;
  public resourceType!: string;
  public resourceId?: string;
  public details?: Record<string, any>;
  public ipAddress?: string;
  public success!: boolean;
  public readonly createdAt!: Date;
}

AuditLog.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Timestamp when the action occurred',
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'auth_users',
        key: 'id',
      },
      comment: 'User who performed the action',
    },
    actionType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Type of action performed (e.g., PERIOD_CLOSE, PERIOD_REOPEN, REPORT_EXPORT)',
    },
    resourceType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Type of resource affected (e.g., FISCAL_PERIOD, REPORT, GL_ENTRY)',
    },
    resourceId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Identifier of the affected resource',
    },
    details: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Additional details about the action',
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: 'IP address of the user (supports IPv4 and IPv6)',
    },
    success: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether the action completed successfully',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'audit_log',
    timestamps: false,
    indexes: [
      { fields: ['timestamp'] },
      { fields: ['userId'] },
      { fields: ['actionType'] },
      { fields: ['resourceType', 'resourceId'] },
    ],
  }
);

export default AuditLog;
