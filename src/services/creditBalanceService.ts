import CreditBalance from '../models/CreditBalance';
import { Op } from 'sequelize';
import sequelize from '../config/database';
import { BaseService } from '../core/BaseService';
import { ValidationError, NotFoundError, BusinessLogicError } from '../core/AppError';
import { TransactionType } from '../types/TransactionType';

export interface OverpaymentValidationResult {
  isOverpayment: boolean;
  overpaymentAmount: number;
  message: string;
  allowProceed: boolean;
}

export interface CreditCreationData {
  type: 'CUSTOMER_CREDIT' | 'SUPPLIER_CREDIT';
  relatedEntityType: 'CLIENT' | 'SUPPLIER';
  relatedEntityId: number;
  relatedEntityName: string;
  originalTransactionType: 'AR' | 'AP';
  originalTransactionId: number;
  originalTransactionNumber: string;
  creditAmount: number;
  notes?: string;
}

export interface CreditApplicationRequest {
  entityType: 'CLIENT' | 'SUPPLIER';
  entityId: number;
  invoicesToUpdate: any[];
  maxCreditToUse?: number;
}

/**
 * Credit Balance Service - Class-based implementation following Purchase Service pattern
 * Handles credit balance creation, validation, and application to invoices
 */
class CreditBalanceService extends BaseService {

  // ==================== PUBLIC API METHODS ====================

  /**
   * Get all credit balances with filtering and validation
   */
  async getAllCreditBalances(options: any = {}): Promise<any> {
    return this.executeWithRetry(async () => {
      console.log('🔍 Service: getAllCreditBalances called with options:', options);
      
      // Check if pagination is requested
      if (options.page || options.limit) {
        // Use generic pagination from BaseService
        const result = await this.getAllWithPagination(
          CreditBalance,
          {
            ...options,
            searchFields: ['registrationNumber', 'relatedEntityName', 'originalTransactionNumber'],
            dateField: 'registrationDate'
          }
        );
        
        console.log(` Retrieved ${result.data.length} of ${result.pagination.total} credit balances (Page ${result.pagination.page}/${result.pagination.totalPages})`);
        return result;
      }
      
      // Backward compatibility - return all records with filters
      const { entityType, entityId } = options;
      
      // Build where clause based on filters
      const whereClause: any = {};
      if (entityType) {
        this.validateEntityType(entityType);
        whereClause.relatedEntityType = entityType;
      }
      if (entityId) {
        this.validateNumeric(entityId, 'Entity ID', { min: 1 });
        whereClause.relatedEntityId = entityId;
      }
      
      const creditBalances = await CreditBalance.findAll({
        where: whereClause,
        order: [['registrationDate', 'DESC']],
      });
      
      console.log(`✅ Retrieved ${creditBalances.length} credit balances successfully`);
      return creditBalances;
    });
  }

  /**
   * Get credit balance by ID with validation
   */
  async getCreditBalanceById(id: number): Promise<CreditBalance> {
    return this.executeWithRetry(async () => {
      this.validateNumeric(id, 'Credit Balance ID', { min: 1 });
      
      const creditBalance = await CreditBalance.findByPk(id);
      if (!creditBalance) {
        throw new NotFoundError(`Credit Balance with ID ${id} not found`);
      }
      
      return creditBalance;
    });
  }

  /**
   * Get all active credit balances with available amounts
   */
  async getActiveCreditBalances(): Promise<CreditBalance[]> {
    return this.executeWithRetry(async () => {
      return await CreditBalance.findAll({
        where: {
          status: 'ACTIVE',
          availableAmount: {
            [Op.gt]: 0
          }
        },
        order: [['registrationDate', 'DESC']]
      });
    });
  }

  /**
   * Get available credit balance amount for entity
   */
  async getAvailableCreditAmount(entityType: 'CLIENT' | 'SUPPLIER', entityId: number): Promise<number> {
    return this.executeWithRetry(async () => {
      this.validateEntityType(entityType);
      this.validateNumeric(entityId, 'Entity ID', { min: 1 });
      
      const credits = await CreditBalance.findAll({
        where: {
          relatedEntityType: entityType,
          relatedEntityId: entityId,
          status: 'ACTIVE',
          availableAmount: {
            [Op.gt]: 0
          }
        }
      });
      
      const totalAvailable = credits.reduce((total, credit) => total + Number(credit.availableAmount), 0);
      console.log(`💰 Total available credit for ${entityType} ${entityId}: ₹${totalAvailable}`);
      
      return totalAvailable;
    });
  }

