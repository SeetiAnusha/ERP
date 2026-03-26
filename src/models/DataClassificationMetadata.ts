/**
 * SEPARATE DATABASE TABLE - Does NOT affect existing models
 * This is a completely isolated table for data classification metadata
 */

import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface DataClassificationMetadataAttributes {
  id: string;
  entityType: string;        // 'User', 'Client', 'AccountsPayable', etc.
  entityId: string;          // The ID of the actual record
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
  retentionDays: number;     // How long to keep the data
  classifiedAt: Date;
  expiresAt: Date | null;
  complianceReasons: string; // JSON string of compliance standards
  autoClassified: boolean;
  isActive: boolean;         // Can disable without deleting
}

export interface DataClassificationMetadataCreationAttributes 
  extends Optional<DataClassificationMetadataAttributes, 'id' | 'classifiedAt' | 'isActive'> {}

/**
 * COMPLETELY SEPARATE MODEL - No relationships to existing models
 * This ensures zero impact on your current system
 */
export class DataClassificationMetadata extends Model<
  DataClassificationMetadataAttributes,
  DataClassificationMetadataCreationAttributes
> implements DataClassificationMetadataAttributes {
  public id!: string;
  public entityType!: string;
  public entityId!: string;
  public classification!: 'public' | 'internal' | 'confidential' | 'restricted';
  public retentionDays!: number;
  public classifiedAt!: Date;
  public expiresAt!: Date | null;
  public complianceReasons!: string;
  public autoClassified!: boolean;
  public isActive!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// Initialize the model with the sequelize instance
DataClassificationMetadata.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    entityType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'entity_type', // Map to snake_case column
      comment: 'Type of entity being classified (User, Client, etc.)'
    },
    entityId: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'entity_id', // Map to snake_case column
      comment: 'ID of the actual record being classified'
    },
    classification: {
      type: DataTypes.ENUM('public', 'internal', 'confidential', 'restricted'),
      allowNull: false,
      defaultValue: 'internal'
    },
    retentionDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1095, // 3 years default
      field: 'retention_days', // Map to snake_case column
      comment: 'Number of days to retain data (-1 for permanent)'
    },
    classifiedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'classified_at' // Map to snake_case column
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at', // Map to snake_case column
      comment: 'When this data should be archived/deleted (null for permanent)'
    },
    complianceReasons: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '[]',
      field: 'compliance_reasons', // Map to snake_case column
      comment: 'JSON array of compliance standards (GDPR, SOX, etc.)'
    },
    autoClassified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'auto_classified', // Map to snake_case column
      comment: 'Whether classification was automatic or manual'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active', // Map to snake_case column
      comment: 'Can disable classification without deleting record'
    }
  },
  {
    sequelize,
    tableName: 'data_classification_metadata',
    modelName: 'DataClassificationMetadata',
    timestamps: true,
    indexes: [
      {
        fields: ['entity_type', 'entity_id'], // Use snake_case for index
        unique: true,
        name: 'unique_entity_classification'
      },
      {
        fields: ['expires_at'], // Use snake_case for index
        name: 'idx_expires_at'
      },
      {
        fields: ['classification'],
        name: 'idx_classification'
      },
      {
        fields: ['is_active'], // Use snake_case for index
        name: 'idx_is_active'
      }
    ],
    comment: 'Separate table for data classification - does not affect existing models'
  }
);

export default DataClassificationMetadata;