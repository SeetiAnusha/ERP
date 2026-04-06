import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import Supplier from './Supplier';
import ExpenseCategory from './ExpenseCategory';
import ExpenseType from './ExpenseType';
import BankAccount from './BankAccount';
import Card from './Card';

interface BusinessExpenseAttributes {
  id: number;
  registrationNumber: string;
  date: Date;
  supplierId?: number | null;  // ✅ Made optional for client-related expenses
  supplierRnc?: string;
  
  // ✅ NEW: Client-related fields for processing fees
  clientId?: number | null;
  clientRnc?: string;
  
  expenseCategoryId?: number;  // ✅ Made optional
  expenseTypeId?: number;  // ✅ Made optional
  description?: string;
  amount: number;
  expenseType: string;
  paymentType: string;
  paidAmount: number;
  balanceAmount: number;
  status: string;
  paymentStatus: string;
  
  // ✅ NEW: Card network reference for processing fees
  cardPaymentNetworkId?: number | null;
  
  // ✅ NEW: Related AR reference for traceability
  relatedARId?: number | null;
  relatedDocumentType?: string;
  relatedDocumentNumber?: string;
  
  // Payment method specific fields
  bankAccountId?: number;
  cardId?: number;
  chequeNumber?: string;
  chequeDate?: Date;
  transferNumber?: string;
  transferDate?: Date;
  paymentReference?: string;
  voucherDate?: Date;
  
  // ✅ NEW: Deletion tracking fields
  deletion_status?: string;
  deleted_at?: Date;
  deleted_by?: number;
  deletion_reason_code?: string;
  deletion_memo?: string;
  deletion_approval_id?: number;
  
  createdAt?: Date;
  updatedAt?: Date;
}

interface BusinessExpenseCreationAttributes extends Optional<BusinessExpenseAttributes, 'id'> {}

class BusinessExpense extends Model<BusinessExpenseAttributes, BusinessExpenseCreationAttributes> implements BusinessExpenseAttributes {
  public id!: number;
  public registrationNumber!: string;
  public date!: Date;
  public supplierId?: number | null;  // ✅ Made optional
  public supplierRnc?: string;
  
  // ✅ NEW: Client-related fields
  public clientId?: number | null;
  public clientRnc?: string;
  
  public expenseCategoryId?: number;  // ✅ Made optional
  public expenseTypeId?: number;  // ✅ Made optional
  public description?: string;
  public amount!: number;
  public expenseType!: string;
  public paymentType!: string;
  public paidAmount!: number;
  public balanceAmount!: number;
  public status!: string;
  public paymentStatus!: string;
  
  // ✅ NEW: Card network and AR references
  public cardPaymentNetworkId?: number | null;
  public relatedARId?: number | null;
  public relatedDocumentType?: string;
  public relatedDocumentNumber?: string;
  
  // Payment method specific fields
  public bankAccountId?: number;
  public cardId?: number;
  public chequeNumber?: string;
  public chequeDate?: Date;
  public transferNumber?: string;
  public transferDate?: Date;
  public paymentReference?: string;
  public voucherDate?: Date;
  
  // ✅ NEW: Deletion tracking fields (same as other models)
  public deletion_status?: string;
  public deleted_at?: Date;
  public deleted_by?: number;
  public deletion_reason_code?: string;
  public deletion_memo?: string;
  public deletion_approval_id?: number;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public supplier?: any;
  public client?: any;  // ✅ NEW
  public expenseCategory?: any;
  public expenseTypeModel?: any;
  public bankAccount?: any;
  public card?: any;
  public cardNetwork?: any;  // ✅ NEW
  public relatedAR?: any;  // ✅ NEW
  public associatedCosts?: any[];
}

