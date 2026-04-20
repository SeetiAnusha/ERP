/**
 * Enterprise-Grade Credit Card Register Service
 * 
 * Handles all credit card transaction recording and management:
 * - Credit card charges and refunds
 * - Credit limit tracking and validation
 * - Transaction history and reporting
 * - Integration with Accounts Payable payments
 * - Soft delete and audit trail support
 */

import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database';
import CreditCardRegister from '../models/CreditCardRegister';
import { TransactionType } from '../types/TransactionType';
import { BaseService } from '../core/BaseService';
import { 
  ValidationError, 
  InsufficientBalanceError, 
  BusinessLogicError, 
  NotFoundError 
} from '../core/AppError';

/**
 * Interfaces for type safety
 */
interface CreateCreditCardRegisterRequest {
  transactionType: 'CHARGE' | 'REFUND' | 'ADJUSTMENT';
  sourceTransactionType: TransactionType;
  amount: number;
  relatedDocumentType: string;
  relatedDocumentId?: number;
  relatedDocumentNumber: string;
  clientName?: string;
  clientRnc?: string;
  supplierName?: string;
  supplierRnc?: string;
  ncf?: string;
  description: string;
  cardId: number;
  authorizationCode?: string;
  referenceNumber?: string;
  notes?: string;
}

interface CreditCardPaymentRequest {
  cardId: number;
  amount: number;
  relatedDocumentType: string;
  relatedDocumentNumber: string;
  supplierName: string;
  supplierRnc?: string;
  description: string;
  authorizationCode?: string;
  referenceNumber?: string;
  notes?: string;
}

/**
 * Credit Card Register Service Class
 */
class CreditCardRegisterService extends BaseService {

  // ==================== PUBLIC API METHODS ====================

  /**
   * Get all credit card register entries with filtering
   */
  async getAllCreditCardRegister(options: {
    cardId?: number;
    transactionType?: 'CHARGE' | 'REFUND' | 'ADJUSTMENT';
    page?: number;
    limit?: number;
    dateFrom?: Date;
    dateTo?: Date;
  } = {}): Promise<any> {
    return this.executeWithRetry(async () => {
      console.log('🔍 Service: getAllCreditCardRegister called with options:', options);
      
      // Check if pagination is requested
      if (options.page || options.limit) {
        // Build additional where clause for filters
        const additionalWhere: any = {
          deletion_status: { [Op.ne]: 'EXECUTED' }
        };
        
        if (options.cardId) {
          this.validateNumeric(options.cardId, 'Card ID', { min: 1 });
          additionalWhere.cardId = options.cardId;
        }
        
        if (options.transactionType) {
          this.validateEnum(options.transactionType, 'Transaction type', ['CHARGE', 'REFUND', 'ADJUSTMENT']);
          additionalWhere.transactionType = options.transactionType;
        }
        
        // Use generic pagination from BaseService
        const result = await this.getAllWithPagination(
          CreditCardRegister,
          {
            ...options,
            searchFields: ['registrationNumber', 'cardIssuer', 'description'],
            dateField: 'registrationDate'
          },
          additionalWhere
        );
        
        console.log(`✅ Retrieved ${result.data.length} of ${result.pagination.total} credit card transactions (Page ${result.pagination.page}/${result.pagination.totalPages})`);
        return result;
      }
      
      // Backward compatibility - return all records with filters
      const { cardId, transactionType, dateFrom, dateTo } = options;
      const whereClause: any = {
        deletion_status: { [Op.ne]: 'EXECUTED' }
      };
      
      if (cardId) {
        this.validateNumeric(cardId, 'Card ID', { min: 1 });
        whereClause.cardId = cardId;
      }
      
      if (transactionType) {
        this.validateEnum(transactionType, 'Transaction type', ['CHARGE', 'REFUND', 'ADJUSTMENT']);
        whereClause.transactionType = transactionType;
      }
      
      if (dateFrom || dateTo) {
        whereClause.registrationDate = {};
        if (dateFrom) whereClause.registrationDate[Op.gte] = dateFrom;
        if (dateTo) whereClause.registrationDate[Op.lte] = dateTo;
      }
      
      const entries = await CreditCardRegister.findAll({
        where: whereClause,
        order: [['registrationDate', 'DESC'], ['createdAt', 'DESC']]
      });
      
      return entries;
    });
  }

