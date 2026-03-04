import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class Financer extends Model {
  public id!: number;
  public code!: string;
  public name!: string;
  public contactPerson!: string;
  public phone!: string;
  public email!: string;
  public address!: string;
  public rnc!: string;
  public type!: 'BANK' | 'INVESTOR' | 'OTHER';
  public status!: 'ACTIVE' | 'INACTIVE';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Financer.init(
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
    contactPerson: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rnc: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM('BANK', 'INVESTOR', 'OTHER'),
      allowNull: false,
      defaultValue: 'OTHER',
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
  },
  {
    sequelize,
    tableName: 'financers',
    timestamps: true,
  }
);

export default Financer;
