import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface CashRegisterAttributes {
  id: number;
  registrationNumber: string;
  registrationDate: Date;
  transactionType: string;
  amount: number;
  paymentMethod: string;
  relatedDocumentType?: string;
  relatedDocumentNumber?: string;
  clientRnc?: string;
  clientName?: string;
  description: string;
  balance: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface CashRegisterCreationAttributes extends Optional<CashRegisterAttributes, 'id'> {}

class CashRegister extends Model<CashRegisterAttributes, CashRegisterCreationAttributes> implements CashRegisterAttributes {
  public id!: number;
  public registrationNumber!: string;
  public registrationDate!: Date;
  public transactionType!: string;
  public amount!: number;
  public paymentMethod!: string;
  public relatedDocumentType?: string;
  public relatedDocumentNumber?: string;
  public clientRnc?: string;
  public clientName?: string;
  public description!: string;
  public balance!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CashRegister.init(
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
    transactionType: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    paymentMethod: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    relatedDocumentType: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    relatedDocumentNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    clientRnc: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    clientName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    balance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'cash_register',
    timestamps: true,
  }
);

export default CashRegister;