  /**
   * Get credit card register entry by ID
   */
  async getCreditCardRegisterById(id: number): Promise<CreditCardRegister> {
    return this.executeWithRetry(async () => {
      this.validateNumeric(id, 'Credit Card Register ID', { min: 1 });
      
      const entry = await CreditCardRegister.findByPk(id);
      if (!entry) {
        throw new NotFoundError(`Credit Card Register entry with ID ${id} not found`);
      }
      
      return entry;
    });
  }

  /**
   * Get credit card register entries by card ID
   */
  async getCreditCardRegisterByCardId(cardId: number): Promise<CreditCardRegister[]> {
    return this.executeWithRetry(async () => {
      this.validateNumeric(cardId, 'Card ID', { min: 1 });
      
      return await CreditCardRegister.findAll({
        where: { 
          cardId,
          deletion_status: { [Op.ne]: 'EXECUTED' }
        },
        order: [['registrationDate', 'DESC']],
      });
    });
  }

  /**
   * Create credit card register entry
   */
  async createCreditCardRegister(data: CreateCreditCardRegisterRequest): Promise<CreditCardRegister> {
    return this.executeWithTransaction(async (transaction) => {
      
      // Step 1: Validate input data
      this.validateCreditCardRegisterData(data);
      
      // Step 2: Get card information
      const Card = (await import('../models/Card')).default;
      const card = await Card.findByPk(data.cardId, { transaction });
      if (!card) {
        throw new NotFoundError(`Card with ID ${data.cardId} not found`);
      }
      
      // Step 3: Generate registration number
      const registrationNumber = await this.generateCCRegistrationNumber(transaction);
      
      // Step 4: Calculate credit balances
      const currentUsedCredit = parseFloat(card.usedCredit?.toString() || '0');
      const creditLimit = parseFloat(card.creditLimit?.toString() || '0');
      
      let newUsedCredit = currentUsedCredit;
      let newAvailableCredit = creditLimit - currentUsedCredit;
      
      if (data.transactionType === 'CHARGE') {
        newUsedCredit = currentUsedCredit + data.amount;
        newAvailableCredit = creditLimit - newUsedCredit;
      } else if (data.transactionType === 'REFUND') {
        newUsedCredit = Math.max(0, currentUsedCredit - data.amount);
        newAvailableCredit = creditLimit - newUsedCredit;
      }
      
      // Step 5: Create the entry
      const ccRegister = await CreditCardRegister.create({
        registrationNumber,
        registrationDate: new Date(),
        transactionType: data.transactionType,
        sourceTransactionType: data.sourceTransactionType,
        amount: data.amount,
        paymentMethod: 'CREDIT_CARD',
        relatedDocumentType: data.relatedDocumentType,
        relatedDocumentId: data.relatedDocumentId || 0,
        relatedDocumentNumber: data.relatedDocumentNumber,
        clientName: data.clientName,
        clientRnc: data.clientRnc,
        supplierName: data.supplierName,
        supplierRnc: data.supplierRnc,
        ncf: data.ncf,
        description: data.description,
        cardId: data.cardId,
        cardIssuer: card.bankName || 'Unknown Issuer',
        cardBrand: card.cardBrand,
        cardNumberLast4: card.cardNumberLast4,
        authorizationCode: data.authorizationCode,
        referenceNumber: data.referenceNumber,
        notes: data.notes,
        balance: newUsedCredit,
        availableCredit: newAvailableCredit,
        usedCredit: newUsedCredit
      }, { transaction });
      
      // Step 6: Update card's used credit
      await card.update({ usedCredit: newUsedCredit }, { transaction });
      
      console.log(`💳 [CC Register] Created ${registrationNumber}: ${data.transactionType} ${data.amount} (Used Credit: ${currentUsedCredit} → ${newUsedCredit})`);
      
      return ccRegister;
    });
  }
  /**
   * Process credit card payment for Accounts Payable
   */
  async processCreditCardPayment(paymentData: CreditCardPaymentRequest): Promise<CreditCardRegister> {
    return this.executeWithTransaction(async (transaction) => {
      
      // Step 1: Get and validate card
      const Card = (await import('../models/Card')).default;
      const card = await Card.findByPk(paymentData.cardId, { transaction });
      if (!card) {
        throw new NotFoundError(`Card with ID ${paymentData.cardId} not found`);
      }
      
      if (card.cardType !== 'CREDIT') {
        throw new ValidationError('Only credit cards are supported for credit card payments');
      }
      
      // Step 2: Validate credit limit
      const creditLimit = parseFloat(card.creditLimit?.toString() || '0');
      const usedCredit = parseFloat(card.usedCredit?.toString() || '0');
      const availableCredit = creditLimit - usedCredit;
      
      if (creditLimit <= 0) {
        throw new ValidationError(`Credit card has no credit limit set`);
      }
      
      if (paymentData.amount > availableCredit) {
        throw new InsufficientBalanceError(
          `Insufficient credit limit. Available: ${availableCredit.toFixed(2)}, Required: ${paymentData.amount.toFixed(2)}`
        );
      }
      
      // Step 3: Create credit card register entry
      const ccRegisterData: CreateCreditCardRegisterRequest = {
        transactionType: 'CHARGE',
        sourceTransactionType: TransactionType.PAYMENT,
        amount: paymentData.amount,
        relatedDocumentType: paymentData.relatedDocumentType,
        relatedDocumentNumber: paymentData.relatedDocumentNumber,
        supplierName: paymentData.supplierName,
        supplierRnc: paymentData.supplierRnc,
        description: paymentData.description,
        cardId: paymentData.cardId,
        authorizationCode: paymentData.authorizationCode,
        referenceNumber: paymentData.referenceNumber,
        notes: paymentData.notes
      };
      
      return await this.createCreditCardRegister(ccRegisterData);
    });
  }

