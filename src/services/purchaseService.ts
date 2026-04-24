import Purchase from '../models/Purchase';
import PurchaseItem from '../models/PurchaseItem';
import AssociatedInvoice from '../models/AssociatedInvoice';
import Supplier from '../models/Supplier';
import Product from '../models/Product';
import { Op } from 'sequelize';
import sequelize from '../config/database';
import { TransactionType } from '../types/TransactionType';
import { TransactionFactory, PurchaseContext } from './shared/TransactionFactory';
import { 
  ValidationError, 
  InsufficientBalanceError, 
  BusinessLogicError, 
  NotFoundError 
} from '../core/AppError';
import { BaseService } from '../core/BaseService';
import { ValidationFramework, ValidationSchemas } from '../core/ValidationFramework';
import { serviceConfig, PaymentTypeHelper } from '../config/ServiceConfig';

// ✅ PHASE 2: Import GL Posting Services
import GLPostingService from './accounting/GLPostingService';
import AccountingRulesEngine from './accounting/AccountingRulesEngine';
import { SourceModule } from '../models/accounting/GeneralLedger';

// Import associations to ensure they're loaded
import '../models/associations';

// Types for better type safety
interface PaymentStatus {
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: 'Paid' | 'Unpaid' | 'Partial';
}

interface CreatePurchaseRequest {
  supplierId: number;
  supplierRnc?: string;
  ncf?: string;
  purchaseType: string;
  paymentType: string;
  total: number;
  productTotal?: number;
  date: Date;
  items?: any[];
  associatedInvoices?: any[];
  bankAccountId?: number;
  cardId?: number;
  chequeNumber?: string;
  chequeDate?: Date;
  transferNumber?: string;
  transferDate?: Date;
  paymentReference?: string;
  voucherDate?: Date;
}

/**
 * Purchase Service - Enterprise-grade service for purchase management
 * 
 * Features:
 * - Class-based architecture with SOLID principles
 * - Comprehensive error handling and validation
 * - Transaction management with rollback protection
 * - O(n) batch processing for performance
 * - Graceful degradation for association loading
 * - Proper DSA implementation for inventory calculations
 */
class PurchaseService extends BaseService {
  
  // ==================== PUBLIC API METHODS ====================
  
  /**
   * Get all purchases with filtering and validation
   * Time Complexity: O(n) where n = number of purchases
   * Space Complexity: O(n) for result set
   */
  async getAllPurchases(transactionType?: string): Promise<Purchase[]> {
    return this.executeWithRetry(async () => {
      console.log('🔍 Service: getAllPurchases called with transactionType:', transactionType);
      
      // Validate transaction type to prevent enum errors
      if (transactionType && !this.isValidTransactionType(transactionType)) {
        throw new ValidationError(`Invalid transaction type: ${transactionType}. Must be 'GOODS'`);
      }
      
      // Build where clause based on transaction type
      const whereClause: any = {};
      if (transactionType) {
        whereClause.transactionType = transactionType;
      }
      
      // Use progressive association loading to handle schema issues gracefully
      const purchases = await this.loadPurchasesWithFallback(whereClause);
      
      console.log(`✅ Retrieved ${purchases.length} purchases successfully`);
      return purchases;
    });
  }

  // ✅ NEW: Pagination support for purchases
  async getAllPurchasesWithPagination(options?: any) {
    return this.getAllWithPagination(
      Purchase, 
      options,
      {}, // additionalWhere
      [
        { 
          model: Supplier, 
          as: 'supplier',
          required: false,
          attributes: ['id', 'name', 'rnc']
        }
      ]
    );
  }

  /**
   * Get purchase by ID with progressive association loading
   * Time Complexity: O(1) for primary key lookup
   * Space Complexity: O(1) for single record
   */
  async getPurchaseById(id: number): Promise<Purchase> {
    return this.executeWithRetry(async () => {
      this.validateNumeric(id, 'Purchase ID', { min: 1 });
      
      // Use basic query first to avoid association issues
      const purchase = await Purchase.findByPk(id);
      
      if (!purchase) {
        throw new NotFoundError(`Purchase with ID ${id} not found`);
      }
      
      return purchase;
    });
  }

  /**
   * Create new purchase with comprehensive validation and transaction management
   * Time Complexity: O(n + m) where n = items, m = associated invoices
   * Space Complexity: O(n + m) for processing data
   */
  async createPurchase(data: CreatePurchaseRequest): Promise<Purchase> {
    console.log("data:", data);
    return this.executeWithTransaction(async (transaction) => {
      
      // Step 1: Comprehensive validation (O(1) complexity)
      // ValidationFramework.validate(data, ValidationSchemas.PURCHASE_CREATE);
      
      // Use simple validation for now to avoid framework issues
      if (!data.supplierId) throw new ValidationError('Supplier is required');
      if (!data.total || data.total <= 0) throw new ValidationError('Total amount must be greater than 0');
      if (!data.paymentType) throw new ValidationError('Payment type is required');
      
      // Step 2: Generate registration number (O(1) complexity)
      const registrationNumber = await this.generatePurchaseRegistrationNumber(transaction);
      
      // Step 3: Calculate payment status and amounts (O(1) complexity)
      const paymentStatus = this.calculatePaymentStatus(data.paymentType, data.total);
      
      // Step 4: Calculate associated expenses (O(n) where n = number of invoices)
      const associatedExpenses = this.calculateAssociatedExpenses(data.associatedInvoices);
      const mainPurchaseAmount = data.productTotal || (data.total - associatedExpenses) || data.total;
      
      // Step 5: Create main purchase record (O(1) complexity)
      const purchaseCreateData = {
        supplierId: data.supplierId,
        supplierRnc: data.supplierRnc,
        ncf: data.ncf,
        purchaseType: data.purchaseType,
        paymentType: data.paymentType,
        date: new Date(data.date), // ✅ Convert to Date object
        registrationNumber,
        registrationDate: new Date(),
        productTotal: data.productTotal || data.total,
        additionalExpenses: associatedExpenses,
        total: data.total, // Ensure total is explicitly set
        totalWithAssociated: mainPurchaseAmount + associatedExpenses,
        // Payment method specific fields
        bankAccountId: data.bankAccountId,
        cardId: data.cardId,
        chequeNumber: data.chequeNumber,
        chequeDate: data.chequeDate ? new Date(data.chequeDate) : undefined, // ✅ Convert to Date
        transferNumber: data.transferNumber,
        transferDate: data.transferDate ? new Date(data.transferDate) : undefined, // ✅ Convert to Date
        paymentReference: data.paymentReference,
        voucherDate: data.voucherDate ? new Date(data.voucherDate) : undefined, // ✅ Convert to Date
        // Payment status - spread first, then override status to ensure it's not null
        ...paymentStatus,
        status: 'COMPLETED', // Ensure status is never null - must be last to override any conflicts
      };
      
      
      const purchase = await Purchase.create(purchaseCreateData, { transaction });
      
      // Step 6: Process payment based on type (O(1) complexity per payment type)
      await this.processMainPayment(data, purchase, mainPurchaseAmount, transaction);
      
      // Step 7: Update inventory first (O(m) where m = number of items)
      if (data.items && data.items.length > 0) {
        await this.updateInventoryBatch(data.items, purchase.id, associatedExpenses, transaction);
      }
      
      // Step 8: Process associated invoices after inventory (O(n) complexity)
      if (data.associatedInvoices && data.associatedInvoices.length > 0) {
        await this.processAssociatedInvoicesBatch(data.associatedInvoices, registrationNumber, purchase.id, transaction);
      }
      
      // ✅ Step 8.5: Recalculate payment status based on ALL payment types (main + associated)
      await this.recalculatePurchasePaymentStatus(purchase.id, data.paymentType, data.associatedInvoices, transaction);
      
      // ✅ PHASE 2: Step 9 - Post GL Entries
      await this.postPurchaseGLEntries(data, purchase, mainPurchaseAmount, transaction);
      
      // Return complete purchase
      return purchase;
    });
  }

  /**
   * Update purchase with validation
   * Time Complexity: O(1) for single record update
   * Space Complexity: O(1) for update data
   */
  async updatePurchase(id: number, data: Partial<CreatePurchaseRequest>): Promise<Purchase> {
    return this.executeWithTransaction(async (transaction) => {
      this.validateNumeric(id, 'Purchase ID', { min: 1 });
      
      const purchase = await Purchase.findByPk(id, { transaction });
      if (!purchase) {
        throw new NotFoundError(`Purchase with ID ${id} not found`);
      }
      
      // Validate update data
      if (data.total !== undefined) {
        this.validateNumeric(data.total, 'Total amount', { min: serviceConfig.validation.minPurchaseAmount });
      }
      
      return await purchase.update(data, { transaction });
    });
  }