  /**
   * Get credit balances by entity with validation
   */
  async getCreditBalancesByEntity(entityType: 'CLIENT' | 'SUPPLIER', entityId: number): Promise<CreditBalance[]> {
    return this.executeWithRetry(async () => {
      this.validateEntityType(entityType);
      this.validateNumeric(entityId, 'Entity ID', { min: 1 });
      
      return await CreditBalance.findAll({
        where: {
          relatedEntityType: entityType,
          relatedEntityId: entityId
        },
        order: [['registrationDate', 'DESC']]
      });
    });
  }

  /**
   * Validate payment amount for overpayment detection
   */
  async validatePaymentAmount(
    outstandingBalance: number,
    paymentAmount: number,
    entityType: 'CLIENT' | 'SUPPLIER',
    entityName: string
  ): Promise<OverpaymentValidationResult> {
    return this.executeWithRetry(async () => {
      // Validate inputs
      this.validateNumeric(outstandingBalance, 'Outstanding balance', { min: 0 });
      this.validateNumeric(paymentAmount, 'Payment amount', { min: 0 });
      this.validateEntityType(entityType);
      
      if (!entityName || entityName.trim().length === 0) {
        throw new ValidationError('Entity name is required');
      }
      
      const isOverpayment = paymentAmount > outstandingBalance;
      
      if (!isOverpayment) {
        return {
          isOverpayment: false,
          overpaymentAmount: 0,
          message: 'Payment amount is within outstanding balance',
          allowProceed: true
        };
      }
      
      const overpaymentAmount = paymentAmount - outstandingBalance;
      const entityTypeText = entityType === 'CLIENT' ? 'customer' : 'supplier';
      
      return {
        isOverpayment: true,
        overpaymentAmount,
        message: `Payment amount (₹${paymentAmount.toFixed(2)}) exceeds outstanding balance (₹${outstandingBalance.toFixed(2)}) by ₹${overpaymentAmount.toFixed(2)}. This will create a credit balance of ₹${overpaymentAmount.toFixed(2)} for ${entityTypeText} "${entityName}".`,
        allowProceed: true // Client requirement: show alert but allow to proceed
      };
    });
  }

  /**
   * Create credit balance with comprehensive validation and transaction management
   */
  async createCreditBalance(data: CreditCreationData, externalTransaction?: any): Promise<CreditBalance> {
    return this.executeWithTransaction(async (transaction) => {
      // Step 1: Comprehensive validation
      this.validateCreditCreationData(data);
      
      // Step 2: Generate registration number
      const registrationNumber = await this.generateCreditBalanceRegistrationNumber(transaction);
      
      // Step 3: Create credit balance record
      const creditBalanceData = {
        registrationNumber,
        registrationDate: new Date(),
        type: data.type,
        relatedEntityType: data.relatedEntityType,
        relatedEntityId: data.relatedEntityId,
        relatedEntityName: data.relatedEntityName,
        originalTransactionType: data.originalTransactionType,
        originalTransactionId: data.originalTransactionId,
        originalTransactionNumber: data.originalTransactionNumber,
        creditAmount: data.creditAmount,
        usedAmount: 0,
        availableAmount: data.creditAmount,
        status: 'ACTIVE' as const,
        notes: data.notes || `Credit created from overpayment on ${data.originalTransactionNumber}`,
      };
      
      console.log('💾 Creating credit balance record:', JSON.stringify(creditBalanceData, null, 2));
      
      const creditBalance = await CreditBalance.create(creditBalanceData, { transaction });
      
      console.log('✅ Credit balance created successfully:', {
        id: creditBalance.id,
        registrationNumber: creditBalance.registrationNumber,
        creditAmount: creditBalance.creditAmount,
        availableAmount: creditBalance.availableAmount
      });
      
      return creditBalance;
    }, externalTransaction);
  }

