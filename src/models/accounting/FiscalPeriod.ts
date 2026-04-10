import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../config/database';

/**
 * Fiscal Period Model
 * 
 * Manages accounting periods for financial reporting and closing.
 * Supports monthly, quarterly, and annual periods.
 */

export enum PeriodStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  LOCKED = 'LOCKED'
}

interface FiscalPeriodAttributes {
  id: number;
  periodName: string;
  periodType: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  startDate: Date;
  endDate: Date;
  fiscalYear: number;
  status: PeriodStatus;
  closedAt?: Date;
  closedBy?: number;
  reopenedAt?: Date;
  reopenedBy?: number;
  reopenCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface FiscalPeriodCreationAttributes extends Optional<FiscalPeriodAttributes, 'id' | 'reopenCount'> {}

class FiscalPeriod extends Model<FiscalPeriodAttributes, FiscalPeriodCreationAttributes> implements FiscalPeriodAttributes {
  public id!: number;
  public periodName!: string;
  public periodType!: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  public startDate!: Date;
  public endDate!: Date;
  public fiscalYear!: number;
  public status!: PeriodStatus;
  public closedAt?: Date;
  public closedBy?: number;
  public reopenedAt?: Date;
  public reopenedBy?: number;
  public reopenCount!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FiscalPeriod.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    periodName: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Period name (e.g., "January 2024", "Q1 2024")',
    },
    periodType: {
      type: DataTypes.ENUM('MONTHLY', 'QUARTERLY', 'ANNUAL'),
      allowNull: false,
      comment: 'Period type',
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Period start date',
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Period end date',
    },
    fiscalYear: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Fiscal year',
    },
    status: {
      type: DataTypes.ENUM(...Object.values(PeriodStatus)),
      allowNull: false,
      defaultValue: PeriodStatus.OPEN,
      comment: 'Period status',
    },
    closedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When period was closed',
    },
    closedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'auth_users',
        key: 'id',
      },
      comment: 'User who closed the period',
    },
    reopenedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When period was last reopened',
    },
    reopenedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'auth_users',
        key: 'id',
      },
      comment: 'User who last reopened the period',
    },
    reopenCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Number of times the period has been reopened',
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
    tableName: 'fiscal_periods',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['fiscal_year'] },
      { fields: ['status'] },
      { fields: ['start_date', 'end_date'] },
    ],
  }
);

export default FiscalPeriod;
