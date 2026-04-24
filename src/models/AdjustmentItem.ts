import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface AdjustmentItemAttributes {
  id: number;
  adjustmentId: number;
  productId: number;
  productCode: string;
  productName: string;
  quantity: number;
  unitOfMeasurement: string;
  unitCost: number;
  subtotal: number;
  tax: number;
  total: number;
  adjustmentType: 'INCREASE' | 'DECREASE';
  reason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AdjustmentItemCreationAttributes extends Optional<AdjustmentItemAttributes, 'id'> {}

class AdjustmentItem extends Model<AdjustmentItemAttributes, AdjustmentItemCreationAttributes> implements AdjustmentItemAttributes {
  public id!: number;
  public adjustmentId!: number;
  public productId!: number;
  public productCode!: string;
  public productName!: string;
  public quantity!: number;
  public unitOfMeasurement!: string;
  public unitCost!: number;
  public subtotal!: number;
  public tax!: number;
  public total!: number;
  public adjustmentType!: 'INCREASE' | 'DECREASE';
  public reason?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AdjustmentItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    adjustmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'adjustment_id',
      references: {
        model: 'adjustments',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'product_id',
      references: {
        model: 'products',
        key: 'id',
      },
      onDelete: 'RESTRICT',
    },
    productCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'product_code',
    },
    productName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'product_name',
    },
    quantity: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
    },
    unitOfMeasurement: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'unit_of_measurement',
    },
    unitCost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      field: 'unit_cost',
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    tax: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    adjustmentType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'adjustment_type',
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'adjustment_items',
    timestamps: true,
    underscored: true,
  }
);

export default AdjustmentItem;
