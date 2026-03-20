/**
 * Enterprise-Grade Bank Register Service
 * 
 * Unified service combining basic operations with enhanced features:
 * - Transaction type tracking for audit trails
 * - Analytics and reporting capabilities
 * - Class-based architecture with validation framework
 * - Error handling and retry mechanisms
 * - Source system identification
 * - Payment processing with balance validation
 * - Cheque and transfer number auto-generation
 */

import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database';
import BankRegister from '../models/BankRegister';
import BankAccount from '../models/BankAccount';
import AccountsPayable from '../models/AccountsPayable';
import { TransactionType } from '../types/TransactionType';
import { transactionTypeTracker, SourceSystem, DestinationTable } from './transactionTypeTracker';
import { BaseService } from '../core/BaseService';
import { 
  ValidationError, 
  InsufficientBalanceError, 
  BusinessLogicError, 
  NotFoundError 
} from '../core/AppError';

/**
 * Interfaces for type safety and documentation
 */
interface CreateBankRegisterRequest {
  registrationDate?: Date;
  transactionType: 'INFLOW' | 'OUTFLOW';
  sourceTransactionType?: TransactionType;
  amount: number;
  paymentMethod: string;
  relatedDocumentType: string;
  relatedDocumentNumber: string;
  clientRnc?: string;
  clientName?: string;
  ncf?: string;
  description: string;
  bankAccountId?: number;
  bankAccountName?: string;
  bankAccountNumber?: string;
  referenceNumber?: string;
  chequeNumber?: string;
  transferNumber?: string;
  supplierId?: number;
  invoiceIds?: string;
}

interface BankRegisterAnalytics {
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
interface PendingAPInvoice {
  id: number;
  registrationNumber: string;
  amount: number;
  balanceAmount: number;
  invoiceDate: Date;
  description: string;
  invoiceNumber: string;
  ncf?: string;
  supplierRnc?: string;
  purchaseType?: string;
  paymentType: string;
  type: string;
  relatedDocumentType: string;
}

/**
 * Unified Bank Register Service Class
 * 
 * Features:
 * - Enterprise-grade class-based architecture
 * - Comprehensive validation and error handling
 * - Transaction management with rollback protection
 * - Payment processing with balance validation
 * - Analytics and reporting capabilities
 * - Source system tracking
 * - Auto-generation of cheque and transfer numbers
 */
class BankRegisterService extends BaseService {
  
  // ==================== PUBLIC API METHODS ====================
  
  /**
   * Get all bank registers with optional filtering
   * Time Complexity: O(n) where n = number of records
   * Space Complexity: O(n) for result set
   */
  async getAllBankRegisters(): Promise<BankRegister[]> {
    return this.executeWithRetry(async () => {
      console.log('🔍 Service: getAllBankRegisters called');
      
      const registers = await BankRegister.findAll({
        order: [['registrationDate', 'DESC']],
      });
      
      console.log(`✅ Retrieved ${registers.length} bank registers successfully`);
      return registers;
    });
  }

  /**
   * Get bank register by ID with validation
   * Time Complexity: O(1) for primary key lookup
   * Space Complexity: O(1) for single record
   */
  async getBankRegisterById(id: number): Promise<BankRegister> {
    return this.executeWithRetry(async () => {
      this.validateNumeric(id, 'Bank Register ID', { min: 1 });
      
      const register = await BankRegister.findByPk(id);
      if (!register) {
        throw new NotFoundError(`Bank register with ID ${id} not found`);
      }
      
      return register;
    });
  }

