import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import Client from './Client';

interface SaleAttributes {
  id: number;
  registrationNumber: string;
  documentNumber: string;
  registrationDate: Date;
  date: Date;
  clientId: number;
  clientRnc?: string;
  ncf?: string;
  saleType: string;
  paymentType: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paidAmount: number;
  balanceAmount: number;
  status: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SaleCreationAttributes extends Optional<SaleAttributes, 'id'> {}

class Sale extends Model<SaleAttributes, SaleCreationAttributes> implements SaleAttributes {
  public id!: number;
  public registrationNumber!: string;
  public documentNumber!: string;
  public registrationDate!: Date;
  public date!: Date;
  public clientId!: number;
  public clientRnc?: string;
  public ncf?: string;
  public saleType!: string;
  public paymentType!: string;
  public paymentMethod!: string;
  public paymentStatus!: string;
  public subtotal!: number;
  public tax!: number;
  public discount!: number;
  public total!: number;
  public paidAmount!: number;
  public balanceAmount!: number;
  public status!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Sale.init(
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
    documentNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    registrationDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    clientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'clients',
        key: 'id',
      },
    },
    clientRnc: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    ncf: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    saleType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'Merchandise for sale',
    },
    paymentType: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    paymentMethod: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'Cash',
    },
    paymentStatus: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'Unpaid',
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    tax: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    discount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    paidAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    balanceAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'sales',
    timestamps: true,
  }
);

// Associations will be set up in a separate file to avoid circular dependencies
export default Sale;