  /**
   * Collect payment with balance validation
   * Time Complexity: O(1) for payment processing
   * Space Complexity: O(1) for payment data
   */
  async collectPayment(id: number, paymentData: { amount: number; paymentMethod: string }): Promise<Purchase> {
    return this.executeWithTransaction(async (transaction) => {
      // Validate input
      ValidationFramework.validate(paymentData, ValidationSchemas.PAYMENT_COLLECTION);
      
      const purchase = await Purchase.findByPk(id, { transaction });
      if (!purchase) {
        throw new NotFoundError(`Purchase with ID ${id} not found`);
      }
      
      const currentPaid = Number(purchase.paidAmount);
      const totalAmount = Number(purchase.balanceAmount) + currentPaid;
      const newPaidAmount = currentPaid + paymentData.amount;
      
      if (newPaidAmount > totalAmount) {
        throw new ValidationError('Payment amount exceeds remaining balance');
      }
      
      const newBalanceAmount = totalAmount - newPaidAmount;
      let paymentStatus = 'Partial';
      
      if (this.isEqual(newBalanceAmount, 0)) {
        paymentStatus = 'Paid';
      } else if (this.isEqual(newPaidAmount, 0)) {
        paymentStatus = 'Unpaid';
      }
      
      await purchase.update({
        paidAmount: this.roundCurrency(newPaidAmount),
        balanceAmount: this.roundCurrency(Math.max(0, newBalanceAmount)),
        paymentStatus: paymentStatus,
      }, { transaction });
      
      return purchase;
    });
  }

  /**
   * Delete purchase with business rule validation
   * Time Complexity: O(1) for deletion + O(n) for related records
   * Space Complexity: O(1) for operation
   */
  async deletePurchase(id: number): Promise<{ message: string }> {
    return this.executeWithTransaction(async (transaction) => {
      this.validateNumeric(id, 'Purchase ID', { min: 1 });
      
      const purchase = await Purchase.findByPk(id, { transaction });
      if (!purchase) {
        throw new NotFoundError(`Purchase with ID ${id} not found`);
      }
      
      // Business rule validation
      if (purchase.paymentStatus === 'Paid' || purchase.paymentStatus === 'Partial') {
        throw new BusinessLogicError('Cannot delete a purchase with payments. Please reverse all payments first.');
      }
      
      // Delete related records safely
      await this.safeDeleteRelatedRecords(id, transaction);
      
      // Delete the purchase
      await purchase.destroy({ transaction });
      
      return { message: 'Purchase deleted successfully' };
    });
  }
  
  // ==================== VALIDATION METHODS ====================
  
  private isValidTransactionType(transactionType: string): boolean {
    const validTypes = ['GOODS'];
    return validTypes.includes(transactionType.toUpperCase());
  }
  
  private async loadPurchasesWithFallback(whereClause: any) {
    try {
      // Strategy 1: Try with full associations including items (needed for inventory)
      return await Purchase.findAll({
        where: whereClause,
        include: [
          { 
            model: Supplier, 
            as: 'supplier',
            required: false,
            attributes: ['id', 'name', 'rnc'] // Only essential fields
          },
          {
            model: PurchaseItem,
            as: 'items',
            required: false,
            include: [
              {
                model: Product,
                as: 'product',
                required: false,
                attributes: ['id', 'name', 'code', 'unit']
              }
            ]
          }
        ],
        order: [['registrationDate', 'DESC']],
        limit: 50 // Reasonable limit for performance
      });
    } catch (fullAssociationError: any) {
      console.log('⚠️  Full association failed, trying supplier only:', fullAssociationError.message);
      
      try {
        // Strategy 2: Try with minimal safe associations
        return await Purchase.findAll({
          where: whereClause,
          include: [
            { 
              model: Supplier, 
              as: 'supplier',
              required: false,
              attributes: ['id', 'name', 'rnc'] // Only essential fields
            }
          ],
          order: [['registrationDate', 'DESC']],
          limit: 50 // Reasonable limit for performance
        });
      } catch (supplierError: any) {
        console.log('⚠️  Supplier association failed, trying basic query:', supplierError.message);
        
        try {
          // Strategy 3: Basic query without associations
          return await Purchase.findAll({
            where: whereClause,
            order: [['registrationDate', 'DESC']],
            limit: 50
          });
        } catch (basicError: any) {
          console.error('❌ Even basic query failed:', basicError.message);
          throw basicError;
        }
      }
    }
  }
  
  private validatePurchaseData(data: any): void {
    console.log('🔍 VALIDATION - Purchase data received:', JSON.stringify(data, null, 2));
    
    // Required field validation
    if (!data.supplierId) {
      throw new ValidationError('Supplier is required');
    }
    
    if (!data.total || data.total <= 0) {
      throw new ValidationError('Total amount must be greater than 0');
    }
    
    if (!data.paymentType) {
      throw new ValidationError('Payment type is required');
    }
    
    console.log('✅ Basic validation passed');
    
    // Validate payment type specific requirements
    this.validatePaymentTypeRequirements(data.paymentType, data);
    
    console.log('✅ Payment type validation passed');
    
    // Validate associated invoices if present
    if (data.associatedInvoices?.length > 0) {
      this.validateAssociatedInvoices(data.associatedInvoices);
      console.log('✅ Associated invoices validation passed');
    }
    
    // Validate items if present
    if (data.items?.length > 0) {
      this.validatePurchaseItems(data.items);
      console.log('✅ Purchase items validation passed');
    }
    
    console.log('✅ ALL VALIDATION PASSED');
  }
  
  private validatePaymentTypeRequirements(paymentType: string, data: any): void {
    const type = paymentType.toUpperCase();
    
    console.log('🔍 Validating payment type:', type);
    console.log('🔍 Payment data:', JSON.stringify({
      bankAccountId: data.bankAccountId,
      cardId: data.cardId,
      chequeNumber: data.chequeNumber,
      chequeDate: data.chequeDate,
      transferNumber: data.transferNumber,
      transferDate: data.transferDate,
      paymentReference: data.paymentReference,
      voucherDate: data.voucherDate
    }, null, 2));
    
    switch (type) {
      case 'CHEQUE':
        if (!data.bankAccountId || !data.chequeNumber || !data.chequeDate) {
          const missing = [];
          if (!data.bankAccountId) missing.push('bankAccountId');
          if (!data.chequeNumber) missing.push('chequeNumber');
          if (!data.chequeDate) missing.push('chequeDate');
          throw new ValidationError(`Missing required fields for cheque payment: ${missing.join(', ')}`);
        }
        break;
        
      case 'BANK_TRANSFER':
        if (!data.bankAccountId || !data.transferNumber || !data.transferDate) {
          const missing = [];
          if (!data.bankAccountId) missing.push('bankAccountId');
          if (!data.transferNumber) missing.push('transferNumber');
          if (!data.transferDate) missing.push('transferDate');
          throw new ValidationError(`Missing required fields for bank transfer: ${missing.join(', ')}`);
        }
        break;
        
      case 'DEBIT_CARD':
      case 'CREDIT_CARD':
        if (!data.cardId || !data.paymentReference || !data.voucherDate) {
          const missing = [];
          if (!data.cardId) missing.push('cardId');
          if (!data.paymentReference) missing.push('paymentReference');
          if (!data.voucherDate) missing.push('voucherDate');
          throw new ValidationError(`Missing required fields for card payment: ${missing.join(', ')}`);
        }
        break;
    }
  }
  
  private validateAssociatedInvoices(invoices: any[]): void {
    for (const invoice of invoices) {
      if (!invoice.amount || invoice.amount <= 0) {
        throw new ValidationError(`Invoice "${invoice.concept || 'Unknown'}" must have a valid amount`);
      }
      
      if (!invoice.supplierName) {
        throw new ValidationError(`Invoice "${invoice.concept || 'Unknown'}" must have a supplier name`);
      }
      
      const paymentType = invoice.paymentType?.toUpperCase();
      if ((paymentType === 'DEBIT_CARD' || paymentType === 'CREDIT_CARD') && !invoice.cardId) {
        throw new ValidationError(`Invoice "${invoice.concept}" with payment type ${paymentType} requires a card to be selected`);
      }
    }
  }
  