  /**
   * Get pending AP invoices for a supplier
   * Time Complexity: O(n) where n = number of pending invoices
   * Space Complexity: O(n) for result transformation
   */
  async getPendingAPInvoices(supplierId: number): Promise<PendingAPInvoice[]> {
    return this.executeWithRetry(async () => {
      this.validateNumeric(supplierId, 'Supplier ID', { min: 1 });
      
      const pendingInvoices = await AccountsPayable.findAll({
        where: {
          supplierId,
          status: {
            [Op.in]: ['Pending', 'Partial']
          }
        },
        order: [['registrationDate', 'ASC']]
      });
      
      // Transform the data to include invoice details for frontend display
      return pendingInvoices.map(ap => ({
        id: ap.id,
        registrationNumber: ap.registrationNumber,
        amount: ap.amount,
        balanceAmount: ap.balanceAmount,
        invoiceDate: ap.purchaseDate || ap.registrationDate,
        description: `${ap.relatedDocumentType} - ${ap.relatedDocumentNumber}${ap.ncf ? ` (NCF: ${ap.ncf})` : ''}${ap.supplierRnc ? ` - RNC: ${ap.supplierRnc}` : ''} - ${ap.purchaseType || 'Purchase'}`,
        invoiceNumber: ap.relatedDocumentNumber,
        ncf: ap.ncf,
        supplierRnc: ap.supplierRnc,
        purchaseType: ap.purchaseType,
        paymentType: ap.paymentType || 'Unknown',
        type: ap.type,
        relatedDocumentType: ap.relatedDocumentType
      }));
    });
  }
  /**
   * Auto-generate cheque number for a bank account
   * Time Complexity: O(1) for single query with index
   * Space Complexity: O(1) for number generation
   */
  private async generateChequeNumber(bankAccountId: number): Promise<string> {
    const lastCheque = await BankRegister.findOne({
      where: { 
        bankAccountId,
        chequeNumber: { [Op.ne]: null }
      },
      order: [['id', 'DESC']]
    });
    
    const nextNumber = lastCheque && lastCheque.chequeNumber
      ? parseInt(lastCheque.chequeNumber.replace('CK', '')) + 1
      : 1;
      
    return `CK${nextNumber.toString().padStart(4, '0')}`;
  }

  /**
   * Auto-generate transfer number for a bank account
   * Time Complexity: O(1) for single query with index
   * Space Complexity: O(1) for number generation
   */
  private async generateTransferNumber(bankAccountId: number): Promise<string> {
    const lastTransfer = await BankRegister.findOne({
      where: { 
        bankAccountId,
        transferNumber: { [Op.ne]: null }
      },
      order: [['id', 'DESC']]
    });
    
    const nextNumber = lastTransfer && lastTransfer.transferNumber
      ? parseInt(lastTransfer.transferNumber.replace('TF', '')) + 1
      : 1;
      
    return `TF${nextNumber.toString().padStart(4, '0')}`;
  }

  /**
   * Generate registration number for bank register entry
   * Time Complexity: O(1) for single query with index
   * Space Complexity: O(1) for number generation
   */
  private async generateBankRegistrationNumber(transaction?: Transaction): Promise<string> {
    const lastRegister = await BankRegister.findOne({
      where: { registrationNumber: { [Op.like]: 'BR%' } },
      order: [['id', 'DESC']],
      transaction
    });
    
    let nextNumber = 1;
    if (lastRegister) {
      const lastNumber = parseInt(lastRegister.registrationNumber.substring(2));
      nextNumber = lastNumber + 1;
    }
    
    return `BR${String(nextNumber).padStart(4, '0')}`;
  }

  /**
   * Calculate new balance based on transaction type
   * Time Complexity: O(1) for balance calculation
   * Space Complexity: O(1) for numeric operations
   */
  private async calculateNewBalance(
    bankAccountId: number | undefined,
    amount: number,
    transactionType: 'INFLOW' | 'OUTFLOW',
    transaction?: Transaction
  ): Promise<number> {
    const lastRegister = await BankRegister.findOne({
      where: bankAccountId ? { bankAccountId } : {},
      order: [['id', 'DESC']],
      transaction
    });
    
    const lastBalance = lastRegister ? parseFloat(lastRegister.balance.toString()) : 0;
    const transactionAmount = parseFloat(amount.toString());
    
    return transactionType === 'INFLOW' 
      ? lastBalance + transactionAmount
      : lastBalance - transactionAmount;
  }
  /**
   * Process AP invoice payments for cheque and transfer methods
   * Time Complexity: O(n) where n = number of invoices
   * Space Complexity: O(1) for payment processing
   */
  private async processAPInvoicePayments(
    supplierId: number | undefined,
    invoiceIds: string | undefined,
    amount: number,
    transaction: Transaction
  ): Promise<void> {
    if (!supplierId || !invoiceIds) return;
    
    const invoiceIdsArray = JSON.parse(invoiceIds);
    
    // If there's only one invoice, pay the full amount to that invoice
    if (invoiceIdsArray.length === 1) {
      const apInvoice = await AccountsPayable.findByPk(invoiceIdsArray[0], { transaction });
      if (apInvoice) {
        const currentPaidAmount = parseFloat(apInvoice.paidAmount.toString());
        const paymentAmount = amount;
        const newPaidAmount = currentPaidAmount + paymentAmount;
        const totalAmount = parseFloat(apInvoice.amount.toString());
        const newBalanceAmount = totalAmount - newPaidAmount;
        const status = newBalanceAmount <= 0.01 ? 'Paid' : 'Partial';
        
        await apInvoice.update({
          paidAmount: newPaidAmount,
          balanceAmount: Math.max(0, newBalanceAmount),
          status,
        }, { transaction });
      }
    } else {
      // Multiple invoices - distribute amount proportionally
      for (const invoiceId of invoiceIdsArray) {
        const apInvoice = await AccountsPayable.findByPk(invoiceId, { transaction });
        if (apInvoice) {
          const paidAmount = parseFloat(apInvoice.paidAmount.toString()) + amount;
          const balanceAmount = parseFloat(apInvoice.amount.toString()) - paidAmount;
          const status = balanceAmount <= 0 ? 'Paid' : 'Partial';
          
          await apInvoice.update({
            paidAmount,
            balanceAmount,
            status,
          }, { transaction });
        }
      }
    }
  }

