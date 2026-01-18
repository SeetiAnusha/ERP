import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface SupplierAttributes {
  id: number;
  code: string;
  name: string;
  rnc: string;
  phone: string;
  email?: string;
  address: string;
  supplierType: string;
  paymentTerms: string;
  currentBalance: number;
  status: string;
  contactPerson?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SupplierCreationAttributes extends Optional<SupplierAttributes, 'id'> {}

class Supplier extends Model<SupplierAttributes, SupplierCreationAttributes> implements SupplierAttributes {
  public id!: number;
  public code!: string;
  public name!: string;
  public rnc!: string;
  public phone!: string;
  public email?: string;
  public address!: string;
  public supplierType!: string;
  public paymentTerms!: string;
  public currentBalance!: number;
  public status!: string;
  public contactPerson?: string;
  public notes?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Supplier.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    rnc: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    supplierType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'LOCAL',
    },
    paymentTerms: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'CASH',
    },
    currentBalance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    contactPerson: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'suppliers',
    timestamps: true,
  }
);

export default Supplier;