BusinessExpense.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    registrationNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: false, // Changed from true - allow same registration number for AR and its processing fee
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: true,  // ✅ Changed from false - allow null for client-related expenses
      references: {
        model: 'suppliers',
        key: 'id',
      },
    },
    supplierRnc: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    // ✅ NEW: Client-related fields for processing fees
    clientId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'client_id',  // ✅ Map to snake_case column name
      references: {
        model: 'clients',
        key: 'id',
      },
    },
    clientRnc: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'client_rnc',  // ✅ Map to snake_case column name
    },
    // ✅ NEW: Card network reference
    cardPaymentNetworkId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'card_payment_network_id',  // ✅ Map to snake_case column name
      references: {
        model: 'card_payment_networks',
        key: 'id',
      },
    },
    // ✅ NEW: Related AR reference for traceability
    relatedARId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'related_ar_id',  // ✅ Map to snake_case column name
      references: {
        model: 'accounts_receivable',
        key: 'id',
      },
    },
    relatedDocumentType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'related_document_type',  // ✅ Map to snake_case column name
    },
    relatedDocumentNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'related_document_number',  // ✅ Map to snake_case column name
    },
    expenseCategoryId: {
      type: DataTypes.INTEGER,
      allowNull: true,  // ✅ Made optional for processing fees
      references: {
        model: 'expense_categories',
        key: 'id',
      },
    },
    expenseTypeId: {
      type: DataTypes.INTEGER,
      allowNull: true,  // ✅ Made optional for processing fees
      references: {
        model: 'expense_types',
        key: 'id',
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    expenseType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'Services or other',
    },
    paymentType: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    paidAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    balanceAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'COMPLETED',
    },
    paymentStatus: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'Unpaid',
    },
    
    // Payment method specific fields
    bankAccountId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'bank_accounts',
        key: 'id',
      },
    },
    cardId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'cards',
        key: 'id',
      },
    },
    chequeNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    chequeDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    transferNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    transferDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    paymentReference: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    voucherDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    
    // ✅ NEW: Deletion tracking fields
    deletion_status: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deleted_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    deletion_reason_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    deletion_memo: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    deletion_approval_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'business_expenses',
    timestamps: true,
    validate: {
      // ✅ Ensure either supplierId OR clientId is present (not both, not neither)
      supplierOrClient() {
        if (!this.supplierId && !this.clientId) {
          throw new Error('Either supplierId or clientId must be provided');
        }
        if (this.supplierId && this.clientId) {
          throw new Error('Cannot have both supplierId and clientId - expense must be either supplier-related or client-related');
        }
      }
    },
    indexes: [
      {
        fields: ['date'],
      },
      {
        fields: ['supplier_id'],
      },
      {
        fields: ['client_id'],  // ✅ NEW index
      },
      {
        fields: ['card_payment_network_id'],  // ✅ NEW index
      },
      {
        fields: ['related_ar_id'],  // ✅ NEW index
      },
      {
        fields: ['expense_category_id'],
      },
      {
        fields: ['payment_status'],
      },
    ],
  }
);

// Define associations
BusinessExpense.belongsTo(Supplier, { foreignKey: 'supplierId', as: 'supplier' });
BusinessExpense.belongsTo(ExpenseCategory, { foreignKey: 'expenseCategoryId', as: 'expenseCategory' });
BusinessExpense.belongsTo(ExpenseType, { foreignKey: 'expenseTypeId', as: 'expenseTypeModel' });
BusinessExpense.belongsTo(BankAccount, { foreignKey: 'bankAccountId', as: 'bankAccount' });
BusinessExpense.belongsTo(Card, { foreignKey: 'cardId', as: 'card' });

// ✅ NEW: Client-related associations
// Note: These will be set up after Client model is imported to avoid circular dependencies
// BusinessExpense.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });
// BusinessExpense.belongsTo(CardPaymentNetwork, { foreignKey: 'cardPaymentNetworkId', as: 'cardNetwork' });
// BusinessExpense.belongsTo(AccountsReceivable, { foreignKey: 'relatedARId', as: 'relatedAR' });

// NOTE: BusinessExpenseAssociatedCost association is handled in businessExpenseAssociations.ts
// to avoid circular dependency issues

export default BusinessExpense;