  /**
   * Apply credit balances to invoices with validation and transaction management
   */
  async applyCreditToInvoices(request: CreditApplicationRequest): Promise<{
    totalCreditUsed: number;
    remainingInvoiceBalance: number;
    updatedCredits: CreditBalance[];
    updatedInvoices: any[];
  }> {
    return this.executeWithTransaction(async (transaction) => {
      // Step 1: Validate request
      this.validateCreditApplicationRequest(request);
      
      // Step 2: Get available credits
      const availableCredits = await this.getAvailableCreditBalancesForApplication(
        request.entityType,
        request.entityId,
        transaction
      );
      
      if (availableCredits.length === 0) {
        throw new BusinessLogicError(`No available credit balances found for ${request.entityType} ID ${request.entityId}`);
      }
      
      // Step 3: Apply credits to invoices
      return await this.processCreditApplication(
        availableCredits,
        request.invoicesToUpdate,
        request.maxCreditToUse,
        transaction
      );
    });
  }

  /**
   * Update credit balance status
   */
  async updateCreditBalanceStatus(id: number, status: 'ACTIVE' | 'FULLY_USED' | 'EXPIRED'): Promise<CreditBalance> {
    return this.executeWithTransaction(async (transaction) => {
      this.validateNumeric(id, 'Credit Balance ID', { min: 1 });
      
      const creditBalance = await CreditBalance.findByPk(id, { transaction });
      if (!creditBalance) {
        throw new NotFoundError(`Credit Balance with ID ${id} not found`);
      }
      
      // Business rule validation
      if (creditBalance.status === 'FULLY_USED' && status === 'ACTIVE') {
        throw new BusinessLogicError('Cannot reactivate a fully used credit balance');
      }
      
      await creditBalance.update({ status }, { transaction });
      
      return creditBalance;
    });
  }

  /**
   * Delete credit balance with business rule validation
   */
  async deleteCreditBalance(id: number): Promise<{ message: string }> {
    return this.executeWithTransaction(async (transaction) => {
      this.validateNumeric(id, 'Credit Balance ID', { min: 1 });
      
      const creditBalance = await CreditBalance.findByPk(id, { transaction });
      if (!creditBalance) {
        throw new NotFoundError(`Credit Balance with ID ${id} not found`);
      }
      
      // Business rule validation
      if (Number(creditBalance.usedAmount) > 0) {
        throw new BusinessLogicError('Cannot delete a credit balance that has been partially or fully used');
      }
      
      await creditBalance.destroy({ transaction });
      
      return { message: 'Credit balance deleted successfully' };
    });
  }

  // ==================== VALIDATION METHODS ====================

  private validateEntityType(entityType: string): void {
    const validTypes = ['CLIENT', 'SUPPLIER'];
    if (!validTypes.includes(entityType)) {
      throw new ValidationError(`Invalid entity type: ${entityType}. Must be CLIENT or SUPPLIER`);
    }
  }

  private validateCreditCreationData(data: CreditCreationData): void {
    // Required field validation
    if (!data.type) {
      throw new ValidationError('Credit type is required');
    }
    
    if (!['CUSTOMER_CREDIT', 'SUPPLIER_CREDIT'].includes(data.type)) {
      throw new ValidationError('Credit type must be CUSTOMER_CREDIT or SUPPLIER_CREDIT');
    }
    
    this.validateEntityType(data.relatedEntityType);
    
    this.validateNumeric(data.relatedEntityId, 'Related entity ID', { min: 1 });
    
    if (!data.relatedEntityName || data.relatedEntityName.trim().length === 0) {
      throw new ValidationError('Related entity name is required');
    }
    
    if (!['AR', 'AP'].includes(data.originalTransactionType)) {
      throw new ValidationError('Original transaction type must be AR or AP');
    }
    
    this.validateNumeric(data.originalTransactionId, 'Original transaction ID', { min: 1 });
    
    if (!data.originalTransactionNumber || data.originalTransactionNumber.trim().length === 0) {
      throw new ValidationError('Original transaction number is required');
    }
    
    this.validateNumeric(data.creditAmount, 'Credit amount', { min: 0.01 });
  }