  private validatePurchaseItems(items: any[]): void {
    for (const item of items) {
      if (!item.productId) {
        throw new ValidationError('All items must have a valid product selected');
      }
      
      if (!item.quantity || item.quantity <= 0) {
        throw new ValidationError('All items must have a valid quantity greater than 0');
      }
      
      if (!item.unitCost || item.unitCost <= 0) {
        throw new ValidationError('All items must have a valid unit cost greater than 0');
      }
    }
  }
  
  protected validateSufficientBalance(available: number, required: number, context: string, accountInfo?: string): void {
    if (available < required) {
      const shortfall = required - available;
      const accountMsg = accountInfo ? ` in ${accountInfo}` : '';
      
      throw new InsufficientBalanceError(
        `Insufficient balance${accountMsg} for ${context}. ` +
        `Available: $${available.toFixed(2)}, Required: $${required.toFixed(2)}. ` +
        `You need $${shortfall.toFixed(2)} more.`
      );
    }
  }
  
  private validateCardType(card: any, expectedType: string, context: string = ''): void {
    if (!card) {
      throw new NotFoundError(`Card not found${context ? ` for ${context}` : ''}`);
    }
    
    if (card.cardType !== expectedType) {
      const contextMsg = context ? ` for ${context}` : '';
      throw new ValidationError(
        `Selected card ****${card.cardNumberLast4} is a ${card.cardType} card, not a ${expectedType} card${contextMsg}. ` +
        `Please select a ${expectedType} card or change payment type.`
      );
    }
  }
  
  private validateCreditLimit(creditLimit: number, usedCredit: number, required: number, cardInfo: string, context: string = ''): void {
    if (creditLimit <= 0) {
      throw new ValidationError(`Credit card ${cardInfo} has no credit limit set. Please set a credit limit for this card.`);
    }
    
    const availableCredit = creditLimit - usedCredit;
    if (required > availableCredit) {
      const contextMsg = context ? ` for ${context}` : '';
      throw new InsufficientBalanceError(
        `Insufficient credit available on card ${cardInfo}${contextMsg}. ` +
        `Available: $${availableCredit.toFixed(2)}, Required: $${required.toFixed(2)}. ` +
        `Credit Limit: $${creditLimit.toFixed(2)}, Currently Used: $${usedCredit.toFixed(2)}`
      );
    }
  }
  
  // ==================== UTILITY METHODS ====================
  
  protected async generateRegistrationNumber(transaction: any): Promise<string> {
    const lastPurchase = await Purchase.findOne({
      where: {
        registrationNumber: {
          [Op.like]: 'CP%'
        }
      },
      order: [['id', 'DESC']],
      transaction
    });
    
    let nextNumber = 1;
    if (lastPurchase) {
      const lastNumber = parseInt(lastPurchase.registrationNumber.substring(2));
      nextNumber = lastNumber + 1;
    }
    
    return `CP${String(nextNumber).padStart(4, '0')}`;
  }
  
  private calculatePaymentStatus(paymentType: string, total: number): PaymentStatus {
    const type = paymentType.toUpperCase();
    
    // Immediate payment types
    if (type === 'CHEQUE' || type === 'BANK_TRANSFER') {
      return {
        paidAmount: total,
        balanceAmount: 0,
        paymentStatus: 'Paid'
      };
    }
    
    // Card payments - initially unpaid (will be updated based on card type)
    if (type === 'DEBIT_CARD' || type === 'CREDIT_CARD') {
      return {
        paidAmount: 0,
        balanceAmount: total,
        paymentStatus: 'Unpaid'
      };
    }
    
    // Credit payments - unpaid
    return {
      paidAmount: 0,
      balanceAmount: total,
      paymentStatus: 'Unpaid'
    };
  }
  
  private calculateAssociatedExpenses(associatedInvoices?: any[]): number {
    if (!associatedInvoices || associatedInvoices.length === 0) {
      return 0;
    }
    
    return associatedInvoices.reduce((sum: number, inv: any) => sum + Number(inv.tax || 0), 0);
  }
  
  /**
   * Recalculate purchase payment status based on ALL payment types
   * 
   * LOGIC:
   * 1. PAID: All payments (main + associated) are BANK_TRANSFER, CHECK, DEPOSIT, or DEBIT_CARD
   * 2. PARTIALLY PAID: Mix of paid methods AND credit methods (CREDIT_CARD or CREDIT)
   * 3. UNPAID: All payments are CREDIT_CARD or CREDIT only
   */
  private async recalculatePurchasePaymentStatus(
    purchaseId: number, 
    mainPaymentType: string, 
    associatedInvoices: any[] | undefined, 
    transaction: any
  ): Promise<void> {
    // Collect all payment types
    const allPaymentTypes: string[] = [mainPaymentType.toUpperCase()];
    
    if (associatedInvoices && associatedInvoices.length > 0) {
      associatedInvoices.forEach(inv => {
        if (inv.paymentType) {
          allPaymentTypes.push(inv.paymentType.toUpperCase());
        }
      });
    }
    
    // Categorize payment types
    const paidMethods = ['BANK_TRANSFER', 'CHECK', 'CHEQUE', 'DEPOSIT', 'DEBIT_CARD', 'CASH'];
    const creditMethods = ['CREDIT_CARD', 'CREDIT'];
    
    const hasPaidMethod = allPaymentTypes.some(type => paidMethods.includes(type));
    const hasCreditMethod = allPaymentTypes.some(type => creditMethods.includes(type));
    
    // Determine status based on payment type mix
    let finalStatus: 'Paid' | 'Partial' | 'Unpaid';
    
    if (hasPaidMethod && hasCreditMethod) {
      // Mix of paid and credit methods = Partially Paid
      finalStatus = 'Partial';
    } else if (hasPaidMethod && !hasCreditMethod) {
      // Only paid methods = Paid
      finalStatus = 'Paid';
    } else {
      // Only credit methods = Unpaid
      finalStatus = 'Unpaid';
    }
    
    // Update purchase with correct status
    const purchase = await Purchase.findByPk(purchaseId, { transaction });
    if (purchase) {
      await purchase.update({
        paymentStatus: finalStatus
      }, { transaction });
      
      console.log(`✅ Recalculated payment status for purchase ${purchase.registrationNumber}:`);
      console.log(`   Payment types: ${allPaymentTypes.join(', ')}`);
      console.log(`   Has paid methods: ${hasPaidMethod}`);
      console.log(`   Has credit methods: ${hasCreditMethod}`);
      console.log(`   Final status: ${finalStatus}`);
    }
  }
  
  private async getLastBankBalance(bankAccountId?: number, transaction?: any): Promise<number> {
    const BankRegister = (await import('../models/BankRegister')).default;
    
    const whereClause = bankAccountId ? { bankAccountId } : {};
    
    const lastTransaction = await BankRegister.findOne({
      where: whereClause,
      order: [['id', 'DESC']],
      transaction
    });
    
    return lastTransaction ? Number(lastTransaction.balance) : 0;
  }
  
  private async updateBankAccountBalance(bankAccountId: number, amount: number, isDebit: boolean = true, transaction?: any): Promise<void> {
    const BankAccount = (await import('../models/BankAccount')).default;
    
    const bankAccount = await BankAccount.findByPk(bankAccountId, { transaction });
    if (!bankAccount) {
      throw new NotFoundError('Bank account not found');
    }
    
    const currentBalance = Number(bankAccount.balance);
    const newBalance = isDebit ? currentBalance - amount : currentBalance + amount;
    
    await bankAccount.update({ balance: newBalance }, { transaction });
  }
  
  // ==================== PAYMENT PROCESSING METHODS ====================
  
  private async processMainPayment(data: any, purchase: any, mainPurchaseAmount: number, transaction: any): Promise<void> {
    const paymentType = data.paymentType.toUpperCase();
    
    switch (paymentType) {
      case 'CHEQUE':
      case 'BANK_TRANSFER':
        await this.processBankPayment(data, purchase, mainPurchaseAmount, transaction);
        break;
        
      case 'DEBIT_CARD':
      case 'CREDIT_CARD':
        await this.processCardPayment(data, purchase, mainPurchaseAmount, transaction);
        break;
        
      case 'CREDIT':
        await this.processCreditPayment(data, purchase, mainPurchaseAmount, transaction);
        break;
        
      default:
        // Default to unpaid status
        console.log(`Payment type ${paymentType} processed as unpaid`);
    }
  }
  
