import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import Supplier from './Supplier';

interface PurchaseAttributes {
  id: number;
  registrationNumber: string;
  documentNumber: string;
  registrationDate: Date;
  date: Date;
  supplierId: number;
  supplierRnc?: string;
  ncf?: string;
  purchaseType: string;
  paymentType: string;
  paymentMethod: string;
  paymentStatus: string;
  productTotal: number;
  additionalExpenses: number;
  total: number;
  paidAmount: number;
  balanceAmount: number;
  totalWithAssociated?: number;
  status: string;
  invoice?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PurchaseCreationAttributes extends Optional<PurchaseAttributes, 'id'> {}

class Purchase extends Model<PurchaseAttributes, PurchaseCreationAttributes> implements PurchaseAttributes {
  public id!: number;
  public registrationNumber!: string;
  public documentNumber!: string;
  public registrationDate!: Date;
  public date!: Date;
  public supplierId!: number;
  public supplierRnc?: string;
  public ncf?: string;
  public purchaseType!: string;
  public paymentType!: string;
  public paymentMethod!: string;
  public paymentStatus!: string;
  public productTotal!: number;
  public additionalExpenses!: number;
  public total!: number;
  public paidAmount!: number;
  public balanceAmount!: number;
  public totalWithAssociated?: number;
  public status!: string;
  public invoice?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Purchase.init(
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
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'suppliers',
        key: 'id',
      },
    },
    supplierRnc: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    ncf: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    purchaseType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'Merchandise for sale or consumption',
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
    productTotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    additionalExpenses: {
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
    totalWithAssociated: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    invoice: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'purchases',
    timestamps: true,
  }
);

// Associations will be set up in a separate file to avoid circular dependencies
export default Purchase;