  private validateCreditApplicationRequest(request: CreditApplicationRequest): void {
    this.validateEntityType(request.entityType);
    this.validateNumeric(request.entityId, 'Entity ID', { min: 1 });
    
    if (!request.invoicesToUpdate || request.invoicesToUpdate.length === 0) {
      throw new ValidationError('At least one invoice is required for credit application');
    }
    
    // Validate each invoice
    for (const invoice of request.invoicesToUpdate) {
      if (!invoice.id) {
        throw new ValidationError('All invoices must have a valid ID');
      }
      
      if (!invoice.balanceAmount || Number(invoice.balanceAmount) <= 0) {
        throw new ValidationError('All invoices must have a positive balance amount');
      }
    }
    
    if (request.maxCreditToUse !== undefined) {
      this.validateNumeric(request.maxCreditToUse, 'Max credit to use', { min: 0 });
    }
  }

  // ==================== UTILITY METHODS ====================

  private async generateCreditBalanceRegistrationNumber(transaction?: any): Promise<string> {
    const lastCB = await CreditBalance.findOne({
      where: {
        registrationNumber: {
          [Op.like]: 'CB%'
        }
      },
      order: [['id', 'DESC']],
      transaction
    });
    
    let nextNumber = 1;
    if (lastCB) {
      const lastNumber = parseInt(lastCB.registrationNumber.substring(2));
      nextNumber = lastNumber + 1;
    }
    
    const registrationNumber = `CB${String(nextNumber).padStart(4, '0')}`;
    console.log('📝 Generated registration number:', registrationNumber);
    
    return registrationNumber;
  }

  private async getAvailableCreditBalancesForApplication(
    entityType: 'CLIENT' | 'SUPPLIER',
    entityId: number,
    transaction?: any
  ): Promise<CreditBalance[]> {
    console.log(`🔍 Fetching available credit balances for ${entityType} ID: ${entityId}`);
    
    const credits = await CreditBalance.findAll({
      where: {
        relatedEntityType: entityType,
        relatedEntityId: entityId,
        status: 'ACTIVE',
        availableAmount: {
          [Op.gt]: 0
        }
      },
      order: [['registrationDate', 'ASC']], // FIFO - First In, First Out
      transaction
    });
    
    console.log(`✅ Found ${credits.length} available credit balances with total: ₹${credits.reduce((sum, c) => sum + parseFloat((c.availableAmount || 0).toString()), 0)}`);
    
    return credits;
  }

