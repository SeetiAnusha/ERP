/**
 * Enhanced Accounts Payable Service with Transaction Type Tracking
 * 
 * Extends the existing accounts payable functionality to support transaction type tracking
 * for identifying the source system of each transaction.
 */

import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database';
import AccountsPayable from '../models/AccountsPayable';
import { TransactionType } from '../types/TransactionType';
import { transactionTypeTracker, SourceSystem, DestinationTable } from './transactionTypeTracker';

/**
 * Enhanced accounts payable data interface
 */
export interface EnhancedAccountsPayableData {
  registrationNumber: string;
  registrationDate: Date;
  type: string;
  sourceTransactionType: TransactionType; // NEW FIELD
  relatedDocumentType: string;
  relatedDocumentId: number;
  relatedDocumentNumber: string;
  supplierId?: number;
  supplierName?: string;
  supplierRnc?: string;
  cardId?: number;
  cardIssuer?: string;
  ncf?: string;
  purchaseDate?: Date;
  purchaseType?: string;
  paymentType?: string;
  amount: number;
  paidAmount: number;
  balanceAmount: number;
  status: string;
  dueDate?: Date;
  paidDate?: Date;
  notes?: string;
}

/**
 * Analytics interface for transaction type reporting
 */
export interface AccountsPayableAnalytics {
  totalTransactions: number;
  totalAmount: number;
  totalPaidAmount: number;
  totalBalanceAmount: number;
  byTransactionType: Record<TransactionType, {
    count: number;
    amount: number;
    paidAmount: number;
    balanceAmount: number;
    percentage: number;
  }>;
  byStatus: Record<string, {
    count: number;
    amount: number;
  }>;
  dateRange: {
    from: Date;
    to: Date;
  };
}

/**
 * Enhanced Accounts Payable Service
 */
class EnhancedAccountsPayableService {
  
  /**
   * Create accounts payable entry with transaction type tracking
   * 
   * @param data - Accounts payable data
   * @param sourceSystem - Source system identifier
   * @returns Created accounts payable entry
   */
  static async createEntry(
    data: Omit<EnhancedAccountsPayableData, 'sourceTransactionType'>,
    sourceSystem: string
  ): Promise<AccountsPayable> {
    const transaction: Transaction = await sequelize.transaction();
    
    try {
      // Determine source transaction type
      const sourceTransactionType = transactionTypeTracker.assignTransactionType(sourceSystem);
      
      // Validate that this should go to accounts payable
      if (data.paymentType) {
        const destinationTable = transactionTypeTracker.determineDestinationTable(data.paymentType);
        if (destinationTable !== DestinationTable.ACCOUNTS_PAYABLE) {
          throw new Error(`Payment method ${data.paymentType} should not create accounts payable entry`);
        }
      }
      
      // Create the entry
      const accountsPayableEntry = await AccountsPayable.create({
        ...data,
        sourceTransactionType
      }, { transaction });
      
      await transaction.commit();
      return accountsPayableEntry;
      
    } catch (error) {
      await transaction.rollback();
      console.error('Error creating accounts payable entry:', error);
      throw error;
    }
  }
  
  /**
   * Create accounts payable entry from purchase transaction
   * 
   * @param purchaseData - Purchase transaction data
   * @returns Created accounts payable entry
   */
  static async createFromPurchase(purchaseData: {
    registrationNumber: string;
    date: Date;
    amount: number;
    paymentType: string;
    supplierId: number;
    supplierName: string;
    supplierRnc?: string;
    cardId?: number;
    cardIssuer?: string;
    ncf?: string;
    purchaseType?: string;
    dueDate?: Date;
    notes?: string;
  }): Promise<AccountsPayable> {
    
    const accountsPayableData: Omit<EnhancedAccountsPayableData, 'sourceTransactionType'> = {
      registrationNumber: purchaseData.registrationNumber,
      registrationDate: purchaseData.date,
      type: 'CREDIT_PURCHASE',
      relatedDocumentType: 'Purchase',
      relatedDocumentId: 0, // Will be set after purchase is created
      relatedDocumentNumber: purchaseData.registrationNumber,
      supplierId: purchaseData.supplierId,
      supplierName: purchaseData.supplierName,
      supplierRnc: purchaseData.supplierRnc,
      cardId: purchaseData.cardId,
      cardIssuer: purchaseData.cardIssuer,
      ncf: purchaseData.ncf,
      purchaseDate: purchaseData.date,
      purchaseType: purchaseData.purchaseType,
      paymentType: purchaseData.paymentType,
      amount: purchaseData.amount,
      paidAmount: 0,
      balanceAmount: purchaseData.amount,
      status: 'Pending',
      dueDate: purchaseData.dueDate,
      notes: purchaseData.notes
    };
    
    return this.createEntry(accountsPayableData, SourceSystem.PURCHASE_SYSTEM);
  }
  
