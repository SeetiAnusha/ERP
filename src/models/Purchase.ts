import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import Supplier from './Supplier';

interface PurchaseAttributes {
  id: number;
  registrationNumber: string;
  registrationDate: Date;
  date: Date;
  supplierId: number;
  supplierRnc?: string;
  ncf?: string;
  purchaseType: string;
  paymentType: string;
  paymentStatus: string;
  productTotal: number;
  additionalExpenses: number;
  total: number;
  paidAmount: number;
  balanceAmount: number;
  totalWithAssociated?: number;
  status: string;
  // New fields for Phase 2
  bankAccountId?: number;
  cardId?: number;
  chequeNumber?: string;
  chequeDate?: Date;
  transferNumber?: string;
  transferDate?: Date;
  paymentReference?: string;
  voucherDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PurchaseCreationAttributes extends Optional<PurchaseAttributes, 'id'> {}

class Purchase extends Model<PurchaseAttributes, PurchaseCreationAttributes> implements PurchaseAttributes {
  public id!: number;
  public registrationNumber!: string;
  public registrationDate!: Date;
  public date!: Date;
  public supplierId!: number;
  public supplierRnc?: string;
  public ncf?: string;
  public purchaseType!: string;
  public paymentType!: string;
  public paymentStatus!: string;
  public productTotal!: number;
  public additionalExpenses!: number;
  public total!: number;
  public paidAmount!: number;
  public balanceAmount!: number;
  public totalWithAssociated?: number;
  public status!: string;
  // New fields for Phase 2
  public bankAccountId?: number;
  public cardId?: number;
  public chequeNumber?: string;
  public chequeDate?: Date;
  public transferNumber?: string;
  public transferDate?: Date;
  public paymentReference?: string;
  public voucherDate?: Date;
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
    // New fields for Phase 2
    bankAccountId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'bank_accounts',
        key: 'id',
      },
    },
    cardId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'cards',
        key: 'id',
      },
    },
    chequeNumber: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    chequeDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    transferNumber: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    transferDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    paymentReference: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    voucherDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'purchases',
    timestamps: true,
    // Explicitly set define options to avoid globalOptions.define issue
    underscored: true,
    freezeTableName: true,
  }
);

// Associations will be set up in a separate file to avoid circular dependencies
export default Purchase;
