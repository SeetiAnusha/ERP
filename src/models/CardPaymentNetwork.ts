import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export interface CardPaymentNetworkAttributes {
  id?: number;
  name: string; // Visa, Mastercard, American Express, etc.
  type: 'DEBIT' | 'CREDIT';
  processingFee: number; // Percentage fee charged by network
  settlementDays: number; // Days to settle payment
  isActive: boolean;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class CardPaymentNetwork extends Model<CardPaymentNetworkAttributes> implements CardPaymentNetworkAttributes {
  public id!: number;
  public name!: string;
  public type!: 'DEBIT' | 'CREDIT';
  public processingFee!: number;
  public settlementDays!: number;
  public isActive!: boolean;
  public description?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CardPaymentNetwork.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Payment network name (Visa, Mastercard, etc.)',
    },
    type: {
      type: DataTypes.ENUM('DEBIT', 'CREDIT'),
      allowNull: false,
    },
    processingFee: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: 0.0000,
      field: 'processing_fee',
      comment: 'Processing fee percentage (e.g., 0.0250 for 2.5%)',
    },
    settlementDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      field: 'settlement_days',
      comment: 'Days for payment settlement',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
      comment: 'Whether this network is active',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional description or notes',
    },
  },
  {
    sequelize,
    tableName: 'card_payment_networks',
    modelName: 'CardPaymentNetwork',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['name', 'type'],
        name: 'unique_network_type',
      },
    ],
  }
);

export default CardPaymentNetwork;