  /**
   * Create accounts payable entry from business expense transaction
   * 
   * @param expenseData - Business expense transaction data
   * @returns Created accounts payable entry
   */
  static async createFromBusinessExpense(expenseData: {
    registrationNumber: string;
    date: Date;
    amount: number;
    paymentType: string;
    supplierId: number;
    supplierName: string;
    supplierRnc?: string;
    cardId?: number;
    cardIssuer?: string;
    description?: string;
    dueDate?: Date;
    notes?: string;
  }): Promise<AccountsPayable> {
    
    const accountsPayableData: Omit<EnhancedAccountsPayableData, 'sourceTransactionType'> = {
      registrationNumber: expenseData.registrationNumber,
      registrationDate: expenseData.date,
      type: 'CREDIT_EXPENSE',
      relatedDocumentType: 'BusinessExpense',
      relatedDocumentId: 0, // Will be set after expense is created
      relatedDocumentNumber: expenseData.registrationNumber,
      supplierId: expenseData.supplierId,
      supplierName: expenseData.supplierName,
      supplierRnc: expenseData.supplierRnc,
      cardId: expenseData.cardId,
      cardIssuer: expenseData.cardIssuer,
      purchaseDate: expenseData.date,
      paymentType: expenseData.paymentType,
      amount: expenseData.amount,
      paidAmount: 0,
      balanceAmount: expenseData.amount,
      status: 'Pending',
      dueDate: expenseData.dueDate,
      notes: expenseData.notes || expenseData.description
    };
    
    return this.createEntry(accountsPayableData, SourceSystem.BUSINESS_EXPENSE_SYSTEM);
  }
  
