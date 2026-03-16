/**
 * Enhanced Bank Register Service with Transaction Type Tracking
 * 
 * Extends the existing bank register functionality to support transaction type tracking
 * for identifying the source system of each transaction.
 */

import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database';
import BankRegister from '../models/BankRegister';
import { TransactionType } from '../types/TransactionType';
import { transactionTypeTracker, SourceSystem, DestinationTable } from './transactionTypeTracker';

/**
 * Enhanced bank register data interface
 */
export interface EnhancedBankRegisterData {
  registrationNumber: string;
  registrationDate: Date;
  transactionType: 'INFLOW' | 'OUTFLOW';
  sourceTransactionType: TransactionType; // NEW FIELD
  amount: number;
  paymentMethod: string;
  relatedDocumentType: string;
  relatedDocumentNumber: string;
  clientRnc?: string;
  clientName?: string;
  ncf?: string;
  description: string;
  balance: number;
  bankAccountId?: number;
  bankAccountName?: string;
  bankAccountNumber?: string;
  referenceNumber?: string;
  chequeNumber?: string;
  transferNumber?: string;
  supplierId?: number;
  invoiceIds?: string;
}

/**
 * Analytics interface for transaction type reporting
 */
export interface BankRegisterAnalytics {
  totalTransactions: number;
  totalAmount: number;
  byTransactionType: Record<TransactionType, {
    count: number;
    amount: number;
    percentage: number;
  }>;
  byFlowType: {
    inflow: { count: number; amount: number };
    outflow: { count: number; amount: number };
  };
  dateRange: {
    from: Date;
    to: Date;
  };
}

/**
 * Enhanced Bank Register Service
 */
class EnhancedBankRegisterService {
  
  /**
   * Create bank register entry with transaction type tracking
   * 
   * @param data - Bank register data
   * @param sourceSystem - Source system identifier
   * @returns Created bank register entry
   */
  static async createEntry(
    data: Omit<EnhancedBankRegisterData, 'sourceTransactionType'>,
    sourceSystem: string
  ): Promise<BankRegister> {
    const transaction: Transaction = await sequelize.transaction();
    
    try {
      // Determine source transaction type
      const sourceTransactionType = transactionTypeTracker.assignTransactionType(sourceSystem);
      
      // Validate that this should go to bank register
      const destinationTable = transactionTypeTracker.determineDestinationTable(data.paymentMethod);
      if (destinationTable !== DestinationTable.BANK_REGISTER) {
        throw new Error(`Payment method ${data.paymentMethod} should not create bank register entry`);
      }
      
      // Calculate new balance - get the last balance and update it
      const lastRegister = await BankRegister.findOne({
        where: data.bankAccountId ? { bankAccountId: data.bankAccountId } : {},
        order: [['id', 'DESC']],
        transaction
      });
      
      const lastBalance = lastRegister ? parseFloat(lastRegister.balance.toString()) : 0;
      const amount = parseFloat(data.amount.toString());
      const newBalance = data.transactionType === 'INFLOW' 
        ? lastBalance + amount
        : lastBalance - amount;
      
      // Validate sufficient balance for outflow transactions
      if (data.transactionType === 'OUTFLOW' && newBalance < 0) {
        const accountName = data.bankAccountId ? `Bank Account ID ${data.bankAccountId}` : 'Bank Account';
        throw new Error(
          `Insufficient balance in ${accountName}. ` +
          `Available: ${lastBalance.toFixed(2)}, ` +
          `Required: ${amount.toFixed(2)}. ` +
          `You need ${(amount - lastBalance).toFixed(2)} more.`
        );
      }
      
      // Create the entry with calculated balance
      const bankRegisterEntry = await BankRegister.create({
        ...data,
        balance: newBalance,
        sourceTransactionType
      }, { transaction });
      
      await transaction.commit();
      return bankRegisterEntry;
      
    } catch (error) {
      await transaction.rollback();
      console.error('Error creating bank register entry:', error);
      throw error;
    }
  }
  
  /**
   * Create bank register entry from purchase transaction
   * 
   * @param purchaseData - Purchase transaction data
   * @returns Created bank register entry
   */
  static async createFromPurchase(purchaseData: {
    registrationNumber: string;
    date: Date;
    amount: number;
    paymentMethod: string;
    supplierId: number;
    supplierName: string;
    supplierRnc?: string;
    description: string;
    bankAccountId?: number;
    chequeNumber?: string;
    transferNumber?: string;
  }): Promise<BankRegister> {
    
    const bankRegisterData: Omit<EnhancedBankRegisterData, 'sourceTransactionType'> = {
      registrationNumber: purchaseData.registrationNumber,
      registrationDate: purchaseData.date,
      transactionType: 'OUTFLOW',
      amount: purchaseData.amount,
      paymentMethod: purchaseData.paymentMethod,
      relatedDocumentType: 'Purchase',
      relatedDocumentNumber: purchaseData.registrationNumber,
      clientRnc: purchaseData.supplierRnc,
      clientName: purchaseData.supplierName,
      description: purchaseData.description,
      balance: 0, // Will be calculated by the system
      bankAccountId: purchaseData.bankAccountId,
      chequeNumber: purchaseData.chequeNumber,
      transferNumber: purchaseData.transferNumber,
      supplierId: purchaseData.supplierId
    };
    
    return this.createEntry(bankRegisterData, SourceSystem.PURCHASE_SYSTEM);
  }
  
