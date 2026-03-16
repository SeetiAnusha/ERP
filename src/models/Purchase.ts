import { DataTypes, Model, Optional, Association, Op } from 'sequelize';
import sequelize from '../config/database';
import Supplier from './Supplier';

interface PurchaseAttributes {
  id: number;
  registrationNumber: string;
  registrationDate: Date;
  date: Date;
  supplierId: number;
  supplierRnc?: string;
  ncf?: string;
  purchaseType: string;
  paymentType: string;
  paymentStatus: string;
  productTotal: number;
  additionalExpenses: number;
  total: number;
  paidAmount: number;
  balanceAmount: number;
  totalWithAssociated?: number;
  status: string;
  // Payment method fields
  bankAccountId?: number;
  cardId?: number;
  chequeNumber?: string;
  chequeDate?: Date;
  transferNumber?: string;
  transferDate?: Date;
  paymentReference?: string;
  voucherDate?: Date;
  // Transaction type tracking (for analytics only)
  transactionType: 'GOODS'; // Only GOODS now, EXPENSE removed
  // Duplicate prevention fields
  requestId?: string;
  clientSessionId?: string;
  submissionTimestamp?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PurchaseCreationAttributes extends Optional<PurchaseAttributes, 'id' | 'transactionType'> {}

class Purchase extends Model<PurchaseAttributes, PurchaseCreationAttributes> implements PurchaseAttributes {
  public id!: number;
  public registrationNumber!: string;
  public registrationDate!: Date;
  public date!: Date;
  public supplierId!: number;
  public supplierRnc?: string;
  public ncf?: string;
  public purchaseType!: string;
  public paymentType!: string;
  public paymentStatus!: string;
  public productTotal!: number;
  public additionalExpenses!: number;
  public total!: number;
  public paidAmount!: number;
  public balanceAmount!: number;
  public totalWithAssociated?: number;
  public status!: string;
  // Payment method fields
  public bankAccountId?: number;
  public cardId?: number;
  public chequeNumber?: string;
  public chequeDate?: Date;
  public transferNumber?: string;
  public transferDate?: Date;
  public paymentReference?: string;
  public voucherDate?: Date;
  // Transaction type tracking (for analytics only)
  public transactionType!: 'GOODS';
  // Duplicate prevention fields
  public requestId?: string;
  public clientSessionId?: string;
  public submissionTimestamp?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public static associations: {
    supplier: Association<Purchase, Supplier>;
  };

  /**
   * Generate unique request ID for duplicate prevention
   * Time Complexity: O(1)
   */
  public static generateRequestId(): string {
    // Generate a proper UUID v4 format
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Check for duplicate submission within time window
   * Time Complexity: O(log n) - uses index on session and timestamp
   */
  public static async checkDuplicateSubmission(
    clientSessionId: string,
    amount: number,
    supplierId: number,
    timeWindowMinutes: number = 5
  ): Promise<Purchase | null> {
    const timeWindow = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
    
    return this.findOne({
      where: {
        clientSessionId,
        supplierId,
        total: amount,
        submissionTimestamp: {
          [Op.gte]: timeWindow
        }
      },
      order: [['submissionTimestamp', 'DESC']]
    });
  }
}

Purchase.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    registrationNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    registrationDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'suppliers',
        key: 'id',
      },
    },
    supplierRnc: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    ncf: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    purchaseType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'Merchandise for sale or consumption',
    },
    paymentType: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    paymentStatus: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'Unpaid',
    },
    productTotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    additionalExpenses: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total: {
      type: DataTypes.DECIMAL(15, 2),
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
    totalWithAssociated: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
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
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    chequeDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    transferNumber: {
      type: DataTypes.STRING(100),
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
    // Transaction type tracking (for analytics only)
    transactionType: {
      type: DataTypes.ENUM('GOODS'),
      allowNull: false,
      defaultValue: 'GOODS',
      validate: {
        isIn: {
          args: [['GOODS']],
          msg: 'Transaction type must be GOODS for purchases'
        }
      }
    },
    // Duplicate prevention fields
    requestId: {
      type: DataTypes.UUID,
      allowNull: true,
      unique: true,
      validate: {
        isUUID: {
          args: 4,
          msg: 'Request ID must be a valid UUID'
        }
      }
    },
    clientSessionId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: {
          args: [0, 100],
          msg: 'Client session ID cannot exceed 100 characters'
        }
      }
    },
    submissionTimestamp: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'purchases',
    timestamps: true,
    underscored: true,
    freezeTableName: true,
    indexes: [
      {
        fields: ['registration_number'],
        unique: true,
        name: 'unique_purchase_registration_number'
      },
      {
        fields: ['request_id'],
        unique: true,
        name: 'unique_purchase_request_id',
        where: {
          request_id: {
            [Op.ne]: null
          }
        }
      },
      {
        fields: ['supplier_id', 'date'],
        name: 'idx_purchases_supplier_date'
      },
      {
        fields: ['payment_status', 'transaction_type'],
        name: 'idx_purchases_payment_status_type'
      },
      {
        fields: ['client_session_id', 'submission_timestamp'],
        name: 'idx_purchases_session_timestamp'
      }
    ],
    hooks: {
      beforeValidate: async (purchase: Purchase) => {
        // Set submission timestamp if not already set
        if (!purchase.submissionTimestamp) {
          purchase.submissionTimestamp = new Date();
        }

        // Generate request ID if not provided (for duplicate prevention)
        if (!purchase.requestId) {
          purchase.requestId = Purchase.generateRequestId();
        }
      },
      beforeCreate: async (purchase: Purchase) => {
        // Check for duplicate submissions
        if (purchase.clientSessionId) {
          const duplicate = await Purchase.checkDuplicateSubmission(
            purchase.clientSessionId,
            purchase.total,
            purchase.supplierId
          );
          
          if (duplicate) {
            throw new Error('Duplicate submission detected. Please wait before submitting again.');
          }
        }
      }
    }
  }
);

// Associations will be set up in a separate file to avoid circular dependencies

export default Purchase;