  /**
   * Process INFLOW transactions (money coming into bank account)
   * Time Complexity: O(1) for single transaction processing
   * Space Complexity: O(1) for transaction data
   */
  private async processInflowTransaction(
    data: CreateBankRegisterRequest,
    registrationNumber: string,
    newBalance: number,
    transaction: Transaction
  ): Promise<BankRegister> {
    // Validate INFLOW payment methods
    const allowedInflowMethods = ['CHEQUE', 'BANK_TRANSFER', 'DEPOSIT', 'CASH', 'BANK_CREDIT', 'CORRECTION'];
    if (!allowedInflowMethods.includes(data.paymentMethod)) {
      throw new ValidationError(`INFLOW only allows these payment methods: ${allowedInflowMethods.join(', ')}`);
    }
    
    let chequeNumber = null;
    let transferNumber = null;
    
    // Generate numbers for specific payment methods
    if (data.paymentMethod === 'CHEQUE' && data.bankAccountId) {
      chequeNumber = data.chequeNumber || await this.generateChequeNumber(data.bankAccountId);
    }
    
    if (data.paymentMethod === 'BANK_TRANSFER' && data.bankAccountId) {
      transferNumber = data.transferNumber || await this.generateTransferNumber(data.bankAccountId);
    }
    
    // Create bank register entry
    const bankRegister = await BankRegister.create({
      ...data,
      registrationNumber,
      balance: newBalance,
      chequeNumber,
      transferNumber,
    }, { transaction });
    
    // Update bank account balance (INFLOW increases balance)
    if (data.bankAccountId) {
      const bankAccount = await BankAccount.findByPk(data.bankAccountId, { transaction });
      if (bankAccount) {
        const amount = parseFloat(data.amount.toString());
        const newBankBalance = parseFloat(bankAccount.balance.toString()) + amount;
        await bankAccount.update({ balance: newBankBalance }, { transaction });
      }
    }
    
    return bankRegister;
  }
  /**
   * Process OUTFLOW transactions (money going out of bank account)
   * Time Complexity: O(n) where n = number of invoices to process
   * Space Complexity: O(1) for transaction data
   */
  private async processOutflowTransaction(
    data: CreateBankRegisterRequest,
    registrationNumber: string,
    newBalance: number,
    transaction: Transaction
  ): Promise<BankRegister> {
    // Validate bank account and sufficient balance
    if (!data.bankAccountId) {
      throw new ValidationError('Bank Account selection is required for OUTFLOW transactions');
    }
    
    const bankAccount = await BankAccount.findByPk(data.bankAccountId, { transaction });
    if (!bankAccount) {
      throw new NotFoundError('Bank Account not found');
    }
    
    // Check sufficient balance
    const currentBankBalance = parseFloat(bankAccount.balance.toString());
    const outflowAmount = parseFloat(data.amount.toString());
    
    if (currentBankBalance < outflowAmount) {
      throw new InsufficientBalanceError(
        `Insufficient balance in bank account "${bankAccount.bankName} - ${bankAccount.accountNumber}". ` +
        `Available: ${currentBankBalance.toFixed(2)}, Required: ${outflowAmount.toFixed(2)}. ` +
        `Cannot perform transaction that would result in negative balance.`
      );
    }
    
    let chequeNumber = null;
    let transferNumber = null;
    
    // Generate numbers and process AP payments for specific payment methods
    if (data.paymentMethod === 'CHEQUE') {
      chequeNumber = await this.generateChequeNumber(data.bankAccountId);
      await this.processAPInvoicePayments(data.supplierId, data.invoiceIds, outflowAmount, transaction);
    }
    
    if (data.paymentMethod === 'BANK_TRANSFER') {
      transferNumber = await this.generateTransferNumber(data.bankAccountId);
      await this.processAPInvoicePayments(data.supplierId, data.invoiceIds, outflowAmount, transaction);
    }
    
    // Create bank register entry
    const bankRegister = await BankRegister.create({
      ...data,
      registrationNumber,
      balance: newBalance,
      chequeNumber,
      transferNumber,
    }, { transaction });
    
    // Update bank account balance (OUTFLOW decreases balance)
    const newBankBalance = currentBankBalance - outflowAmount;
    await bankAccount.update({ balance: newBankBalance }, { transaction });
    
    return bankRegister;
  }

