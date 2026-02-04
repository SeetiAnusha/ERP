import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface SaleItemAttributes {
  id: number;
  saleId: number;
  productId: number;
  productCode: string;
  productName: string;
  unitOfMeasurement: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  tax: number;
  total: number;
  costOfGoodsSold: number;
  grossMargin: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SaleItemCreationAttributes extends Optional<SaleItemAttributes, 'id'> {}

class SaleItem extends Model<SaleItemAttributes, SaleItemCreationAttributes> implements SaleItemAttributes {
  public id!: number;
  public saleId!: number;
  public productId!: number;
  public productCode!: string;
  public productName!: string;
  public unitOfMeasurement!: string;
  public quantity!: number;
  public unitPrice!: number;
  public subtotal!: number;
  public tax!: number;
  public total!: number;
  public costOfGoodsSold!: number;
  public grossMargin!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SaleItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    saleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'sales',
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
    unitPrice: {
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
    costOfGoodsSold: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    grossMargin: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'sale_items',
    timestamps: true,
  }
);

export default SaleItem;