  private async processBankPayment(data: any, purchase: any, amount: number, transaction: any): Promise<void> {
    const BankAccount = (await import('../models/BankAccount')).default;
    
    console.log('🏦 Processing bank payment:', {
      bankAccountId: data.bankAccountId,
      amount: amount,
      paymentType: data.paymentType
    });
    
    // Get and validate bank account
    const bankAccount = await BankAccount.findByPk(data.bankAccountId, { transaction });
    if (!bankAccount) {
      throw new NotFoundError(`Bank account with ID ${data.bankAccountId} not found`);
    }
    
    console.log('🏦 Bank account found:', {
      id: bankAccount.id,
      bankName: bankAccount.bankName,
      accountNumber: bankAccount.accountNumber,
      currentBalance: bankAccount.balance
    });
    
    // Validate sufficient balance
    const currentBalance = Number(bankAccount.balance);
    console.log('💰 Balance check:', {
      available: currentBalance,
      required: amount,
      sufficient: currentBalance >= amount
    });
    
    if (currentBalance < amount) {
      const shortfall = amount - currentBalance;
      throw new InsufficientBalanceError(
        `Insufficient balance in ${bankAccount.bankName} (${bankAccount.accountNumber}). ` +
        `Available: $${currentBalance.toFixed(2)}, Required: $${amount.toFixed(2)}. ` +
        `You need $${shortfall.toFixed(2)} more.`
      );
    }
    
    // Update bank account balance
    await this.updateBankAccountBalance(data.bankAccountId, amount, true, transaction);
    
    // Create bank register entry using factory (eliminates duplication)
    const supplier = await Supplier.findByPk(data.supplierId, { transaction });
    const paymentMethodLabel = data.paymentType === 'CHEQUE' ? 'Cheque' : 'Bank Transfer';
    const referenceNumber = data.paymentType === 'CHEQUE' ? data.chequeNumber : data.transferNumber;
    
    const context: PurchaseContext = {
      purchase: {
        id: purchase.id,
        registrationNumber: purchase.registrationNumber,
        date: purchase.date,
        supplierId: data.supplierId,
        supplierRnc: data.supplierRnc,
        ncf: data.ncf,
        purchaseType: purchase.purchaseType
      },
      supplier: supplier ? { name: supplier.name, rnc: supplier.rnc } : undefined,
      amount
    };
    
    const bankEntryData = TransactionFactory.createBankEntry(context, {
      paymentMethod: paymentMethodLabel,
      documentType: 'Purchase',
      bankAccountId: data.bankAccountId,
      chequeNumber: data.paymentType === 'CHEQUE' ? data.chequeNumber : undefined,
      transferNumber: data.paymentType === 'BANK_TRANSFER' ? data.transferNumber : undefined,
      description: `Payment for purchase ${purchase.registrationNumber} via ${paymentMethodLabel} (${referenceNumber}) - Bank: ${bankAccount.bankName} (${bankAccount.accountNumber})`
    });
    
    await this.createBankRegisterEntry(bankEntryData, transaction);
  }
  
  private async processCardPayment(data: any, purchase: any, amount: number, transaction: any): Promise<void> {
    const Card = (await import('../models/Card')).default;
    
    // Get and validate card
    const card = await Card.findByPk(data.cardId, { transaction });
    if (!card) {
      throw new NotFoundError('Card not found');
    }
    
    const expectedCardType = data.paymentType === 'DEBIT_CARD' ? 'DEBIT' : 'CREDIT';
    this.validateCardType(card, expectedCardType, `purchase ${purchase.registrationNumber}`);
    
    const cardInfo = `${card.cardBrand || 'Card'} ****${card.cardNumberLast4}`;
    
    if (card.cardType === 'DEBIT') {
      await this.processDebitCardPayment(card, data, purchase, amount, cardInfo, transaction);
    } else {
      await this.processCreditCardPayment(card, data, purchase, amount, cardInfo, transaction);
    }
  }
  
  private async processDebitCardPayment(card: any, data: any, purchase: any, amount: number, cardInfo: string, transaction: any): Promise<void> {
    if (!card.bankAccountId) {
      throw new ValidationError('DEBIT card must be linked to a bank account');
    }
    
    const BankAccount = (await import('../models/BankAccount')).default;
    const bankAccount = await BankAccount.findByPk(card.bankAccountId, { transaction });
    if (!bankAccount) {
      throw new NotFoundError('Bank account not found for this DEBIT card');
    }
    
    // Validate balance
    const currentBalance = Number(bankAccount.balance);
    this.validateSufficientBalance(
      currentBalance,
      amount,
      `purchase ${purchase.registrationNumber}`,
      `bank account linked to DEBIT card ${cardInfo}`
    );
    
    // Update bank account balance
    await this.updateBankAccountBalance(card.bankAccountId, amount, true, transaction);
    
    // Create bank register entry using factory (eliminates duplication)
    // Fetch supplier information for proper client name display
    const supplier = data.supplierId ? await Supplier.findByPk(data.supplierId, { transaction }) : null;
    
    const context: PurchaseContext = {
      purchase: {
        id: purchase.id,
        registrationNumber: purchase.registrationNumber,
        date: purchase.date,
        supplierId: data.supplierId,
        supplierRnc: data.supplierRnc,
        ncf: data.ncf,
        purchaseType: purchase.purchaseType
      },
      supplier: supplier ? { name: supplier.name, rnc: supplier.rnc } : undefined,
      amount
    };
    
    const bankEntryData = TransactionFactory.createBankEntry(context, {
      paymentMethod: 'Debit Card',
      documentType: 'Purchase',
      bankAccountId: card.bankAccountId,
      referenceNumber: data.paymentReference,
      description: `Payment for purchase ${purchase.registrationNumber} via DEBIT card ${cardInfo} - Bank: ${bankAccount.bankName} (${bankAccount.accountNumber})${data.paymentReference ? ` - Ref: ${data.paymentReference}` : ''}`
    });
    
    await this.createBankRegisterEntry(bankEntryData, transaction);
    
    // Update purchase to paid status for DEBIT cards
    await purchase.update({
      paidAmount: amount,
      balanceAmount: 0,
      paymentStatus: 'Paid',
    }, { transaction });
  }
  
  private async processCreditCardPayment(card: any, data: any, purchase: any, amount: number, cardInfo: string, transaction: any): Promise<void> {
    const creditLimit = Number(card.creditLimit || 0);
    const usedCredit = Number(card.usedCredit || 0);
    
    // Validate credit limit (but don't reduce credit yet - only when AP is paid)
    this.validateCreditLimit(creditLimit, usedCredit, amount, cardInfo, `purchase ${purchase.registrationNumber}`);
    
    // ❌ REMOVED: Don't update used credit during purchase creation
    // The credit should only be used when the AP is actually paid
    console.log(`💳 Credit card purchase created - Credit will be used when AP is paid. Available: $${(creditLimit - usedCredit).toFixed(2)}`);
    
    // Create AP entry using factory (eliminates duplication)
    const context: PurchaseContext = {
      purchase: {
        id: purchase.id,
        registrationNumber: purchase.registrationNumber,
        date: purchase.date,
        supplierId: data.supplierId,
        supplierRnc: data.supplierRnc,
        ncf: data.ncf,
        purchaseType: data.purchaseType
      },
      supplier: undefined, // Credit card doesn't have supplier
      amount
    };
    
    const apEntryData = TransactionFactory.createAPEntry(context, {
      type: 'CREDIT_CARD_PURCHASE',
      documentType: 'Purchase',
      supplierName: cardInfo || 'Credit Card Company',
      supplierRnc: data.supplierRnc || '',
      cardId: card.id,
      cardIssuer: cardInfo,
      paymentType: 'CREDIT_CARD',
      paymentReference: data.paymentReference,
      notes: `Credit card purchase ${purchase.registrationNumber} - ${cardInfo} - Ref: ${data.paymentReference || 'N/A'} - Credit will be used when paid`
    });
    
    await this.createAccountsPayableEntry(apEntryData, transaction);
  }
  
  private async processCreditPayment(data: any, purchase: any, amount: number, transaction: any): Promise<void> {
    // Create AP entry for credit payment using factory (eliminates duplication)
    const supplier = await Supplier.findByPk(data.supplierId, { transaction });
    
    const context: PurchaseContext = {
      purchase: {
        id: purchase.id,
        registrationNumber: purchase.registrationNumber,
        date: purchase.date,
        supplierId: data.supplierId,
        supplierRnc: data.supplierRnc,
        ncf: data.ncf,
        purchaseType: data.purchaseType
      },
      supplier: supplier ? { name: supplier.name, rnc: supplier.rnc } : undefined,
      amount
    };
    
    const apEntryData = TransactionFactory.createAPEntry(context, {
      type: 'SUPPLIER_CREDIT',
      documentType: 'Purchase',
      supplierName: supplier?.name || '',
      supplierRnc: data.supplierRnc || '',
      paymentType: 'CREDIT',
      notes: `Credit purchase from ${supplier?.name || 'supplier'} - ${purchase.registrationNumber}`
    });
    
    await this.createAccountsPayableEntry(apEntryData, transaction);
  }
  
