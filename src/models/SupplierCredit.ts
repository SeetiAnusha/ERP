import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface SupplierCreditAttributes {
  id: number;
  supplierId: number;
  supplierRnc: string;
  supplierName: string;
  paymentId: number;
  creditAmount: number;
  usedAmount: number;
  remainingAmount: number;
  registrationDate: Date;
  status: string; // 'Active', 'Used', 'Expired'
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SupplierCreditCreationAttributes extends Optional<SupplierCreditAttributes, 'id'> {}

class SupplierCredit extends Model<SupplierCreditAttributes, SupplierCreditCreationAttributes> implements SupplierCreditAttributes {
  public id!: number;
  public supplierId!: number;
  public supplierRnc!: string;
  public supplierName!: string;
  public paymentId!: number;
  public creditAmount!: number;
  public usedAmount!: number;
  public remainingAmount!: number;
  public registrationDate!: Date;
  public status!: string;
  public notes?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SupplierCredit.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
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
      allowNull: false,
    },
    supplierName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    paymentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'payments',
        key: 'id',
      },
    },
    creditAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    usedAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    remainingAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    registrationDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'Active',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'supplier_credits',
    timestamps: true,
  }
);

export default SupplierCredit;
