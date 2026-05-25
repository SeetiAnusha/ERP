import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

/**
 * Financer Model - Enhanced for Shareholder, Financier, and Related Party Management
 * 
 * Purpose: Track all entities that provide financial resources to the company
 * 
 * Financer Types:
 * - SHAREHOLDER: Equity investors/contributors who own a stake in the company
 * - FINANCIER: Lenders who provide loans/debt financing
 * - SHAREHOLDER_LENDER: Existing shareholders who also provide loans
 * - RELATED_PARTY_LENDER: Related entities providing loans (family, affiliated companies, etc.)
 * 
 * Financial Nature:
 * - EQUITY: Ownership stake (for shareholders)
 * - LOAN: Debt financing (for financiers and lenders)
 */
class Financer extends Model {
  public id!: number;
  public code!: string;
  public name!: string;
  public contactPerson!: string;
  public phone!: string;
  public email!: string;
  public address!: string;
  public rnc!: string;
  
  // ✅ NEW: Enhanced classification
  public financer_type!: 'SHAREHOLDER_CONTRIBUTOR' | 'FINANCIER' | 'SHAREHOLDER_LENDER' | 'RELATED_PARTY_LENDER';
  public financial_nature!: 'EQUITY' | 'LOAN';
  
  // ✅ NEW: Financial tracking
  public total_contributed!: number;
  public outstanding_balance!: number;
  public equity_percentage?: number; // For SHAREHOLDER only
  public interest_rate?: number; // For LOAN only
  public relationship_description?: string;
  
  // Legacy field (kept for backward compatibility)
  public legacy_type?: 'BANK' | 'INVESTOR' | 'OTHER';
  
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
      comment: 'Unique identifier code for the financer',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Full name of person or company',
    },
    contactPerson: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Primary contact person name',
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Contact phone number',
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Contact email address',
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Physical address',
    },
    rnc: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Tax identification number (RNC/Cédula)',
    },
    // ✅ NEW: Enhanced classification fields
    financer_type: {
      type: DataTypes.ENUM('SHAREHOLDER_CONTRIBUTOR', 'FINANCIER', 'SHAREHOLDER_LENDER', 'RELATED_PARTY_LENDER'),
      allowNull: false,
      defaultValue: 'FINANCIER',
      comment: 'Type: SHAREHOLDER_CONTRIBUTOR (equity investor), FINANCIER (lender), SHAREHOLDER_LENDER (shareholder providing loan), RELATED_PARTY_LENDER (related party providing loan)',
    },
    financial_nature: {
      type: DataTypes.ENUM('EQUITY', 'LOAN'),
      allowNull: false,
      defaultValue: 'EQUITY',
      comment: 'Nature: EQUITY (ownership stake) or LOAN (debt)',
    },
    // ✅ NEW: Financial tracking fields
    total_contributed: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Total amount contributed/invested',
    },
    outstanding_balance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Outstanding balance (for loans) or current equity value',
    },
    equity_percentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Ownership percentage (for SHAREHOLDER type only)',
    },
    interest_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: 'Interest rate (for LOAN financial nature only)',
    },
    relationship_description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Description of relationship with the company',
    },
    // Legacy field (kept for backward compatibility)
    legacy_type: {
      type: DataTypes.ENUM('BANK', 'INVESTOR', 'OTHER'),
      allowNull: true,
      comment: 'Legacy type field (deprecated, use financer_type instead)',
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
      allowNull: false,
      defaultValue: 'ACTIVE',
      comment: 'Current status of the financer',
    },
  },
  {
    sequelize,
    tableName: 'financers',
    timestamps: true,
    indexes: [
      {
        name: 'idx_financers_financer_type',
        fields: ['financer_type'],
      },
      {
        name: 'idx_financers_financial_nature',
        fields: ['financial_nature'],
      },
      {
        name: 'idx_financers_status',
        fields: ['status'],
      },
    ],
  }
);

export default Financer;