  /**
   * Get entries by transaction type
   * 
   * @param transactionType - Source transaction type to filter by
   * @param options - Query options
   * @returns Accounts payable entries
   */
  static async getEntriesByTransactionType(
    transactionType: TransactionType,
    options: {
      page?: number;
      limit?: number;
      status?: string;
      dateFrom?: Date;
      dateTo?: Date;
    } = {}
  ): Promise<{
    entries: AccountsPayable[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 50, status, dateFrom, dateTo } = options;
    const offset = (page - 1) * limit;
    
    const whereClause: any = {
      sourceTransactionType: transactionType
    };
    
    // Add status filter
    if (status) {
      whereClause.status = status;
    }
    
    // Add date range filter
    if (dateFrom || dateTo) {
      whereClause.registrationDate = {};
      if (dateFrom) whereClause.registrationDate[Op.gte] = dateFrom;
      if (dateTo) whereClause.registrationDate[Op.lte] = dateTo;
    }
    
    const { rows: entries, count: total } = await AccountsPayable.findAndCountAll({
      where: whereClause,
      order: [['registrationDate', 'DESC'], ['createdAt', 'DESC']],
      limit,
      offset
    });
    
    return {
      entries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
  
  /**
   * Get transaction type analytics
   * 
   * @param options - Analytics options
   * @returns Analytics data
   */
  static async getTransactionTypeAnalytics(options: {
    dateFrom?: Date;
    dateTo?: Date;
  } = {}): Promise<AccountsPayableAnalytics> {
    const { dateFrom, dateTo } = options;
    
    const whereClause: any = {};
    
    // Add date range filter
    if (dateFrom || dateTo) {
      whereClause.registrationDate = {};
      if (dateFrom) whereClause.registrationDate[Op.gte] = dateFrom;
      if (dateTo) whereClause.registrationDate[Op.lte] = dateTo;
    }
    
    // Get all entries for the period
    const entries = await AccountsPayable.findAll({
      where: whereClause,
      attributes: ['sourceTransactionType', 'status', 'amount', 'paidAmount', 'balanceAmount']
    });
    
    // Calculate totals
    const totalTransactions = entries.length;
    const totalAmount = entries.reduce((sum, entry) => 
      sum + parseFloat(entry.amount.toString()), 0
    );
    const totalPaidAmount = entries.reduce((sum, entry) => 
      sum + parseFloat(entry.paidAmount.toString()), 0
    );
    const totalBalanceAmount = entries.reduce((sum, entry) => 
      sum + parseFloat(entry.balanceAmount.toString()), 0
    );
    
    // Group by source transaction type
    const byTransactionType: Record<string, any> = {};
    
    Object.values(TransactionType).forEach(type => {
      const typeEntries = entries.filter(entry => entry.sourceTransactionType === type);
      const typeAmount = typeEntries.reduce((sum, entry) => 
        sum + parseFloat(entry.amount.toString()), 0
      );
      const typePaidAmount = typeEntries.reduce((sum, entry) => 
        sum + parseFloat(entry.paidAmount.toString()), 0
      );
      const typeBalanceAmount = typeEntries.reduce((sum, entry) => 
        sum + parseFloat(entry.balanceAmount.toString()), 0
      );
      
      byTransactionType[type] = {
        count: typeEntries.length,
        amount: typeAmount,
        paidAmount: typePaidAmount,
        balanceAmount: typeBalanceAmount,
        percentage: totalAmount > 0 ? (typeAmount / totalAmount) * 100 : 0
      };
    });
    
    // Group by status
    const byStatus: Record<string, { count: number; amount: number }> = {};
    const statuses = [...new Set(entries.map(entry => entry.status))];
    
    statuses.forEach(status => {
      const statusEntries = entries.filter(entry => entry.status === status);
      const statusAmount = statusEntries.reduce((sum, entry) => 
        sum + parseFloat(entry.amount.toString()), 0
      );
      
      byStatus[status] = {
        count: statusEntries.length,
        amount: statusAmount
      };
    });
    
    return {
      totalTransactions,
      totalAmount,
      totalPaidAmount,
      totalBalanceAmount,
      byTransactionType: byTransactionType as Record<TransactionType, any>,
      byStatus,
      dateRange: {
        from: dateFrom || new Date(0),
        to: dateTo || new Date()
      }
    };
  }
  
  /**
   * Get summary statistics by transaction type
   * 
   * @returns Summary statistics
   */
  static async getSummaryByTransactionType(): Promise<Record<TransactionType, {
    totalCount: number;
    totalAmount: number;
    totalBalance: number;
    avgAmount: number;
    lastTransaction: Date | null;
  }>> {
    const results: any = {};
    
    for (const transactionType of Object.values(TransactionType)) {
      const entries = await AccountsPayable.findAll({
        where: { sourceTransactionType: transactionType },
        attributes: ['amount', 'balanceAmount', 'registrationDate'],
        order: [['registrationDate', 'DESC']]
      });
      
      const totalCount = entries.length;
      const totalAmount = entries.reduce((sum, entry) => 
        sum + parseFloat(entry.amount.toString()), 0
      );
      const totalBalance = entries.reduce((sum, entry) => 
        sum + parseFloat(entry.balanceAmount.toString()), 0
      );
      const avgAmount = totalCount > 0 ? totalAmount / totalCount : 0;
      const lastTransaction = entries.length > 0 ? entries[0].registrationDate : null;
      
      results[transactionType] = {
        totalCount,
        totalAmount,
        totalBalance,
        avgAmount,
        lastTransaction
      };
    }
    
    return results;
  }
}

export default EnhancedAccountsPayableService;