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
  // Payment fields
  registrationNumber?: string;
  paymentType?: string;
  bankAccountId?: number;
  cardId?: number;
  chequeNumber?: string;
  chequeDate?: Date;
  transferNumber?: string;
  transferDate?: Date;
  paymentReference?: string;
  voucherDate?: Date;
  supplierId?: number;
  supplierRnc?: string;
  ncf?: string;
  // Additional fields
  riskLevel?: string;
  broker?: string;
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
  // Payment fields
  public registrationNumber?: string;
  public paymentType?: string;
  public bankAccountId?: number;
  public cardId?: number;
  public chequeNumber?: string;
  public chequeDate?: Date;
  public transferNumber?: string;
  public transferDate?: Date;
  public paymentReference?: string;
  public voucherDate?: Date;
  public supplierId?: number;
  public supplierRnc?: string;
  public ncf?: string;
  // Additional fields
  public riskLevel?: string;
  public broker?: string;
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
    // Payment fields
    registrationNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
    },
    paymentType: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    bankAccountId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    cardId: {
      type: DataTypes.INTEGER,
      allowNull: true,
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
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    supplierRnc: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    ncf: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    // Additional fields
    riskLevel: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: 'MEDIUM',
    },
    broker: {
      type: DataTypes.STRING(255),
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
