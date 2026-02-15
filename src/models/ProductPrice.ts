import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ProductPriceAttributes {
  id: number;
  productId: number;
  salesPrice: number;
  effectiveDate: Date;
  endDate?: Date;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ProductPriceCreationAttributes extends Optional<ProductPriceAttributes, 'id'> {}

class ProductPrice extends Model<ProductPriceAttributes, ProductPriceCreationAttributes> implements ProductPriceAttributes {
  public id!: number;
  public productId!: number;
  public salesPrice!: number;
  public effectiveDate!: Date;
  public endDate?: Date;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ProductPrice.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'products',
        key: 'id',
      },
    },
    salesPrice: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    effectiveDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: 'product_prices',
    timestamps: true,
  }
);

export default ProductPrice;