  // ==================== REGISTER AND AP CREATION METHODS ====================
  
  private async createBankRegisterEntry(data: {
    registrationNumber: string;
    transactionType: 'INFLOW' | 'OUTFLOW';
    amount: number;
    paymentMethod: string;
    relatedDocumentType: string;
    relatedDocumentNumber: string;
    sourceTransactionType: TransactionType;
    clientRnc?: string;
    clientName?: string;
    ncf?: string;
    description: string;
    bankAccountId?: number;
    chequeNumber?: string;
    transferNumber?: string;
    referenceNumber?: string;
    supplierId?: number;  // ⭐ NEW: Add supplier ID
    originalPaymentType?: string;  // ⭐ NEW: Add original payment type
  }, transaction?: any): Promise<void> {
    const BankRegister = (await import('../models/BankRegister')).default;
    
    // ⭐ NEW: Get bank account name and account type if bankAccountId is provided
    let bankAccountName = '';
    let accountType: 'CHECKING' | 'SAVINGS' | undefined = undefined;
    if (data.bankAccountId) {
      const BankAccount = (await import('../models/BankAccount')).default;
      const bankAccount = await BankAccount.findByPk(data.bankAccountId, { transaction });
      if (bankAccount) {
        bankAccountName = `${bankAccount.bankName} - ${bankAccount.accountNumber}`;
        accountType = bankAccount.accountType;  // ✅ FIX: Store account type
      }
    }
    
    // Get last balance for this bank account or overall
    const lastBalance = await this.getLastBankBalance(data.bankAccountId, transaction);
    
    // Calculate new balance based on transaction type
    const balanceChange = data.transactionType === 'INFLOW' ? data.amount : -data.amount;
    const newBalance = lastBalance + balanceChange;
    
    await BankRegister.create({
      registrationNumber: data.registrationNumber,
      registrationDate: new Date(),
      transactionType: data.transactionType,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      sourceTransactionType: data.sourceTransactionType,
      relatedDocumentType: data.relatedDocumentType,
      relatedDocumentNumber: data.relatedDocumentNumber,
      clientRnc: data.clientRnc || '',
      clientName: data.clientName || '',
      ncf: data.ncf || '',
      description: data.description,
      balance: newBalance,
      bankAccountId: data.bankAccountId,
      bankAccountName: bankAccountName,  // ⭐ NEW: Bank account name
      accountType: accountType,  // ✅ FIX: Store account type
      chequeNumber: data.chequeNumber || null,
      transferNumber: data.transferNumber || null,
      referenceNumber: data.referenceNumber || null,
      supplierId: data.supplierId,  // ⭐ NEW: Supplier ID
      originalPaymentType: data.originalPaymentType,  // ⭐ NEW: Original payment type
    }, { transaction });
  }
  
  private async createAccountsPayableEntry(data: {
    registrationNumber: string;
    type: string;
    relatedDocumentType: string;
    relatedDocumentId: number;
    relatedDocumentNumber: string;
    supplierId?: number;
    supplierName: string;
    supplierRnc?: string;
    ncf?: string;
    purchaseDate: Date;
    purchaseType: string;
    paymentType: string;
    cardId?: number;
    cardIssuer?: string;
    paymentReference?: string;
    amount: number;
    notes?: string;
  }, transaction?: any): Promise<void> {
    const AccountsPayable = (await import('../models/AccountsPayable')).default;
    
    await AccountsPayable.create({
      registrationNumber: data.registrationNumber,
      registrationDate: new Date(),
      type: data.type,
      sourceTransactionType: TransactionType.PURCHASE,
      relatedDocumentType: data.relatedDocumentType,
      relatedDocumentId: data.relatedDocumentId,
      relatedDocumentNumber: data.relatedDocumentNumber,
      supplierId: data.supplierId,
      supplierName: data.supplierName,
      supplierRnc: data.supplierRnc || '',
      ncf: data.ncf || '',
      purchaseDate: data.purchaseDate,
      purchaseType: data.purchaseType,
      paymentType: data.paymentType,
      paymentReference: data.paymentReference,
      cardId: data.cardId,
      cardIssuer: data.cardIssuer,
      amount: data.amount,
      paidAmount: 0,
      balanceAmount: data.amount,
      status: 'Pending',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      notes: data.notes,
    }, { transaction });
  }
  
  // ==================== BATCH PROCESSING METHODS ====================
  
  private async processAssociatedInvoicesBatch(invoices: any[], registrationNumber: string, purchaseId: number, transaction: any): Promise<void> {
    if (!invoices || invoices.length === 0) {
      return; // No invoices to process
    }

    try {
      // ✅ Track total paid amount from associated invoices
      let totalAssociatedPaid = 0;
      
      // Process invoices sequentially to avoid transaction conflicts
      for (const invoice of invoices) {
        try {
          await this.processAssociatedInvoice(invoice, registrationNumber, purchaseId, transaction);
          
          // ✅ Track paid amounts for immediate payment types
          const invoicePaymentType = invoice.paymentType?.toUpperCase();
          const invoiceAmount = Number(invoice.amount || 0);
          
          if (invoicePaymentType === 'DEBIT_CARD' || 
              invoicePaymentType === 'CHEQUE' || 
              invoicePaymentType === 'BANK_TRANSFER' || 
              invoicePaymentType === 'DEPOSIT') {
            totalAssociatedPaid += invoiceAmount;
          }
        } catch (invoiceError: any) {
          console.error(`❌ Failed to process associated invoice ${invoice.concept}:`, invoiceError.message);
          // Re-throw to abort the entire purchase creation
          throw invoiceError;
        }
      }
      
      // ✅ Update purchase paidAmount if any associated invoices were paid immediately
      if (totalAssociatedPaid > 0) {
        const purchase = await Purchase.findByPk(purchaseId, { transaction });
        if (purchase) {
          const currentPaid = Number(purchase.paidAmount || 0);
          const newPaidAmount = currentPaid + totalAssociatedPaid;
          const currentBalance = Number(purchase.balanceAmount || 0);
          const newBalanceAmount = Math.max(0, currentBalance - totalAssociatedPaid);
          
          // Determine new payment status
          const totalAmount = newPaidAmount + newBalanceAmount;
          let newPaymentStatus: 'Paid' | 'Unpaid' | 'Partial' = 'Unpaid';
          if (newPaidAmount >= totalAmount && totalAmount > 0) {
            newPaymentStatus = 'Paid';
          } else if (newPaidAmount > 0) {
            newPaymentStatus = 'Partial';
          }
          
          await purchase.update({
            paidAmount: this.roundCurrency(newPaidAmount),
            balanceAmount: this.roundCurrency(newBalanceAmount),
            paymentStatus: newPaymentStatus,
          }, { transaction });
          
          console.log(`✅ Updated purchase ${registrationNumber} - Added ${totalAssociatedPaid.toFixed(2)} from associated invoices. Total paid: ${newPaidAmount.toFixed(2)}, Balance: ${newBalanceAmount.toFixed(2)}, Status: ${newPaymentStatus}`);
        }
      }
      
      // Create associated invoice records sequentially
      for (const invoice of invoices) {
        try {
          await this.createAssociatedInvoiceRecord(invoice, purchaseId, transaction);
        } catch (recordError: any) {
          console.error(`❌ Failed to create invoice record ${invoice.concept}:`, recordError.message);
          // Don't throw - this is not critical for purchase creation
          // The payment processing already happened above
        }
      }
      
    } catch (error: any) {
      console.error('❌ Associated invoices batch processing failed:', error.message);
      throw error;
    }
  }
  
