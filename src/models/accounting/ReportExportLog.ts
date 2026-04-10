import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../config/database';

/**
 * Report Export Log Model
 * 
 * Tracks all report exports with unique reference numbers for audit trail.
 * Supports CSV, PDF, and JSON export formats.
 */

interface ReportExportLogAttributes {
  id: number;
  referenceNumber: string;
  reportType: string;
  reportFormat: 'CSV' | 'PDF' | 'JSON';
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
  asOfDate?: Date;
  filters?: Record<string, any>;
  exportedBy?: number;
  exportedAt: Date;
  fileSizeBytes?: number;
  createdAt?: Date;
}

interface ReportExportLogCreationAttributes extends Optional<ReportExportLogAttributes, 'id' | 'dateRangeStart' | 'dateRangeEnd' | 'asOfDate' | 'filters' | 'exportedBy' | 'fileSizeBytes'> {}

class ReportExportLog extends Model<ReportExportLogAttributes, ReportExportLogCreationAttributes> implements ReportExportLogAttributes {
  public id!: number;
  public referenceNumber!: string;
  public reportType!: string;
  public reportFormat!: 'CSV' | 'PDF' | 'JSON';
  public dateRangeStart?: Date;
  public dateRangeEnd?: Date;
  public asOfDate?: Date;
  public filters?: Record<string, any>;
  public exportedBy?: number;
  public exportedAt!: Date;
  public fileSizeBytes?: number;
  public readonly createdAt!: Date;
}

ReportExportLog.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    referenceNumber: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      comment: 'Unique report reference number in format RPT-YYYY-NNNNNN',
    },
    reportType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Type of report (e.g., BALANCE_SHEET, PROFIT_LOSS, CASH_FLOW, GL_REPORT)',
    },
    reportFormat: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: 'Export format (CSV, PDF, JSON)',
    },
    dateRangeStart: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Start date for period-based reports',
    },
    dateRangeEnd: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'End date for period-based reports',
    },
    asOfDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'As-of date for balance sheet reports',
    },
    filters: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Additional filters applied to the report',
    },
    exportedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'auth_users',
        key: 'id',
      },
      comment: 'User who exported the report',
    },
    exportedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Timestamp when the report was exported',
    },
    fileSizeBytes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Size of the exported file in bytes',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'report_export_log',
    timestamps: false,
    indexes: [
      { fields: ['referenceNumber'], unique: true },
      { fields: ['reportType'] },
      { fields: ['exportedAt'] },
      { fields: ['exportedBy'] },
    ],
  }
);

export default ReportExportLog;