  /**
   * Create bank register entry from business expense transaction
   * 
   * @param expenseData - Business expense transaction data
   * @returns Created bank register entry
   */
  static async createFromBusinessExpense(expenseData: {
    registrationNumber: string;
    date: Date;
    amount: number;
    paymentMethod: string;
    supplierId: number;
    supplierName: string;
    supplierRnc?: string;
    description: string;
    bankAccountId?: number;
    chequeNumber?: string;
    transferNumber?: string;
  }): Promise<BankRegister> {
    
    const bankRegisterData: Omit<EnhancedBankRegisterData, 'sourceTransactionType'> = {
      registrationNumber: expenseData.registrationNumber,
      registrationDate: expenseData.date,
      transactionType: 'OUTFLOW',
      amount: expenseData.amount,
      paymentMethod: expenseData.paymentMethod,
      relatedDocumentType: 'BusinessExpense',
      relatedDocumentNumber: expenseData.registrationNumber,
      clientRnc: expenseData.supplierRnc,
      clientName: expenseData.supplierName,
      description: expenseData.description,
      balance: 0, // Will be calculated by the system
      bankAccountId: expenseData.bankAccountId,
      chequeNumber: expenseData.chequeNumber,
      transferNumber: expenseData.transferNumber,
      supplierId: expenseData.supplierId
    };
    
    return this.createEntry(bankRegisterData, SourceSystem.BUSINESS_EXPENSE_SYSTEM);
  }
  
  /**
   * Get entries by transaction type
   * 
   * @param transactionType - Source transaction type to filter by
   * @param options - Query options
   * @returns Bank register entries
   */
  static async getEntriesByTransactionType(
    transactionType: TransactionType,
    options: {
      page?: number;
      limit?: number;
      dateFrom?: Date;
      dateTo?: Date;
    } = {}
  ): Promise<{
    entries: BankRegister[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 50, dateFrom, dateTo } = options;
    const offset = (page - 1) * limit;
    
    const whereClause: any = {
      sourceTransactionType: transactionType
    };
    
    // Add date range filter
    if (dateFrom || dateTo) {
      whereClause.registrationDate = {};
      if (dateFrom) whereClause.registrationDate[Op.gte] = dateFrom;
      if (dateTo) whereClause.registrationDate[Op.lte] = dateTo;
    }
    
    const { rows: entries, count: total } = await BankRegister.findAndCountAll({
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
  } = {}): Promise<BankRegisterAnalytics> {
    const { dateFrom, dateTo } = options;
    
    const whereClause: any = {};
    
    // Add date range filter
    if (dateFrom || dateTo) {
      whereClause.registrationDate = {};
      if (dateFrom) whereClause.registrationDate[Op.gte] = dateFrom;
      if (dateTo) whereClause.registrationDate[Op.lte] = dateTo;
    }
    
    // Get all entries for the period
    const entries = await BankRegister.findAll({
      where: whereClause,
      attributes: ['sourceTransactionType', 'transactionType', 'amount']
    });
    
    // Calculate totals
    const totalTransactions = entries.length;
    const totalAmount = entries.reduce((sum, entry) => 
      sum + parseFloat(entry.amount.toString()), 0
    );
    
    // Group by source transaction type
    const byTransactionType: Record<string, { count: number; amount: number; percentage: number }> = {};
    
    Object.values(TransactionType).forEach(type => {
      const typeEntries = entries.filter(entry => entry.sourceTransactionType === type);
      const typeAmount = typeEntries.reduce((sum, entry) => 
        sum + parseFloat(entry.amount.toString()), 0
      );
      
      byTransactionType[type] = {
        count: typeEntries.length,
        amount: typeAmount,
        percentage: totalAmount > 0 ? (typeAmount / totalAmount) * 100 : 0
      };
    });
    
    // Group by flow type
    const inflowEntries = entries.filter(entry => entry.transactionType === 'INFLOW');
    const outflowEntries = entries.filter(entry => entry.transactionType === 'OUTFLOW');
    
    const byFlowType = {
      inflow: {
        count: inflowEntries.length,
        amount: inflowEntries.reduce((sum, entry) => 
          sum + parseFloat(entry.amount.toString()), 0
        )
      },
      outflow: {
        count: outflowEntries.length,
        amount: outflowEntries.reduce((sum, entry) => 
          sum + parseFloat(entry.amount.toString()), 0
        )
      }
    };
    
    return {
      totalTransactions,
      totalAmount,
      byTransactionType: byTransactionType as Record<TransactionType, { count: number; amount: number; percentage: number }>,
      byFlowType,
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
    avgAmount: number;
    lastTransaction: Date | null;
  }>> {
    const results: any = {};
    
    for (const transactionType of Object.values(TransactionType)) {
      const entries = await BankRegister.findAll({
        where: { sourceTransactionType: transactionType },
        attributes: ['amount', 'registrationDate'],
        order: [['registrationDate', 'DESC']]
      });
      
      const totalCount = entries.length;
      const totalAmount = entries.reduce((sum, entry) => 
        sum + parseFloat(entry.amount.toString()), 0
      );
      const avgAmount = totalCount > 0 ? totalAmount / totalCount : 0;
      const lastTransaction = entries.length > 0 ? entries[0].registrationDate : null;
      
      results[transactionType] = {
        totalCount,
        totalAmount,
        avgAmount,
        lastTransaction
      };
    }
    
    return results;
  }
}

export default EnhancedBankRegisterService;