import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class Card extends Model {
  public id!: number;
  public code!: string;
  public bankName!: string;
  public cardName!: string; // NEW: User-friendly card name
  public cardNumberLast4!: string;
  public cardType!: 'CREDIT' | 'DEBIT';
  public cardBrand!: string;
  public bankAccountId!: number | null;
  public creditLimit!: number;
  public usedCredit!: number;
  public status!: 'ACTIVE' | 'INACTIVE';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Card.init(
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
    bankName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    cardName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'card_name', // Maps to snake_case database column
    },
    cardNumberLast4: {
      type: DataTypes.STRING(4),
      allowNull: false,
    },
    cardType: {
      type: DataTypes.ENUM('CREDIT', 'DEBIT'),
      allowNull: false,
    },
    cardBrand: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    bankAccountId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'bank_accounts',
        key: 'id',
      },
    },
    creditLimit: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    usedCredit: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
  },
  {
    sequelize,
    tableName: 'cards',
    timestamps: true,
  }
);

export default Card;
