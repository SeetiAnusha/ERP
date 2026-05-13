import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface FixedAssetAttributes {
  id: number;
  code: string;
  name: string;
  description: string;
  category: string;
  acquisitionDate: Date;
  acquisitionCost: number;
  usefulLife: number;
  depreciationMethod: string;
  residualValue: number;
  accumulatedDepreciation: number;
  bookValue: number;
  status: string;
  location?: string;
  serialNumber?: string;
  // NEW FIELDS - Professional additions
  registrationNumber?: string;          // Unique registration number
  supplier?: string;                    // Who sold the asset
  invoiceNumber?: string;               // Purchase invoice reference
  warrantyExpiryDate?: Date;            // Warranty tracking
  insurancePolicyNumber?: string;       // Insurance tracking
  insuranceExpiryDate?: Date;           // Insurance renewal tracking
  maintenanceSchedule?: string;         // Maintenance frequency (Monthly, Quarterly, etc.)
  lastMaintenanceDate?: Date;           // Last maintenance performed
  nextMaintenanceDate?: Date;           // Next scheduled maintenance
  assignedTo?: string;                  // Employee/Department using the asset
  purchaseOrderNumber?: string;         // PO reference
  disposalDate?: Date;                  // When asset was disposed/sold
  disposalValue?: number;               // Sale price if disposed
  disposalReason?: string;              // Why disposed (Sold, Scrapped, etc.)
  depreciationStartDate?: Date;         // When depreciation starts (may differ from acquisition)
  tags?: string;                        // Comma-separated tags for categorization
  notes?: string;                       // Additional notes
  // Payment fields
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
  createdAt?: Date;
  updatedAt?: Date;
}

interface FixedAssetCreationAttributes extends Optional<FixedAssetAttributes, 'id'> {}

class FixedAsset extends Model<FixedAssetAttributes, FixedAssetCreationAttributes> implements FixedAssetAttributes {
  public id!: number;
  public code!: string;
  public name!: string;
  public description!: string;
  public category!: string;
  public acquisitionDate!: Date;
  public acquisitionCost!: number;
  public usefulLife!: number;
  public depreciationMethod!: string;
  public residualValue!: number;
  public accumulatedDepreciation!: number;
  public bookValue!: number;
  public status!: string;
  public location?: string;
  public serialNumber?: string;
  // NEW FIELDS
  public registrationNumber?: string;
  public supplier?: string;
  public invoiceNumber?: string;
  public warrantyExpiryDate?: Date;
  public insurancePolicyNumber?: string;
  public insuranceExpiryDate?: Date;
  public maintenanceSchedule?: string;
  public lastMaintenanceDate?: Date;
  public nextMaintenanceDate?: Date;
  public assignedTo?: string;
  public purchaseOrderNumber?: string;
  public disposalDate?: Date;
  public disposalValue?: number;
  public disposalReason?: string;
  public depreciationStartDate?: Date;
  public tags?: string;
  public notes?: string;
  // Payment fields
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
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FixedAsset.init(
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
      field: 'asset_code', // Map to database column name
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'asset_name', // Map to database column name
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'notes', // Map to database column name
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    acquisitionDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'purchase_date', // Map to database column name
    },
    acquisitionCost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      field: 'purchase_cost', // Map to database column name
    },
    usefulLife: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'useful_life_years', // Map to database column name
    },
    depreciationMethod: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'depreciation_method',
    },
    residualValue: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'salvage_value', // Map to database column name
    },
    accumulatedDepreciation: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'accumulated_depreciation',
    },
    bookValue: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      field: 'book_value',
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    serialNumber: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'serial_number',
    },
    registrationNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
      field: 'registration_number',
    },
    supplier: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    invoiceNumber: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'invoice_number',
    },
    warrantyExpiryDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'warranty_expiry_date',
    },
    insurancePolicyNumber: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'insurance_policy_number',
    },
    insuranceExpiryDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'insurance_expiry_date',
    },
    maintenanceSchedule: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'maintenance_schedule',
    },
    lastMaintenanceDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_maintenance_date',
    },
    nextMaintenanceDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'next_maintenance_date',
    },
    assignedTo: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'assigned_to',
    },
    purchaseOrderNumber: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'purchase_order_number',
    },
    disposalDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'disposal_date',
    },
    disposalValue: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      field: 'disposal_value',
    },
    disposalReason: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'disposal_reason',
    },
    depreciationStartDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'depreciation_start_date',
    },
    tags: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Payment fields
    paymentType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'payment_type',
    },
    bankAccountId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'bank_account_id',
    },
    cardId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'card_id',
    },
    chequeNumber: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'cheque_number',
    },
    chequeDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'cheque_date',
    },
    transferNumber: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'transfer_number',
    },
    transferDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'transfer_date',
    },
    paymentReference: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'payment_reference',
    },
    voucherDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'voucher_date',
    },
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'supplier_id',
    },
    supplierRnc: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'supplier_rnc',
    },
    ncf: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'fixed_assets',
    timestamps: true,
    underscored: true, // This converts createdAt -> created_at, updatedAt -> updated_at
  }
);

export default FixedAsset;