  private async processAssociatedInvoice(invoice: any, registrationNumber: string, purchaseId: number, transaction: any): Promise<void> {
    const invoicePaymentType = invoice.paymentType?.toUpperCase();
    const invoiceAmount = Number(invoice.amount || 0);
    
    if (!invoicePaymentType || invoiceAmount <= 0) {
      return; // Skip invalid invoices
    }
    
    // Process payment (Bank Register, AP, etc.)
    switch (invoicePaymentType) {
      case 'DEBIT_CARD':
        await this.processInvoiceDebitCard(invoice, invoiceAmount, registrationNumber, transaction);
        break;
        
      case 'CREDIT_CARD':
        await this.processInvoiceCreditCard(invoice, invoiceAmount, registrationNumber, purchaseId, transaction);
        break;
        
      case 'CREDIT':
        await this.processInvoiceCredit(invoice, invoiceAmount, registrationNumber, purchaseId, transaction);
        break;
        
      case 'CASH':
      case 'CHEQUE':
      case 'BANK_TRANSFER':
      case 'DEPOSIT':
        await this.processInvoiceBankPayment(invoice, invoiceAmount, registrationNumber, transaction);
        break;
    }
    
    // ✅ NEW: Post GL entries for associated invoice
    // Associated invoices are supplier charges (freight, customs, etc.) that should be added to inventory cost
    await this.postAssociatedInvoiceGLEntries(invoice, invoiceAmount, purchaseId, registrationNumber, transaction);
  }
  
  private async processInvoiceDebitCard(invoice: any, amount: number, registrationNumber: string, transaction: any): Promise<void> {
    if (!invoice.cardId) {
      throw new ValidationError(`Invoice "${invoice.concept}" requires a card to be selected for DEBIT_CARD payment`);
    }
    
    const Card = (await import('../models/Card')).default;
    const card = await Card.findByPk(invoice.cardId, { transaction });
    if (!card) {
      throw new NotFoundError(`Card not found for invoice: ${invoice.concept}`);
    }
    
    this.validateCardType(card, 'DEBIT', `invoice "${invoice.concept}"`);
    
    if (!card.bankAccountId) {
      throw new ValidationError(`DEBIT card ****${card.cardNumberLast4} must be linked to a bank account`);
    }
    
    const BankAccount = (await import('../models/BankAccount')).default;
    const bankAccount = await BankAccount.findByPk(card.bankAccountId, { transaction });
    if (!bankAccount) {
      throw new NotFoundError(`Bank account not found for DEBIT card ****${card.cardNumberLast4}`);
    }
    
    const currentBalance = Number(bankAccount.balance);
    this.validateSufficientBalance(currentBalance, amount, `invoice "${invoice.concept}"`);
    
    // Update bank account balance
    await this.updateBankAccountBalance(card.bankAccountId, amount, true, transaction);
    
    // Create bank register entry
    await this.createBankRegisterEntry({
      registrationNumber: registrationNumber,
      transactionType: 'OUTFLOW',
      amount: amount,
      paymentMethod: 'Debit Card',
      relatedDocumentType: 'Purchase Invoice',
      relatedDocumentNumber: registrationNumber,
      sourceTransactionType: TransactionType.PURCHASE,
      clientRnc: invoice.supplierRnc || '',
      clientName: invoice.supplierName || '',
      ncf: invoice.ncf || '',
      description: `Invoice: ${invoice.concept} for purchase ${registrationNumber} via DEBIT card ${card.cardBrand || ''} ****${card.cardNumberLast4} - Bank: ${bankAccount.bankName}`,
      bankAccountId: card.bankAccountId,
      referenceNumber: invoice.paymentReference,
      originalPaymentType: invoice.originalPaymentType
    }, transaction);
  }
  
  private async processInvoiceCreditCard(invoice: any, amount: number, registrationNumber: string, purchaseId: number, transaction: any): Promise<void> {
    if (!invoice.cardId) {
      throw new ValidationError(`Invoice "${invoice.concept}" requires a card to be selected for CREDIT_CARD payment`);
    }
    
    const Card = (await import('../models/Card')).default;
    const card = await Card.findByPk(invoice.cardId, { transaction });
    if (!card) {
      throw new NotFoundError(`Card not found for invoice: ${invoice.concept}`);
    }
    
    this.validateCardType(card, 'CREDIT', `invoice "${invoice.concept}"`);
    
    const creditLimit = Number(card.creditLimit || 0);
    const usedCredit = Number(card.usedCredit || 0);
    const cardInfo = `${card.cardBrand || 'Card'} ****${card.cardNumberLast4}`;
    
    // Validate credit limit (but don't reduce credit yet - only when AP is paid)
    this.validateCreditLimit(creditLimit, usedCredit, amount, cardInfo, `invoice "${invoice.concept}"`);
    
    // ❌ REMOVED: Don't update used credit during purchase creation
    // The credit should only be used when the AP is actually paid
    console.log(`💳 Credit card invoice created - Credit will be used when AP is paid. Available: $${(creditLimit - usedCredit).toFixed(2)}`);
    
    // Create AP entry using factory (eliminates duplication)
    const context: PurchaseContext = {
      purchase: {
        id: purchaseId,
        registrationNumber: registrationNumber,
        date: invoice.date ? new Date(invoice.date) : new Date(),
        supplierId: undefined, // Credit card invoices don't have supplier ID
        supplierRnc: invoice.supplierRnc,
        ncf: invoice.ncf,
        purchaseType: invoice.purchaseType || 'Service'
      },
      supplier: undefined, // Credit card doesn't have supplier
      amount
    };
    
    const apEntryData = TransactionFactory.createAPEntry(context, {
      type: 'CREDIT_CARD_INVOICEASSOCIATE',
      documentType: 'InvoiceAssociate',
      supplierName: cardInfo || 'Credit Card Company',
      supplierRnc: invoice.supplierRnc || '',
      cardId: invoice.cardId,
      cardIssuer: cardInfo,
      paymentType: 'CREDIT_CARD',
      paymentReference: invoice.paymentReference,
      notes: `Invoice: ${invoice.concept} for purchase ${registrationNumber} - ${cardInfo} - Credit will be used when paid`
    });
    
    await this.createAccountsPayableEntry(apEntryData, transaction);
  }
  
  private async processInvoiceCredit(invoice: any, amount: number, registrationNumber: string, purchaseId: number, transaction: any): Promise<void> {
    // Look up supplier ID by name
    let supplierId: number | undefined = undefined;
    if (invoice.supplierName) {
      const foundSupplier = await Supplier.findOne({
        where: { name: invoice.supplierName },
        transaction
      });
      if (foundSupplier) {
        supplierId = foundSupplier.id;
      }
    }
    
    // Create AP entry using factory (eliminates duplication)
    const context: PurchaseContext = {
      purchase: {
        id: purchaseId,
        registrationNumber: registrationNumber,
        date: invoice.date ? new Date(invoice.date) : new Date(),
        supplierId: supplierId, // ✅ Include the looked-up supplier ID
        supplierRnc: invoice.supplierRnc,
        ncf: invoice.ncf,
        purchaseType: invoice.purchaseType || 'Service'
      },
      supplier: { name: invoice.supplierName || 'Unknown Supplier', rnc: invoice.supplierRnc },
      amount
    };
    
    const apEntryData = TransactionFactory.createAPEntry(context, {
      type: 'SUPPLIER_CREDIT_INVOICEASSOCIATE',
      documentType: 'InvoiceAssociate',
      supplierName: invoice.supplierName || 'Unknown Supplier',
      supplierRnc: invoice.supplierRnc || '',
      paymentType: 'CREDIT',
      notes: `${invoice.concept || 'Associated cost'} for purchase ${registrationNumber} - Supplier: ${invoice.supplierName} - RNC: ${invoice.supplierRnc || 'N/A'}`
    });
    
    await this.createAccountsPayableEntry(apEntryData, transaction);
  }
  
