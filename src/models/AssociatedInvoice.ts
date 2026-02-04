import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface AssociatedInvoiceAttributes {
  id: number;
  purchaseId: number;
  supplierRnc: string;
  supplierName: string;
  concept: string;
  ncf: string;
  date: Date;
  taxAmount: number;
  tax: number;
  amount: number;
  purchaseType: string;
  paymentType?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AssociatedInvoiceCreationAttributes extends Optional<AssociatedInvoiceAttributes, 'id'> {}

class AssociatedInvoice extends Model<AssociatedInvoiceAttributes, AssociatedInvoiceCreationAttributes> implements AssociatedInvoiceAttributes {
  public id!: number;
  public purchaseId!: number;
  public supplierRnc!: string;
  public supplierName!: string;
  public concept!: string;
  public ncf!: string;
  public date!: Date;
  public taxAmount!: number;
  public tax!: number;
  public amount!: number;
  public purchaseType!: string;
  public paymentType?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AssociatedInvoice.init(
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
    supplierRnc: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    supplierName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    concept: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    ncf: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    taxAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    tax: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    purchaseType: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    paymentType: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'associated_invoices',
    timestamps: true,
  }
);

export default AssociatedInvoice;