  private async processCreditApplication(
    availableCredits: CreditBalance[],
    invoicesToUpdate: any[],
    maxCreditToUse: number | undefined,
    transaction: any
  ): Promise<{
    totalCreditUsed: number;
    remainingInvoiceBalance: number;
    updatedCredits: CreditBalance[];
    updatedInvoices: any[];
  }> {
    console.log('🎯 Starting credit application to invoices...');
    
    let totalCreditUsed = 0;
    const updatedCredits: CreditBalance[] = [];
    const updatedInvoices: any[] = [];
    
    // Calculate total invoice balance
    const totalInvoiceBalance = invoicesToUpdate.reduce((sum, invoice) => 
      sum + parseFloat(invoice.balanceAmount.toString()), 0
    );
    
    console.log(`💰 Total invoice balance to pay: ₹${totalInvoiceBalance}`);
    
    // Determine maximum credit to use
    const totalAvailableCredit = availableCredits.reduce((sum, credit) => 
      sum + parseFloat(credit.availableAmount.toString()), 0
    );
    
    const maxCreditAllowed = maxCreditToUse !== undefined 
      ? Math.min(maxCreditToUse, totalAvailableCredit, totalInvoiceBalance)
      : Math.min(totalAvailableCredit, totalInvoiceBalance);
    
    let remainingCreditToUse = maxCreditAllowed;
    
    // Apply credits in FIFO order
    for (const credit of availableCredits) {
      if (remainingCreditToUse <= 0) break;
      
      const availableAmount = parseFloat((credit.availableAmount || 0).toString());
      const amountToUse = Math.min(availableAmount, remainingCreditToUse);
      
      if (amountToUse > 0) {
        console.log(`💳 Using ₹${amountToUse} from credit ${credit.registrationNumber}`);
        
        // Update credit balance
        const newUsedAmount = parseFloat((credit.usedAmount || 0).toString()) + amountToUse;
        const newAvailableAmount = parseFloat((credit.creditAmount || 0).toString()) - newUsedAmount;
        const newStatus = newAvailableAmount <= 0.01 ? 'FULLY_USED' : 'ACTIVE';
        
        await credit.update({
          usedAmount: newUsedAmount,
          availableAmount: Math.max(0, newAvailableAmount),
          status: newStatus
        }, { transaction });
        
        updatedCredits.push(credit);
        totalCreditUsed += amountToUse;
        remainingCreditToUse -= amountToUse;
        
        console.log(`✅ Credit ${credit.registrationNumber} updated: Used ₹${newUsedAmount}, Available ₹${newAvailableAmount}, Status: ${newStatus}`);
      }
    }
    
    // Update invoices with credit applications
    let remainingCreditToApply = totalCreditUsed;
    
    for (const invoice of invoicesToUpdate) {
      if (remainingCreditToApply <= 0) break;
      
      const invoiceBalance = parseFloat((invoice.balanceAmount || 0).toString());
      const creditToApplyToThisInvoice = Math.min(invoiceBalance, remainingCreditToApply);
      
      if (creditToApplyToThisInvoice > 0) {
        const newReceivedAmount = parseFloat((invoice.receivedAmount || 0).toString()) + creditToApplyToThisInvoice;
        const newBalanceAmount = parseFloat((invoice.amount || 0).toString()) - newReceivedAmount;
        const newStatus = newBalanceAmount <= 0.01 ? 'Received' : 'Partial';
        
        await invoice.update({
          receivedAmount: newReceivedAmount,
          balanceAmount: Math.max(0, newBalanceAmount),
          status: newStatus
        }, { transaction });
        
        updatedInvoices.push(invoice);
        remainingCreditToApply -= creditToApplyToThisInvoice;
        
        console.log(`📄 Invoice ${invoice.registrationNumber} updated: Received ₹${newReceivedAmount}, Balance ₹${newBalanceAmount}, Status: ${newStatus}`);
        
        // 🔄 Update related Business Expense if this AP is from a business expense
        await this.updateRelatedBusinessExpenseForCredit(invoice, creditToApplyToThisInvoice, newStatus, transaction);
        
        // 🚫 REMOVED: No separate register entry for credit usage in AR transactions
        // The full payment amount is recorded in the customer credit aware payment service
      }
    }
    
    // Calculate remaining invoice balance after credit application
    const remainingInvoiceBalance = invoicesToUpdate.reduce((sum, invoice) => {
      const balance = invoice.balanceAmount || 0;
      return sum + parseFloat(balance.toString());
    }, 0);
    
    console.log('🎉 Credit application completed:', {
      totalCreditUsed,
      remainingInvoiceBalance,
      creditsUpdated: updatedCredits.length,
      invoicesUpdated: updatedInvoices.length
    });
    
    return {
      totalCreditUsed,
      remainingInvoiceBalance,
      updatedCredits,
      updatedInvoices
    };
  }

  /**
   * Create Cash Register or Bank Register entry when credit balance is used
   * This maintains proper audit trail and accounting integrity
   */
  private async createRegisterEntryForCreditUsage(
    invoice: any,
    creditAmount: number,
    transaction: any
  ): Promise<void> {
    try {
      console.log(`💳 Creating register entry for credit usage: ₹${creditAmount} on ${invoice.registrationNumber}`);
      
      // Validate inputs
      if (!invoice || !invoice.registrationNumber) {
        console.warn('⚠️ Invalid invoice data for credit usage entry');
        return;
      }
      
      if (creditAmount <= 0) {
        console.warn('⚠️ Invalid credit amount for register entry');
        return;
      }
      
      // Determine if this is AR or AP transaction
      const isARTransaction = invoice.type && ['CREDIT_SALE', 'CLIENT_CREDIT', 'CREDIT_CARD_SALE', 'DEBIT_CARD_SALE'].includes(invoice.type);
      const isAPTransaction = !isARTransaction; // Assume AP if not AR
      
      console.log(`📋 Transaction type detected: ${isARTransaction ? 'AR (Customer)' : 'AP (Supplier)'}`);
      
      if (isARTransaction) {
        // For AR (Customer) transactions - create Cash Register entry
        await this.createCashRegisterEntryForCredit(invoice, creditAmount, transaction);
      } else {
        // For AP (Supplier) transactions - create Bank Register entry (assuming bank payments)
        await this.createBankRegisterEntryForCredit(invoice, creditAmount, transaction);
      }
      
      console.log(`✅ Register entry created for credit usage: ₹${creditAmount}`);
      
    } catch (error: any) {
      console.error('❌ Error creating register entry for credit usage:', error);
      // Don't throw - this shouldn't block the credit application
      // The credit application is the primary operation
    }
  }