  /**
   * Process credit card refund
   */
  async processCreditCardRefund(refundData: {
    cardId: number;
    amount: number;
    relatedDocumentType: string;
    relatedDocumentNumber: string;
    description: string;
    originalTransactionId?: number;
    notes?: string;
  }, externalTransaction?: Transaction): Promise<CreditCardRegister> {
    return this.executeWithTransaction(async (transaction) => {
      
      const ccRegisterData: CreateCreditCardRegisterRequest = {
        transactionType: 'REFUND',
        sourceTransactionType: TransactionType.ADJUSTMENT,
        amount: refundData.amount,
        relatedDocumentType: refundData.relatedDocumentType,
        relatedDocumentNumber: refundData.relatedDocumentNumber,
        description: refundData.description,
        cardId: refundData.cardId,
        notes: refundData.notes
      };
      
      const refundEntry = await this.createCreditCardRegister(ccRegisterData);
      
      // Link to original transaction if provided
      if (refundData.originalTransactionId) {
        await refundEntry.update({
          original_transaction_id: refundData.originalTransactionId,
          is_reversal: true
        }, { transaction });
        
        // Update original transaction with reversal link
        await CreditCardRegister.update({
          reversal_transaction_id: refundEntry.id
        }, {
          where: { id: refundData.originalTransactionId },
          transaction
        });
      }
      
      return refundEntry;
    }, externalTransaction);
  }