  /**
   * Create bank register entry with comprehensive validation and transaction management
   * Time Complexity: O(n) where n = number of invoices to process
   * Space Complexity: O(1) for transaction data
   */
  async createBankRegister(data: CreateBankRegisterRequest, externalTransaction?: Transaction): Promise<BankRegister> {
    return this.executeWithTransaction(async (transaction) => {
      console.log('🏦 Service: createBankRegister called with data:', {
        transactionType: data.transactionType,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        bankAccountId: data.bankAccountId
      });
      
      // Validate required fields
      this.validateRequired(data, ['transactionType', 'paymentMethod'], 'Bank Register');
      this.validateNumeric(data.amount, 'Amount', { min: 0.01 });
      
      // Validate transaction type
      if (!['INFLOW', 'OUTFLOW'].includes(data.transactionType)) {
        throw new ValidationError('Transaction type must be either INFLOW or OUTFLOW');
      }
      
      // Generate registration number
      const registrationNumber = await this.generateBankRegistrationNumber(transaction);
      
      // Calculate new balance
      const newBalance = await this.calculateNewBalance(
        data.bankAccountId,
        data.amount,
        data.transactionType,
        transaction
      );
      
      // Process based on transaction type
      let result: BankRegister;
      
      if (data.transactionType === 'INFLOW') {
        result = await this.processInflowTransaction(data, registrationNumber, newBalance, transaction);
      } else {
        result = await this.processOutflowTransaction(data, registrationNumber, newBalance, transaction);
      }
      
      console.log('✅ Bank register entry created successfully:', result.registrationNumber);
      return result;
      
    }, externalTransaction);
  }
  /**
   * Create bank register entry with transaction type tracking
   * Time Complexity: O(n) where n = number of invoices to process
   * Space Complexity: O(1) for transaction data
   */
  async createEntryWithTransactionType(
    data: Omit<CreateBankRegisterRequest, 'sourceTransactionType'>,
    sourceSystem: string
  ): Promise<BankRegister> {
    return this.executeWithTransaction(async (transaction) => {
      // Determine source transaction type
      const sourceTransactionType = transactionTypeTracker.assignTransactionType(sourceSystem);
      
      // Validate that this should go to bank register
      const destinationTable = transactionTypeTracker.determineDestinationTable(data.paymentMethod);
      if (destinationTable !== DestinationTable.BANK_REGISTER) {
        throw new ValidationError(`Payment method ${data.paymentMethod} should not create bank register entry`);
      }
      
      // Create entry with source transaction type
      const entryData: CreateBankRegisterRequest = {
        ...data,
        sourceTransactionType
      };
      
      return this.createBankRegister(entryData, transaction);
    });
  }

