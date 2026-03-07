import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class CreditCardNetwork extends Model {
  public id!: number;
  public code!: string;
  public networkName!: string; // Visa, MasterCard, American Express, etc.
  public displayName!: string; // User-friendly display name
  public processingFeeRate!: number; // Fee percentage charged by network
  public settlementDays!: number; // Days to settle payments
  public status!: 'ACTIVE' | 'INACTIVE';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CreditCardNetwork.init(
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
    networkName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    displayName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    processingFeeRate: {
      type: DataTypes.DECIMAL(5, 4), // e.g., 0.0275 for 2.75%
      allowNull: false,
      defaultValue: 0,
    },
    settlementDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2, // Most networks settle in 1-3 days
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
  },
  {
    sequelize,
    tableName: 'credit_card_networks',
    timestamps: true,
  }
);

export default CreditCardNetwork;