  /**
   * Create Cash Register entry for customer credit usage (AR transactions)
   */
  private async createCashRegisterEntryForCredit(
    invoice: any,
    creditAmount: number,
    transaction: any
  ): Promise<void> {
    try {
      // Import Cash Register service
      const { cashRegisterService } = await import('./cashRegisterService');
      
      // Get default cash register (you may need to modify this based on your business logic)
      const CashRegisterMaster = (await import('../models/CashRegisterMaster')).default;
      const defaultCashRegister = await CashRegisterMaster.findOne({
        order: [['id', 'ASC']], // Get first cash register as default
        transaction
      });
      
      if (!defaultCashRegister) {
        console.warn('⚠️ No cash register found for credit usage entry');
        return;
      }
      
      const cashRegisterData = {
        registrationDate: new Date(),
        transactionType: 'INFLOW' as const,
        amount: creditAmount,
        paymentMethod: 'CREDIT_BALANCE_USAGE',
        relatedDocumentType: 'CREDIT_USAGE',
        relatedDocumentNumber: invoice.registrationNumber,
        description: `Credit balance used for invoice ${invoice.registrationNumber} - Customer: ${invoice.clientName || 'Unknown'}`,
        customerId: invoice.clientId || null,
        customerName: invoice.clientName || 'Credit Usage',
        clientName: invoice.clientName || 'Credit Usage', // Add clientName for compatibility
        cashRegisterId: defaultCashRegister.id,
        skipCreditBalanceCreation: true // Prevent recursive credit creation
      };
      
      console.log(`💰 Creating cash register entry for credit usage: ₹${creditAmount}`);
      await cashRegisterService.createCashTransaction(cashRegisterData, transaction);
      console.log(`✅ Cash register entry created successfully`);
      
    } catch (error: any) {
      console.error('❌ Error creating cash register entry for credit usage:', error);
      // Don't throw - log error but continue
    }
  }

  /**
   * Create Bank Register entry for supplier credit usage (AP transactions)
   */
  private async createBankRegisterEntryForCredit(
    invoice: any,
    creditAmount: number,
    transaction: any
  ): Promise<void> {
    // Import Bank Register service
    const bankRegisterService = (await import('./bankRegisterService')).default;
    
    // Get default bank account (you may need to modify this based on your business logic)
    const BankAccount = (await import('../models/BankAccount')).default;
    const defaultBankAccount = await BankAccount.findOne({
      order: [['id', 'ASC']], // Get first bank account as default
      transaction
    });
    
    if (!defaultBankAccount) {
      console.warn('⚠️ No bank account found for credit usage entry');
      return;
    }
    
    const bankRegisterData = {
      registrationDate: new Date(),
      transactionType: 'OUTFLOW' as const,
      sourceTransactionType: TransactionType.CREDIT_USAGE,
      amount: creditAmount,
      paymentMethod: 'CREDIT_BALANCE_USAGE',
      relatedDocumentType: 'CREDIT_USAGE',
      relatedDocumentNumber: invoice.registrationNumber,
      description: `Credit balance used for invoice ${invoice.registrationNumber} - Supplier: ${invoice.supplierName || 'Unknown'}`,
      clientName: invoice.supplierName || 'Credit Usage',
      clientRnc: '',
      bankAccountId: defaultBankAccount.id,
      originalPaymentType: 'CREDIT_BALANCE'
    };
    
    await bankRegisterService.createBankRegister(bankRegisterData, transaction);
  }