  /**
   * Create bank register entry from purchase transaction
   * Time Complexity: O(n) where n = number of invoices to process
   * Space Complexity: O(1) for transaction data
   */
  async createFromPurchase(purchaseData: {
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
    
    const bankRegisterData: Omit<CreateBankRegisterRequest, 'sourceTransactionType'> = {
      registrationDate: purchaseData.date,
      transactionType: 'OUTFLOW',
      amount: purchaseData.amount,
      paymentMethod: purchaseData.paymentMethod,
      relatedDocumentType: 'Purchase',
      relatedDocumentNumber: purchaseData.registrationNumber,
      clientRnc: purchaseData.supplierRnc,
      clientName: purchaseData.supplierName,
      description: purchaseData.description,
      bankAccountId: purchaseData.bankAccountId,
      chequeNumber: purchaseData.chequeNumber,
      transferNumber: purchaseData.transferNumber,
      supplierId: purchaseData.supplierId
    };
    
    return this.createEntryWithTransactionType(bankRegisterData, SourceSystem.PURCHASE_SYSTEM);
  }

  /**
   * Create bank register entry from business expense transaction
   * Time Complexity: O(n) where n = number of invoices to process
   * Space Complexity: O(1) for transaction data
   */
  async createFromBusinessExpense(expenseData: {
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
    
    const bankRegisterData: Omit<CreateBankRegisterRequest, 'sourceTransactionType'> = {
      registrationDate: expenseData.date,
      transactionType: 'OUTFLOW',
      amount: expenseData.amount,
      paymentMethod: expenseData.paymentMethod,
      relatedDocumentType: 'BusinessExpense',
      relatedDocumentNumber: expenseData.registrationNumber,
      clientRnc: expenseData.supplierRnc,
      clientName: expenseData.supplierName,
      description: expenseData.description,
      bankAccountId: expenseData.bankAccountId,
      chequeNumber: expenseData.chequeNumber,
      transferNumber: expenseData.transferNumber,
      supplierId: expenseData.supplierId
    };
    
    return this.createEntryWithTransactionType(bankRegisterData, SourceSystem.BUSINESS_EXPENSE_SYSTEM);
  }
  /**
   * Get entries by transaction type with pagination
   * Time Complexity: O(n) where n = number of matching records
   * Space Complexity: O(n) for result set
   */
  async getEntriesByTransactionType(
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
    return this.executeWithRetry(async () => {
      const { page = 1, limit = 50, dateFrom, dateTo } = options;
      const offset = (page - 1) * limit;
      
      // Validate pagination parameters
      this.validateNumeric(page, 'Page', { min: 1 });
      this.validateNumeric(limit, 'Limit', { min: 1, max: 1000 });
      
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
    });
  }

  /**
   * Get transaction type analytics with comprehensive reporting
   * Time Complexity: O(n) where n = number of records in date range
   * Space Complexity: O(1) for analytics aggregation
   */
  async getTransactionTypeAnalytics(options: {
    dateFrom?: Date;
    dateTo?: Date;
  } = {}): Promise<BankRegisterAnalytics> {
    return this.executeWithRetry(async () => {
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
    });
  }
  /**
   * Get summary statistics by transaction type
   * Time Complexity: O(n * t) where n = records per type, t = number of types
   * Space Complexity: O(t) for summary data
   */
  async getSummaryByTransactionType(): Promise<Record<TransactionType, {
    totalCount: number;
    totalAmount: number;
    avgAmount: number;
    lastTransaction: Date | null;
  }>> {
    return this.executeWithRetry(async () => {
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
    });
  }

  /**
   * Delete bank register entry with validation
   * Time Complexity: O(1) for single record deletion
   * Space Complexity: O(1) for operation
   */
  async deleteBankRegister(id: number): Promise<{ message: string }> {
    return this.executeWithRetry(async () => {
      this.validateNumeric(id, 'Bank Register ID', { min: 1 });
      
      const register = await BankRegister.findByPk(id);
      if (!register) {
        throw new NotFoundError(`Bank register entry with ID ${id} not found`);
      }
      
      await register.destroy();
      
      console.log(`✅ Bank register entry ${id} deleted successfully`);
      return { message: 'Bank register entry deleted successfully' };
    });
  }
}

// Create singleton instance
const bankRegisterService = new BankRegisterService();

// Export both class and instance for flexibility
export { BankRegisterService };
export default bankRegisterService;

// ==================== BACKWARD COMPATIBILITY EXPORTS ====================
// Maintain compatibility with existing functional exports

export const getAllBankRegisters = () => bankRegisterService.getAllBankRegisters();
export const getBankRegisterById = (id: number) => bankRegisterService.getBankRegisterById(id);
export const getPendingAPInvoices = (supplierId: number) => bankRegisterService.getPendingAPInvoices(supplierId);
export const createBankRegister = (data: any, externalTransaction?: Transaction) => 
  bankRegisterService.createBankRegister(data, externalTransaction);
export const deleteBankRegister = (id: number) => bankRegisterService.deleteBankRegister(id);