import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ClientAttributes {
  id: number;
  code: string;
  name: string;
  rncCedula: string;
  phone: string;
  email?: string;
  address: string;
  clientType: string;
  creditLimit: number;
  paymentTerms: string;
  currentBalance: number;
  status: string;
  contactPerson?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ClientCreationAttributes extends Optional<ClientAttributes, 'id'> {}

class Client extends Model<ClientAttributes, ClientCreationAttributes> implements ClientAttributes {
  public id!: number;
  public code!: string;
  public name!: string;
  public rncCedula!: string;
  public phone!: string;
  public email?: string;
  public address!: string;
  public clientType!: string;
  public creditLimit!: number;
  public paymentTerms!: string;
  public currentBalance!: number;
  public status!: string;
  public contactPerson?: string;
  public notes?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Client.init(
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
    rncCedula: {
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
    clientType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'RETAIL',
    },
    creditLimit: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
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
    tableName: 'clients',
    timestamps: true,
  }
);

export default Client;