  /**
   * Get credit card statement for a specific card
   */
  async getCreditCardStatement(cardId: number, options: {
    dateFrom?: Date;
    dateTo?: Date;
  } = {}): Promise<{
    cardInfo: any;
    transactions: CreditCardRegister[];
    summary: {
      totalCharges: number;
      totalRefunds: number;
      netAmount: number;
      transactionCount: number;
      currentBalance: number;
      availableCredit: number;
      creditLimit: number;
    };
  }> {
    return this.executeWithRetry(async () => {
      this.validateNumeric(cardId, 'Card ID', { min: 1 });
      
      // Get card information
      const Card = (await import('../models/Card')).default;
      const card = await Card.findByPk(cardId);
      if (!card) {
        throw new NotFoundError(`Card with ID ${cardId} not found`);
      }
      
      // Build where clause
      const whereClause: any = {
        cardId,
        deletion_status: { [Op.ne]: 'EXECUTED' }
      };
      
      if (options.dateFrom || options.dateTo) {
        whereClause.registrationDate = {};
        if (options.dateFrom) whereClause.registrationDate[Op.gte] = options.dateFrom;
        if (options.dateTo) whereClause.registrationDate[Op.lte] = options.dateTo;
      }
      
      // Get transactions
      const transactions = await CreditCardRegister.findAll({
        where: whereClause,
        order: [['registrationDate', 'DESC']],
      });
      
      // Calculate summary
      const totalCharges = transactions
        .filter(t => t.transactionType === 'CHARGE')
        .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
      
      const totalRefunds = transactions
        .filter(t => t.transactionType === 'REFUND')
        .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
      
      const netAmount = totalCharges - totalRefunds;
      const creditLimit = parseFloat(card.creditLimit?.toString() || '0');
      const currentBalance = parseFloat(card.usedCredit?.toString() || '0');
      const availableCredit = creditLimit - currentBalance;
      
      return {
        cardInfo: {
          id: card.id,
          cardBrand: card.cardBrand,
          cardNumberLast4: card.cardNumberLast4,
          cardIssuer: card.bankName || 'Unknown Issuer',
          creditLimit,
          usedCredit: currentBalance,
          availableCredit
        },
        transactions,
        summary: {
          totalCharges,
          totalRefunds,
          netAmount,
          transactionCount: transactions.length,
          currentBalance,
          availableCredit,
          creditLimit
        }
      };
    });
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Validate credit card register data
   */
  private validateCreditCardRegisterData(data: CreateCreditCardRegisterRequest): void {
    // Required field validation
    this.validateRequired(data, ['transactionType', 'amount', 'relatedDocumentType', 'relatedDocumentNumber', 'description', 'cardId'], 'Credit Card Register');
    
    // Numeric validations
    this.validateNumeric(data.amount, 'Amount', { min: 0.01 });
    this.validateNumeric(data.cardId, 'Card ID', { min: 1 });
    
    if (data.relatedDocumentId) {
      this.validateNumeric(data.relatedDocumentId, 'Related Document ID', { min: 1 });
    }
    
    // Enum validations
    this.validateEnum(data.transactionType, 'Transaction type', ['CHARGE', 'REFUND', 'ADJUSTMENT']);
    this.validateEnum(data.sourceTransactionType, 'Source transaction type', Object.values(TransactionType));
    
    // String validations
    // if (data.supplierRnc && data.supplierRnc.trim().length > 0) {
    //   const rnc = data.supplierRnc.replace(/\D/g, '');
    //   if (rnc.length !== 9 && rnc.length !== 11) {
    //     throw new ValidationError('Supplier RNC must be 9 or 11 digits');
    //   }
    // }
    
    // if (data.clientRnc && data.clientRnc.trim().length > 0) {
    //   const rnc = data.clientRnc.replace(/\D/g, '');
    //   if (rnc.length !== 9 && rnc.length !== 11) {
    //     throw new ValidationError('Client RNC must be 9 or 11 digits');
    //   }
    // }
    
    // if (data.ncf && data.ncf.length > 0) {
    //   const ncf = data.ncf.replace(/\D/g, '');
    //   if (ncf.length !== 8) {
    //     throw new ValidationError('NCF must be 8 digits');
    //   }
    // }
  }

  /**
   * Generate credit card register registration number
   */
  private async generateCCRegistrationNumber(transaction?: any): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    const lastEntry = await CreditCardRegister.findOne({
      where: {
        registrationNumber: {
          [Op.like]: `CCR${dateStr}%`  // ✅ FIXED: Changed from CC to CCR to match the generated format
        }
      },
      order: [['id', 'DESC']],
      transaction
    });
    
    let nextNumber = 1;
    if (lastEntry) {
      const lastNumberStr = lastEntry.registrationNumber.substring(`CCR${dateStr}`.length);  // ✅ FIXED: Changed from CC to CCR
      nextNumber = parseInt(lastNumberStr) + 1;
    }
    
    return `CCR${dateStr}${String(nextNumber).padStart(3, '0')}`;
  }

