import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ClientCreditAttributes {
  id: number;
  clientId: number;
  clientRnc: string;
  clientName: string;
  paymentId: number;
  creditAmount: number;
  usedAmount: number;
  remainingAmount: number;
  registrationDate: Date;
  status: string; // 'Active', 'Used', 'Expired'
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ClientCreditCreationAttributes extends Optional<ClientCreditAttributes, 'id'> {}

class ClientCredit extends Model<ClientCreditAttributes, ClientCreditCreationAttributes> implements ClientCreditAttributes {
  public id!: number;
  public clientId!: number;
  public clientRnc!: string;
  public clientName!: string;
  public paymentId!: number;
  public creditAmount!: number;
  public usedAmount!: number;
  public remainingAmount!: number;
  public registrationDate!: Date;
  public status!: string;
  public notes?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ClientCredit.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    clientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'clients',
        key: 'id',
      },
    },
    clientRnc: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    clientName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    paymentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'payments',
        key: 'id',
      },
    },
    creditAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    usedAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    remainingAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    registrationDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'Active',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'client_credits',
    timestamps: true,
  }
);

export default ClientCredit;
