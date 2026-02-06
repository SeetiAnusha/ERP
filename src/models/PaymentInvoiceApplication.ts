import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface PaymentInvoiceApplicationAttributes {
  id: number;
  paymentId: number;
  invoiceType: string; // 'Purchase' or 'Sale'
  invoiceId: number;
  invoiceNumber: string;
  appliedAmount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PaymentInvoiceApplicationCreationAttributes extends Optional<PaymentInvoiceApplicationAttributes, 'id'> {}

class PaymentInvoiceApplication extends Model<PaymentInvoiceApplicationAttributes, PaymentInvoiceApplicationCreationAttributes> implements PaymentInvoiceApplicationAttributes {
  public id!: number;
  public paymentId!: number;
  public invoiceType!: string;
  public invoiceId!: number;
  public invoiceNumber!: string;
  public appliedAmount!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PaymentInvoiceApplication.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    paymentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'payments',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    invoiceType: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    invoiceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    invoiceNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    appliedAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'payment_invoice_applications',
    timestamps: true,
  }
);

export default PaymentInvoiceApplication;