  /**
   * ✅ NEW: Restore credit card by repaying from bank/cash
   * This reduces the used credit and creates appropriate register entries
   */
  async restoreCreditCard(data: {
    cardId: number;
    amount: number;
    paymentMethod: 'BANK_TRANSFER' | 'CHECK' | 'CASH';
    bankAccountId?: number;
    chequeNumber?: string;
    restorationDate: Date;
    reference?: string;
    notes?: string;
  }): Promise<{
    creditCardRegister: CreditCardRegister;
    bankRegister?: any;
    cashRegister?: any;
  }> {
    console.log('🚀 [RESTORE] restoreCreditCard method called!');
    console.log('   Data received:', JSON.stringify(data, null, 2));
    
    return this.executeWithTransaction(async (transaction) => {
      
      console.log('💳 [Service] Restore credit card called with data:', JSON.stringify(data, null, 2));
      
      // Step 1: Get and validate card
      const Card = (await import('../models/Card')).default;
      const card = await Card.findByPk(data.cardId, { transaction });
      if (!card) {
        console.error('❌ Card not found:', data.cardId);
        throw new NotFoundError(`Card with ID ${data.cardId} not found`);
      }
      
      console.log('✅ Card found:', {
        id: card.id,
        cardType: card.cardType,
        usedCredit: card.usedCredit,
        creditLimit: card.creditLimit
      });
      
      if (card.cardType !== 'CREDIT') {
        console.error('❌ Invalid card type:', card.cardType);
        throw new ValidationError('Only credit cards can be restored. Debit cards are linked to bank accounts.');
      }
      
      // Step 2: Validate restoration amount
      const usedCredit = parseFloat(card.usedCredit?.toString() || '0');
      console.log('💰 Validating amount:', {
        requestedAmount: data.amount,
        usedCredit: usedCredit
      });
      
      if (data.amount <= 0) {
        console.error('❌ Invalid amount:', data.amount);
        throw new ValidationError('Restoration amount must be greater than zero');
      }
      
      if (data.amount > usedCredit) {
        console.error('❌ Amount exceeds used credit:', {
          amount: data.amount,
          usedCredit: usedCredit
        });
        throw new ValidationError(
          `Restoration amount ₹${data.amount.toFixed(2)} exceeds used credit ₹${usedCredit.toFixed(2)}`
        );
      }
      
      // Step 3: Validate payment source and create register entry
      let bankRegister = null;
      let cashRegister = null;
      
      if (data.paymentMethod === 'BANK_TRANSFER' || data.paymentMethod === 'CHECK') {
        if (!data.bankAccountId) {
          throw new ValidationError('Bank account is required for bank transfer or check payment');
        }
        
        // Validate bank account exists and has sufficient balance
        const BankAccount = (await import('../models/BankAccount')).default;
        const bankAccount = await BankAccount.findByPk(data.bankAccountId, { transaction });
        if (!bankAccount) {
          throw new NotFoundError('Bank account not found');
        }
        
        const bankBalance = parseFloat(bankAccount.balance?.toString() || '0');
        if (bankBalance < data.amount) {
          throw new InsufficientBalanceError(
            `Insufficient bank balance. Available: ₹${bankBalance.toFixed(2)}, Required: ₹${data.amount.toFixed(2)}`
          );
        }
        
        // Create bank register entry
        const bankRegisterService = (await import('./bankRegisterService')).default;
        const cardInfo = `${card.cardBrand || 'Card'} ****${card.cardNumberLast4}`;
        
        bankRegister = await bankRegisterService.createBankRegister({
          bankAccountId: data.bankAccountId,
          amount: data.amount,
          transactionType: 'OUTFLOW',
          sourceTransactionType: TransactionType.PAYMENT,
          paymentMethod: data.paymentMethod === 'CHECK' ? 'CHEQUE' : 'BANK_TRANSFER',
          relatedDocumentType: 'Credit Card Restoration',
          relatedDocumentNumber: `CC-RESTORE-${card.id}-${Date.now()}`,
          description: data.notes || `Credit card restoration - ${cardInfo}`,
          referenceNumber: data.reference,
          chequeNumber: data.paymentMethod === 'CHECK' ? data.chequeNumber : undefined,
          clientName: cardInfo,
          clientRnc: ''
        }, transaction);
        
        // Update bank account balance
        await bankAccount.update({
          balance: bankBalance - data.amount
        }, { transaction });
        
      } else if (data.paymentMethod === 'CASH') {
        // Create cash register entry
        const cashRegisterService = (await import('./cashRegisterService')).default;
        const cardInfo = `${card.cardBrand || 'Card'} ****${card.cardNumberLast4}`;
        
        cashRegister = await cashRegisterService.createCashTransaction({
          registrationDate: data.restorationDate,
          transactionType: 'OUTFLOW',
          amount: data.amount,
          paymentMethod: 'CASH',
          relatedDocumentType: 'Credit Card Restoration',
          relatedDocumentNumber: `CC-RESTORE-${card.id}-${Date.now()}`,
          description: data.notes || `Credit card restoration - ${cardInfo}`,
          customerName: cardInfo,
          cashRegisterId: undefined // Will need to be provided if cash register is required
        }, transaction);
      }
      
      // Step 4: Create credit card register entry (REFUND type)
      const ccRegisterData: CreateCreditCardRegisterRequest = {
        transactionType: 'REFUND',
        sourceTransactionType: TransactionType.PAYMENT,
        amount: data.amount,
        relatedDocumentType: 'Credit Card Restoration',
        relatedDocumentNumber: bankRegister?.registrationNumber || cashRegister?.registrationNumber || `CC-RESTORE-${Date.now()}`,
        description: `Credit restoration via ${data.paymentMethod}`,
        cardId: data.cardId,
        referenceNumber: data.reference,
        notes: data.notes
      };
      
      const creditCardRegister = await this.createCreditCardRegister(ccRegisterData);
      
      console.log('🔍 [DEBUG] About to post GL entries for restoration...');
      console.log('   Credit Card Register created:', creditCardRegister.id);
      
      // ✅ Step 5: Post GL Entries for Credit Card Restoration
      try {
        const GLPostingService = (await import('./accounting/GLPostingService')).default;
        const AccountingRulesEngine = (await import('./accounting/AccountingRulesEngine')).default;
        const { SourceModule } = await import('../models/accounting/GeneralLedger');
        
        const paymentMethod = data.paymentMethod === 'CASH' ? 'CASH' : 'BANK';
        
        console.log('💳 [GL Posting] Starting GL entry for credit card restoration...');
        console.log('   Amount:', data.amount);
        console.log('   Payment Method:', paymentMethod);
        console.log('   Restoration Date:', data.restorationDate);
        console.log('   CC Register ID:', creditCardRegister.id);
        console.log('   CC Register Number:', creditCardRegister.registrationNumber);
        
        // Get GL entries for credit card restoration
        const glEntries = AccountingRulesEngine.getCreditCardSettlementGLEntries(
          data.amount,
          paymentMethod
        );
        
        console.log('   GL Entries to post:', JSON.stringify(glEntries, null, 2));
        
        // ✅ CRITICAL FIX: Ensure restorationDate is a proper Date object
        const entryDate = data.restorationDate ? new Date(data.restorationDate) : new Date();
        console.log('   Entry Date (converted):', entryDate);
        
        // Post to General Ledger
        await GLPostingService.postGLEntries({
          entryDate: entryDate, // ✅ Use converted Date object
          sourceModule: SourceModule.PAYMENT,
          sourceTransactionId: creditCardRegister.id,
          sourceTransactionNumber: creditCardRegister.registrationNumber,
          entries: glEntries,
        }, transaction);
        
        console.log(`✅ GL entries posted successfully for credit card restoration ${creditCardRegister.registrationNumber}`);
      } catch (glError: any) {
        console.error('❌ Failed to post GL entries for credit card restoration:', glError.message);
        console.error('   Error stack:', glError.stack);
        console.error('   Error details:', JSON.stringify(glError, null, 2));
        throw glError; // Will trigger transaction rollback
      }
      
      console.log(`💳 [Credit Card Restored] Card ${card.id}: ₹${data.amount} restored via ${data.paymentMethod}`);
      console.log(`   Used Credit: ₹${usedCredit} → ₹${usedCredit - data.amount}`);
      
      return {
        creditCardRegister,
        bankRegister,
        cashRegister
      };
    });
  }
}

// Create singleton instance
const creditCardRegisterService = new CreditCardRegisterService();

// Export methods for compatibility
export const getAllCreditCardRegister = (options?: any) => creditCardRegisterService.getAllCreditCardRegister(options);
export const getCreditCardRegisterById = (id: number) => creditCardRegisterService.getCreditCardRegisterById(id);
export const getCreditCardRegisterByCardId = (cardId: number) => creditCardRegisterService.getCreditCardRegisterByCardId(cardId);
export const createCreditCardRegister = (data: CreateCreditCardRegisterRequest) => creditCardRegisterService.createCreditCardRegister(data);
export const processCreditCardPayment = (data: CreditCardPaymentRequest) => creditCardRegisterService.processCreditCardPayment(data);
export const processCreditCardRefund = (data: any) => creditCardRegisterService.processCreditCardRefund(data);
export const getCreditCardStatement = (cardId: number, options?: any) => creditCardRegisterService.getCreditCardStatement(cardId, options);
export const restoreCreditCard = (data: any) => creditCardRegisterService.restoreCreditCard(data);  // ✅ NEW

// Export the service class
export { CreditCardRegisterService };
export default creditCardRegisterService;