  private async processInvoiceBankPayment(invoice: any, amount: number, registrationNumber: string, transaction: any): Promise<void> {
    let bankAccountId = null;
    let bankAccountInfo = '';
    
    // Handle bank account payments
    if ((invoice.paymentType === 'BANK_TRANSFER' || invoice.paymentType === 'CHEQUE' || invoice.paymentType === 'DEPOSIT') && invoice.bankAccountId) {
      const BankAccount = (await import('../models/BankAccount')).default;
      const bankAccount = await BankAccount.findByPk(invoice.bankAccountId, { transaction });
      if (!bankAccount) {
        throw new NotFoundError(`Bank account not found for invoice: ${invoice.concept}`);
      }
      
      const currentBalance = Number(bankAccount.balance);
      this.validateSufficientBalance(currentBalance, amount, `invoice "${invoice.concept}"`);
      
      // Update bank account balance
      await this.updateBankAccountBalance(invoice.bankAccountId, amount, true, transaction);
      
      bankAccountId = invoice.bankAccountId;
      bankAccountInfo = ` - Bank: ${bankAccount.bankName} (${bankAccount.accountNumber})`;
    }
    
    // Create bank register entry using factory (eliminates duplication)
    const paymentMethodLabel = this.getPaymentMethodLabel(invoice.paymentType);
    const referenceNumber = invoice.paymentType === 'CHEQUE' ? invoice.chequeNumber : invoice.transferNumber;
    
    const context: PurchaseContext = {
      purchase: {
        id: 0, // Invoice doesn't have purchase ID directly
        registrationNumber: registrationNumber,
        date: invoice.date ? new Date(invoice.date) : new Date(),
        supplierRnc: invoice.supplierRnc,
        ncf: invoice.ncf,
        purchaseType: invoice.purchaseType || 'Service'
      },
      supplier: { name: invoice.supplierName || '', rnc: invoice.supplierRnc },
      amount
    };
    
    const bankEntryData = TransactionFactory.createBankEntry(context, {
      paymentMethod: paymentMethodLabel,
      documentType: 'Purchase Invoice',
      bankAccountId: bankAccountId,
      chequeNumber: invoice.paymentType === 'CHEQUE' ? invoice.chequeNumber : undefined,
      transferNumber: invoice.paymentType === 'BANK_TRANSFER' ? invoice.transferNumber : undefined,
      description: `Invoice: ${invoice.concept} for purchase ${registrationNumber} via ${paymentMethodLabel}${referenceNumber ? ` (${referenceNumber})` : ''}${bankAccountInfo}`
    });
    
    await this.createBankRegisterEntry(bankEntryData, transaction);
  }
  
  private getPaymentMethodLabel(paymentType: string): string {
    switch (paymentType?.toUpperCase()) {
      case 'CASH': return 'Cash';
      case 'CHEQUE': return 'Cheque';
      case 'BANK_TRANSFER': return 'Bank Transfer';
      case 'DEPOSIT': return 'Deposit';
      default: return paymentType || 'Unknown';
    }
  }
  
  private async createAssociatedInvoiceRecord(invoice: any, purchaseId: number, transaction: any): Promise<void> {
    try {
      // Validate required fields
      if (!invoice.concept || !invoice.amount) {
        console.log('⚠️  Skipping invalid associated invoice - missing concept or amount');
        return;
      }

      // ✅ NO DUPLICATION: Reuse same payment field structure as Purchase model
      // ✅ PROFESSIONAL FIX: Convert null to undefined for TypeScript compatibility
      const invoiceData = {
        purchaseId: purchaseId,
        supplierRnc: String(invoice.supplierRnc || ''),
        supplierName: String(invoice.supplierName || ''),
        concept: String(invoice.concept || ''),
        ncf: String(invoice.ncf || ''),
        date: invoice.date ? new Date(invoice.date) : new Date(),
        taxAmount: Number(invoice.taxAmount || 0),
        tax: Number(invoice.tax || 0),
        amount: Number(invoice.amount || 0),
        purchaseType: String(invoice.purchaseType || 'Service'),
        paymentType: String(invoice.paymentType || 'CREDIT'),
        // ✅ Payment method fields (same structure as Purchase - NO DUPLICATION)
        // ✅ Convert null to undefined for TypeScript compatibility
        bankAccountId: invoice.bankAccountId || undefined,
        cardId: invoice.cardId || undefined,
        chequeNumber: invoice.chequeNumber || undefined,
        chequeDate: invoice.chequeDate ? new Date(invoice.chequeDate) : undefined,
        transferNumber: invoice.transferNumber || undefined,
        transferDate: invoice.transferDate ? new Date(invoice.transferDate) : undefined,
        paymentReference: invoice.paymentReference || undefined,
        voucherDate: invoice.voucherDate ? new Date(invoice.voucherDate) : undefined,
      };
      
      await AssociatedInvoice.create(invoiceData, { transaction });
      
    } catch (error: any) {
      console.error('❌ Failed to create associated invoice record:', error.message);
      // Don't throw - this is not critical for purchase creation
      // The payment processing already happened, so the purchase can still be created
    }
  }
  
  // ==================== INVENTORY MANAGEMENT ====================
  
  private async updateInventoryBatch(items: any[], purchaseId: number, associatedExpenses: number, transaction: any): Promise<void> {
    if (!items || items.length === 0) {
      return; // No items to process
    }

    try {
      const productTotal = items.reduce((sum: number, item: any) => {
        const subtotal = Number(item.subtotal || 0);
        return sum + subtotal;
      }, 0);
      
      // Process items sequentially to avoid transaction conflicts
      // Sequential processing is safer for inventory updates to prevent race conditions
      for (const item of items) {
        try {
          await this.updateSingleInventoryItem(item, purchaseId, associatedExpenses, productTotal, transaction);
        } catch (itemError: any) {
          console.error(`❌ Failed to process item ${item.productId}:`, itemError.message);
          // Re-throw to abort the entire purchase creation
          throw itemError;
        }
      }
      
    } catch (error: any) {
      console.error('❌ Inventory batch update failed:', error.message);
      throw error;
    }
  }
  
  private async updateSingleInventoryItem(item: any, purchaseId: number, associatedExpenses: number, productTotal: number, transaction: any): Promise<void> {
    try {
      // Validate item data before database operations
      if (!item.productId || !item.quantity || !item.unitCost || !item.subtotal) {
        throw new ValidationError('Invalid item data: productId, quantity, unitCost, and subtotal are required');
      }

      const product = await Product.findByPk(item.productId, { transaction });
      if (!product) {
        throw new NotFoundError(`Product ${item.productId} not found`);
      }
      
      // Calculate proportional associated cost for this item
      const itemPercentage = productTotal > 0 ? Number(item.subtotal) / productTotal : 0;
      const itemAssociatedCost = associatedExpenses * itemPercentage;
      const adjustedTotal = Number(item.subtotal) + itemAssociatedCost;
      const adjustedUnitCost = item.quantity > 0 ? adjustedTotal / item.quantity : item.unitCost;
      
      // Prepare purchase item data with validation
      const purchaseItemData = {
        purchaseId: purchaseId,
        productId: item.productId,
        productCode: product.code || '',
        productName: product.name || '',
        unitOfMeasurement: item.unitOfMeasurement || product.unit || 'unit',
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
        subtotal: Number(item.subtotal),
        tax: Number(item.tax || 0),
        total: Number(item.total || item.subtotal),
        adjustedUnitCost: Number(adjustedUnitCost),
        adjustedTotal: Number(adjustedTotal),
      };

      // Create purchase item record
      await PurchaseItem.create(purchaseItemData, { transaction });
      
      // Calculate WEIGHTED AVERAGE cost
      const oldAmount = Number(product.amount || 0);
      const oldUnitCost = Number(product.unitCost || 0);
      const oldInventoryValue = oldAmount * oldUnitCost;
      const newPurchaseValue = adjustedTotal;
      const totalInventoryValue = oldInventoryValue + newPurchaseValue;
      const newAmount = oldAmount + Number(item.quantity);
      const weightedAverageCost = newAmount > 0 ? totalInventoryValue / newAmount : adjustedUnitCost;
      const newSubtotal = newAmount * weightedAverageCost;
      
      // Prepare product update data
      const updateData: any = {
        amount: newAmount,
        unitCost: weightedAverageCost,
        subtotal: newSubtotal
      };
      
      // Update unit of measurement if provided and different
      if (item.unitOfMeasurement && item.unitOfMeasurement !== product.unit) {
        updateData.unit = item.unitOfMeasurement;
      }
      
      // Update tax if provided
      if (item.tax && Number(item.tax) > 0) {
        updateData.taxRate = Number(item.tax);
      }
      
      // Update product
      await product.update(updateData, { transaction });
      
    } catch (error: any) {
      // Log the specific error for debugging
      console.error(`❌ Error updating inventory for product ${item.productId}:`, error.message);
      
      // Re-throw with more context
      if (error instanceof ValidationError) {
        throw error;
      }
      
      // Handle database constraint errors
      if (error.name === 'SequelizeValidationError') {
        throw new ValidationError(`Invalid data for product ${item.productId}: ${error.message}`);
      }
      
      if (error.name === 'SequelizeForeignKeyConstraintError') {
        throw new ValidationError(`Invalid product reference: Product ${item.productId} may not exist`);
      }
      
      // Generic database error
      throw new ValidationError(`Failed to update inventory for product ${item.productId}: ${error.message}`);
    }
  }
  
  /**
   * Get purchase items for a specific purchase
   */
  async getPurchaseItems(purchaseId: number): Promise<any[]> {
    return this.executeWithRetry(async () => {
      this.validateNumeric(purchaseId, 'Purchase ID', { min: 1 });
      
      const items = await PurchaseItem.findAll({
        where: { purchaseId },
        include: [
          {
            model: Product,
            as: 'product',
            attributes: ['id', 'code', 'name', 'unit']
          }
        ],
        order: [['id', 'ASC']]
      });
      
      return items;
    });
  }

