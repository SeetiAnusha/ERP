import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface FixedAssetAttributes {
  id: number;
  code: string;
  name: string;
  description: string;
  category: string;
  acquisitionDate: Date;
  acquisitionCost: number;
  usefulLife: number;
  depreciationMethod: string;
  residualValue: number;
  accumulatedDepreciation: number;
  bookValue: number;
  status: string;
  location?: string;
  serialNumber?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface FixedAssetCreationAttributes extends Optional<FixedAssetAttributes, 'id'> {}

class FixedAsset extends Model<FixedAssetAttributes, FixedAssetCreationAttributes> implements FixedAssetAttributes {
  public id!: number;
  public code!: string;
  public name!: string;
  public description!: string;
  public category!: string;
  public acquisitionDate!: Date;
  public acquisitionCost!: number;
  public usefulLife!: number;
  public depreciationMethod!: string;
  public residualValue!: number;
  public accumulatedDepreciation!: number;
  public bookValue!: number;
  public status!: string;
  public location?: string;
  public serialNumber?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FixedAsset.init(
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
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    acquisitionDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    acquisitionCost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    usefulLife: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    depreciationMethod: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    residualValue: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    accumulatedDepreciation: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    bookValue: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    serialNumber: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'fixed_assets',
    timestamps: true,
  }
);

export default FixedAsset;
