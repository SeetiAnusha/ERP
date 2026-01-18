import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface AdjustmentAttributes {
  id: number;
  registrationNumber: string;
  registrationDate: Date;
  type: string;
  relatedDocumentType: string;
  relatedDocumentNumber: string;
  relatedEntityType: string;
  relatedEntityId: number;
  supplierRnc?: string;
  supplierName?: string;
  clientRnc?: string;
  clientName?: string;
  ncf?: string;
  date?: Date;
  reason: string;
  adjustmentAmount: number;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AdjustmentCreationAttributes extends Optional<AdjustmentAttributes, 'id'> {}

class Adjustment extends Model<AdjustmentAttributes, AdjustmentCreationAttributes> implements AdjustmentAttributes {
  public id!: number;
  public registrationNumber!: string;
  public registrationDate!: Date;
  public type!: string;
  public relatedDocumentType!: string;
  public relatedDocumentNumber!: string;
  public relatedEntityType!: string;
  public relatedEntityId!: number;
  public supplierRnc?: string;
  public supplierName?: string;
  public clientRnc?: string;
  public clientName?: string;
  public ncf?: string;
  public date?: Date;
  public reason!: string;
  public adjustmentAmount!: number;
  public notes?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Adjustment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    registrationNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    registrationDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    relatedDocumentType: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    relatedDocumentNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    relatedEntityType: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    relatedEntityId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    supplierRnc: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    supplierName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    clientRnc: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    clientName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    ncf: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    adjustmentAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'adjustments',
    timestamps: true,
  }
);

export default Adjustment;