  /**
   * Update related Business Expense when credit balance is applied to AP payment
   * This ensures business expense records stay in sync when credit payments are made
   */
  private async updateRelatedBusinessExpenseForCredit(
    ap: any, 
    creditAmount: number, 
    apStatus: string, 
    transaction: any
  ): Promise<void> {
    try {
      // Check if this AP is related to a business expense
      if (ap.relatedDocumentType === 'Business Expense' && ap.relatedDocumentId) {
        console.log(`🔄 [CreditBalance] Updating related business expense ${ap.relatedDocumentId} for credit payment`);
        
        // Import BusinessExpense model
        const BusinessExpense = (await import('../models/BusinessExpense')).default;
        
        // Get the business expense
        const businessExpense = await BusinessExpense.findByPk(ap.relatedDocumentId, { transaction });
        
        if (businessExpense) {
          // Calculate new payment amounts for the business expense
          const currentPaidAmount = Number(businessExpense.paidAmount || 0);
          const newPaidAmount = currentPaidAmount + creditAmount;
          const totalAmount = Number(businessExpense.amount);
          const newBalanceAmount = totalAmount - newPaidAmount;
          
          // Determine new payment status
          let newPaymentStatus = 'Partial';
          if (newBalanceAmount <= 0) {
            newPaymentStatus = 'Paid';
          } else if (newPaidAmount <= 0) {
            newPaymentStatus = 'Unpaid';
          }
          
          // Update the business expense
          await businessExpense.update({
            paidAmount: this.roundCurrency(newPaidAmount),
            balanceAmount: this.roundCurrency(Math.max(0, newBalanceAmount)),
            paymentStatus: newPaymentStatus
          }, { transaction });
          
          console.log(`✅ [CreditBalance] Updated business expense ${businessExpense.registrationNumber}:`);
          console.log(`   - Paid Amount: ₹${currentPaidAmount} → ₹${newPaidAmount} (Credit: ₹${creditAmount})`);
          console.log(`   - Balance: ₹${totalAmount - currentPaidAmount} → ₹${newBalanceAmount}`);
          console.log(`   - Status: ${businessExpense.paymentStatus} → ${newPaymentStatus}`);
        } else {
          console.log(`⚠️ [CreditBalance] Business expense ${ap.relatedDocumentId} not found`);
        }
      }
    } catch (error: any) {
      console.error('❌ [CreditBalance] Error updating related business expense:', error);
      // Don't throw - this shouldn't block the credit payment
      // The credit payment is the primary operation
    }
  }
}

// Export class for testing and advanced usage
export { CreditBalanceService };

// Export singleton instance
export const creditBalanceService = new CreditBalanceService();

// Export individual methods for backward compatibility
export const getAllCreditBalances = (options?: any) => 
  creditBalanceService.getAllCreditBalances(options);

export const getAllCreditBalancesWithPagination = (options?: any) => 
  creditBalanceService.getAllCreditBalances(options);

export const getCreditBalanceById = (id: number) => 
  creditBalanceService.getCreditBalanceById(id);

export const getActiveCreditBalances = () => 
  creditBalanceService.getActiveCreditBalances();

export const getAvailableCreditBalance = (entityType: 'CLIENT' | 'SUPPLIER', entityId: number) => 
  creditBalanceService.getAvailableCreditAmount(entityType, entityId);

export const getCreditBalancesByEntity = (entityType: 'CLIENT' | 'SUPPLIER', entityId: number) => 
  creditBalanceService.getCreditBalancesByEntity(entityType, entityId);

export const validatePaymentAmount = (
  outstandingBalance: number,
  paymentAmount: number,
  entityType: 'CLIENT' | 'SUPPLIER',
  entityName: string
) => creditBalanceService.validatePaymentAmount(outstandingBalance, paymentAmount, entityType, entityName);

export const createCreditBalance = (data: CreditCreationData, externalTransaction?: any) => 
  creditBalanceService.createCreditBalance(data, externalTransaction);

export const applyCreditToInvoices = (
  availableCredits: CreditBalance[],
  invoicesToUpdate: any[],
  transaction: any
) => {
  // Legacy method - convert to new format
  const request: CreditApplicationRequest = {
    entityType: 'CLIENT', // Default - this should be passed from caller
    entityId: 0, // Default - this should be passed from caller
    invoicesToUpdate
  };
  
  // Note: This legacy method doesn't have proper entity info
  // Recommend updating callers to use the new applyCreditToInvoices method
  console.warn('⚠️ Using legacy applyCreditToInvoices method. Consider updating to use creditBalanceService.applyCreditToInvoices()');
  
  return creditBalanceService['processCreditApplication'](availableCredits, invoicesToUpdate, undefined, transaction);
};

export const getAllActiveCreditBalances = () => 
  creditBalanceService.getActiveCreditBalances();

export const getAvailableCreditBalances = (entityType: 'CLIENT' | 'SUPPLIER', entityId: number) => 
  creditBalanceService['getAvailableCreditBalancesForApplication'](entityType, entityId);

export default creditBalanceService;