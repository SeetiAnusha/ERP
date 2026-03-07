import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

export interface ClientPaymentMethodAttributes {
  id?: number;
  clientId: number;
  paymentType: 'DEBIT_CARD' | 'CREDIT_CARD' | 'BANK_ACCOUNT';
  cardPaymentNetworkId?: number; // For card payments
  bankAccountId?: number; // For direct bank transfers
  cardHolderName?: string;
  cardNumber?: string; // Encrypted/masked
  cardLast4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  creditLimit?: number; // For credit cards
  usedCredit?: number; // For credit cards
  isActive: boolean;
  isDefault: boolean;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class ClientPaymentMethod extends Model<ClientPaymentMethodAttributes> implements ClientPaymentMethodAttributes {
  public id!: number;
  public clientId!: number;
  public paymentType!: 'DEBIT_CARD' | 'CREDIT_CARD' | 'BANK_ACCOUNT';
  public cardPaymentNetworkId?: number;
  public bankAccountId?: number;
  public cardHolderName?: string;
  public cardNumber?: string;
  public cardLast4?: string;
  public expiryMonth?: number;
  public expiryYear?: number;
  public creditLimit?: number;
  public usedCredit?: number;
  public isActive!: boolean;
  public isDefault!: boolean;
  public notes?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public CardPaymentNetwork?: any;
  public BankAccount?: any;
  public Client?: any;
}

ClientPaymentMethod.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    clientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'client_id', // Map to snake_case column
      references: {
        model: 'clients',
        key: 'id',
      },
    },
    paymentType: {
      type: DataTypes.ENUM('DEBIT_CARD', 'CREDIT_CARD', 'BANK_ACCOUNT'),
      allowNull: false,
      field: 'payment_type',
    },
    cardPaymentNetworkId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'card_payment_network_id',
      references: {
        model: 'card_payment_networks',
        key: 'id',
      },
    },
    bankAccountId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'bank_account_id',
      references: {
        model: 'bank_accounts',
        key: 'id',
      },
    },
    cardHolderName: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: 'card_holder_name',
    },
    cardNumber: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'card_number',
      comment: 'Encrypted card number',
    },
    cardLast4: {
      type: DataTypes.STRING(4),
      allowNull: true,
      field: 'card_last4',
      comment: 'Last 4 digits for display',
    },
    expiryMonth: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'expiry_month',
      validate: {
        min: 1,
        max: 12,
      },
    },
    expiryYear: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'expiry_year',
    },
    creditLimit: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0,
      field: 'credit_limit',
      comment: 'Credit limit for credit cards',
    },
    usedCredit: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0,
      field: 'used_credit',
      comment: 'Used credit amount',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_default',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'client_payment_methods',
    modelName: 'ClientPaymentMethod',
    timestamps: true,
    indexes: [
      {
        fields: ['client_id'],
      },
      {
        fields: ['payment_type'],
      },
      {
        fields: ['is_active'],
      },
    ],
  }
);

export default ClientPaymentMethod;