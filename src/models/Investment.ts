import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface InvestmentAttributes {
  id: number;
  code: string;
  name: string;
  type: string;
  description: string;
  acquisitionDate: Date;
  acquisitionCost: number;
  currentValue: number;
  quantity: number;
  unitCost: number;
  status: string;
  maturityDate?: Date;
  interestRate?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface InvestmentCreationAttributes extends Optional<InvestmentAttributes, 'id'> {}

class Investment extends Model<InvestmentAttributes, InvestmentCreationAttributes> implements InvestmentAttributes {
  public id!: number;
  public code!: string;
  public name!: string;
  public type!: string;
  public description!: string;
  public acquisitionDate!: Date;
  public acquisitionCost!: number;
  public currentValue!: number;
  public quantity!: number;
  public unitCost!: number;
  public status!: string;
  public maturityDate?: Date;
  public interestRate?: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Investment.init(
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
    type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    acquisitionDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    acquisitionCost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    currentValue: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
    },
    unitCost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    maturityDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    interestRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'investments',
    timestamps: true,
  }
);

export default Investment;
