import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface InvestmentAgreementAttributes {
  id: number;
  agreementNumber: string;
  agreementDate: Date;
  investorId: number;
  investorName: string;
  agreementType: 'INVESTMENT' | 'LOAN';
  totalCommittedAmount: number;
  receivedAmount: number;
  balanceAmount: number;
  interestRate?: number; // For loans
  maturityDate?: Date; // For loans
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  terms?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface InvestmentAgreementCreationAttributes extends Optional<InvestmentAgreementAttributes, 'id'> {}

class InvestmentAgreement extends Model<InvestmentAgreementAttributes, InvestmentAgreementCreationAttributes> implements InvestmentAgreementAttributes {
  public id!: number;
  public agreementNumber!: string;
  public agreementDate!: Date;
  public investorId!: number;
  public investorName!: string;
  public agreementType!: 'INVESTMENT' | 'LOAN';
  public totalCommittedAmount!: number;
  public receivedAmount!: number;
  public balanceAmount!: number;
  public interestRate?: number;
  public maturityDate?: Date;
  public status!: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  public terms?: string;
  public notes?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

InvestmentAgreement.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    agreementNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    agreementDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    investorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    investorName: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    agreementType: {
      type: DataTypes.ENUM('INVESTMENT', 'LOAN'),
      allowNull: false,
    },
    totalCommittedAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    receivedAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    balanceAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    interestRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    maturityDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'COMPLETED', 'CANCELLED'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    terms: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'investment_agreements',
    timestamps: true,
  }
);

export default InvestmentAgreement;