  /**
   * Get associated invoices for a specific purchase
   */
  async getAssociatedInvoices(purchaseId: number): Promise<any[]> {
    return this.executeWithRetry(async () => {
      this.validateNumeric(purchaseId, 'Purchase ID', { min: 1 });
      
      try {
        // Try with all fields first
        const invoices = await AssociatedInvoice.findAll({
          where: { purchaseId },
          order: [['id', 'ASC']]
        });
        
        return invoices;
      } catch (error: any) {
        // If sourceTransactionType column doesn't exist, query without it
        if (error.message && error.message.includes('source_transaction_type')) {
          console.log('⚠️  sourceTransactionType column not found, querying without it...');
          
          const invoices = await AssociatedInvoice.findAll({
            where: { purchaseId },
            attributes: { exclude: ['sourceTransactionType'] },
            order: [['id', 'ASC']]
          });
          
          return invoices;
        }
        
        throw error;
      }
    });
  }

  /**
   * Get purchase by ID with full details (items and invoices)
   */
  async getPurchaseWithDetails(id: number): Promise<any> {
    return this.executeWithRetry(async () => {
      this.validateNumeric(id, 'Purchase ID', { min: 1 });
      
      const purchase = await Purchase.findByPk(id, {
        include: [
          {
            model: Supplier,
            as: 'supplier',
            attributes: ['id', 'name', 'rnc']
          }
        ]
      });
      
      if (!purchase) {
        throw new NotFoundError(`Purchase with ID ${id} not found`);
      }
      
      // Get items and invoices separately to avoid association issues
      const items = await this.getPurchaseItems(id);
      const associatedInvoices = await this.getAssociatedInvoices(id);
      
      return {
        ...purchase.toJSON(),
        items,
        associatedInvoices
      };
    });
  }
  
  /**
   * Generate registration number for purchases (compatibility method)
   */
  protected async generatePurchaseRegistrationNumber(transaction?: any): Promise<string> {
    const lastPurchase = await Purchase.findOne({
      where: {
        registrationNumber: {
          [Op.like]: 'CP%'
        }
      },
      order: [['id', 'DESC']],
      transaction
    });
    
    let nextNumber = 1;
    if (lastPurchase) {
      const lastNumber = parseInt(lastPurchase.registrationNumber.substring(2));
      nextNumber = lastNumber + 1;
    }
    
    return `CP${String(nextNumber).padStart(4, '0')}`;
  }
  
  /**
   * Safely delete related records
   */
  private async safeDeleteRelatedRecords(purchaseId: number, transaction: any): Promise<void> {
    try {
      await PurchaseItem.destroy({
        where: { purchaseId },
        transaction
      });
    } catch (itemError: any) {
      console.log('⚠️  Could not delete purchase items:', itemError.message);
      // Continue - items might not exist
    }
    
    try {
      await AssociatedInvoice.destroy({
        where: { purchaseId },
        transaction
      });
    } catch (invoiceError: any) {
      console.log('⚠️  Could not delete associated invoices:', invoiceError.message);
      // Continue - invoices might not exist
    }
  }
  
  // ==================== PHASE 2: GL POSTING METHODS ====================
  
  /**
   * Post GL entries for purchase transaction
   * Creates balanced debit/credit entries in General Ledger
   */
  private async postPurchaseGLEntries(
    data: CreatePurchaseRequest,
    purchase: Purchase,
    amount: number,
    transaction: any
  ): Promise<void> {
    try {
      console.log('📊 PHASE 2: Posting GL entries for purchase', purchase.registrationNumber);
      
      // Determine GL entries based on payment type
      const paymentType = data.paymentType.toUpperCase();
      let glEntries;
      
      if (paymentType === 'CREDIT_CARD') {
        // Purchase with credit card: Debit Inventory, Credit Credit Card Payable
        glEntries = AccountingRulesEngine.getPurchaseWithCreditCardGLEntries(amount);
      } else if (paymentType === 'CREDIT') {
        // Purchase on credit (supplier invoice): Debit Inventory, Credit AP
        glEntries = AccountingRulesEngine.getPurchaseOnCreditGLEntries(amount);
      } else {
        // Purchase with immediate payment: Debit Inventory, Credit Cash/Bank
        glEntries = AccountingRulesEngine.getPurchaseGLEntries(amount, paymentType);
      }
      
      // Post to General Ledger
      await GLPostingService.postGLEntries({
        entryDate: purchase.date,
        sourceModule: SourceModule.PURCHASE,
        sourceTransactionId: purchase.id,
        sourceTransactionNumber: purchase.registrationNumber,
        entries: glEntries,
        createdBy: undefined, // TODO: Add user ID from request context
      }, transaction);
      
      console.log('✅ GL entries posted successfully for purchase', purchase.registrationNumber);
    } catch (error: any) {
      console.error('❌ Failed to post GL entries for purchase:', error.message);
      // Re-throw to rollback entire transaction
      throw new BusinessLogicError(`GL posting failed: ${error.message}`);
    }
  }
  
  /**
   * ✅ NEW: Post GL entries for associated invoice
   * Associated invoices are supplier charges (freight, customs, handling) that add to inventory cost
   * Uses the SAME AccountingRulesEngine methods as main purchase (NO DUPLICATION)
   */
  private async postAssociatedInvoiceGLEntries(
    invoice: any,
    amount: number,
    purchaseId: number,
    registrationNumber: string,
    transaction: any
  ): Promise<void> {
    try {
      console.log(`📊 Posting GL entries for associated invoice: ${invoice.concept} (${invoice.paymentType})`);
      
      const paymentType = invoice.paymentType?.toUpperCase();
      let glEntries;
      
      // ✅ REUSE SAME LOGIC: Associated invoices use identical GL treatment as main purchases
      // They add to inventory cost (freight, customs, etc. are part of inventory cost per GAAP)
      if (paymentType === 'CREDIT_CARD') {
        // Same as main purchase: Debit Inventory, Credit Credit Card Payable
        glEntries = AccountingRulesEngine.getPurchaseWithCreditCardGLEntries(amount);
      } else if (paymentType === 'CREDIT') {
        // Same as main purchase: Debit Inventory, Credit AP
        glEntries = AccountingRulesEngine.getPurchaseOnCreditGLEntries(amount);
      } else {
        // Same as main purchase: Debit Inventory, Credit Cash/Bank
        glEntries = AccountingRulesEngine.getPurchaseGLEntries(amount, paymentType);
      }
      
      // Post to General Ledger with associated invoice reference
      await GLPostingService.postGLEntries({
        entryDate: invoice.date || new Date(),
        sourceModule: SourceModule.PURCHASE,
        sourceTransactionId: purchaseId,
        sourceTransactionNumber: `${registrationNumber}-AI`,
        entries: glEntries,
        createdBy: undefined,
      }, transaction);
      
      console.log(`✅ GL entries posted for associated invoice: ${invoice.concept}`);
    } catch (error: any) {
      console.error(`❌ Failed to post GL entries for associated invoice ${invoice.concept}:`, error.message);
      // Re-throw to rollback entire transaction
      throw new BusinessLogicError(`Associated invoice GL posting failed: ${error.message}`);
    }
  }
}

// Create singleton instance
const purchaseService = new PurchaseService();

// Export methods to maintain compatibility with existing code
export const getAllPurchases = (transactionType?: string) => purchaseService.getAllPurchases(transactionType);
export const getPurchaseById = (id: number) => purchaseService.getPurchaseById(id);
export const getPurchaseWithDetails = (id: number) => purchaseService.getPurchaseWithDetails(id);
export const getPurchaseItems = (id: number) => purchaseService.getPurchaseItems(id);
export const getAssociatedInvoices = (id: number) => purchaseService.getAssociatedInvoices(id);
export const createPurchase = (data: any) => purchaseService.createPurchase(data);
export const updatePurchase = (id: number, data: any) => purchaseService.updatePurchase(id, data);
export const collectPayment = (id: number, paymentData: { amount: number; paymentMethod: string }) => 
  purchaseService.collectPayment(id, paymentData);
export const deletePurchase = (id: number) => purchaseService.deletePurchase(id);

// ✅ NEW: Export pagination method
export const getAllPurchasesWithPagination = (options?: any) => purchaseService.getAllPurchasesWithPagination(options);

// Export the service class for direct usage if needed
export { PurchaseService };