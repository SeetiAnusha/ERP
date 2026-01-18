import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface PurchaseItemAttributes {
  id: number;
  purchaseId: number;
  productId: number;
  productCode: string;
  productName: string;
  unitOfMeasurement: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
  tax: number;
  total: number;
  adjustedUnitCost?: number;
  adjustedTotal?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PurchaseItemCreationAttributes extends Optional<PurchaseItemAttributes, 'id'> {}

class PurchaseItem extends Model<PurchaseItemAttributes, PurchaseItemCreationAttributes> implements PurchaseItemAttributes {
  public id!: number;
  public purchaseId!: number;
  public productId!: number;
  public productCode!: string;
  public productName!: string;
  public unitOfMeasurement!: string;
  public quantity!: number;
  public unitCost!: number;
  public subtotal!: number;
  public tax!: number;
  public total!: number;
  public adjustedUnitCost?: number;
  public adjustedTotal?: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PurchaseItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    purchaseId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'purchases',
        key: 'id',
      },
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'products',
        key: 'id',
      },
    },
    productCode: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    productName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    unitOfMeasurement: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
    },
    unitCost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    tax: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    total: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    adjustedUnitCost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    adjustedTotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'purchase_items',
    timestamps: true,
  }
);

export default PurchaseItem;
