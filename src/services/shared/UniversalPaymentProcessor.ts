/**
 * ============================================================================
 * UNIVERSAL PAYMENT PROCESSOR
 * ============================================================================
 * 
 * DRY (Don't Repeat Yourself) Payment Processing Service
 * 
 * This service eliminates code duplication across:
 * - Purchases
 * - Fixed Assets
 * - Investments
 * - Prepaid Expenses
 * - Business Expenses
 * 
 * Architecture: Strategy Pattern + Factory Pattern
 * Time Complexity: O(1) for payment processing
 * Space Complexity: O(1) for payment data
 * 
 * @author Senior Developer
 * @date 2026-05-04
 */

import { Transaction } from 'sequelize';
import BankAccount from '../../models/BankAccount';
import Card from '../../models/Card';
import Supplier from '../../models/Supplier';
import { TransactionFactory } from './TransactionFactory';
import { 
  ValidationError, 
  NotFoundError, 
  InsufficientBalanceError 
} from '../../core/AppError';
import { TransactionType } from '../../types/TransactionType';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PaymentData {
  paymentType: string;
  bankAccountId?: number;
  cardId?: number;
  chequeNumber?: string;
  chequeDate?: Date | string;
  transferNumber?: string;
  transferDate?: Date | string;
  paymentReference?: string;
  voucherDate?: Date | string;
  supplierId?: number;
  supplierRnc?: string;
  ncf?: string;
}

export interface TransactionContext {
  id: number;
  registrationNumber: string;
  date: Date;
  amount: number;
  type: 'FIXED_ASSET' | 'INVESTMENT' | 'PREPAID_EXPENSE' | 'PURCHASE' | 'EXPENSE';
  description: string;
}

export interface PaymentResult {
  success: boolean;
  paymentType: string;
  bankAccountId?: number;
  cardId?: number;
  message: string;
}

// ============================================================================
// UNIVERSAL PAYMENT PROCESSOR CLASS
// ============================================================================

export class UniversalPaymentProcessor {
  
  /**
   * Process payment for any transaction type
   * 
   * @param paymentData - Payment information
   * @param context - Transaction context
   * @param transaction - Database transaction
   * @param callbacks - Service callbacks for creating entries
   */
  static async processPayment(
    paymentData: PaymentData,
    context: TransactionContext,
    transaction: Transaction,
    callbacks: {
      createBankEntry: (data: any, transaction: Transaction) => Promise<void>;
      createAPEntry: (data: any, transaction: Transaction) => Promise<void>;
      updateBankBalance: (bankAccountId: number, amount: number, isDebit: boolean, transaction: Transaction) => Promise<void>;
    }
  ): Promise<PaymentResult> {
    
    const paymentType = paymentData.paymentType?.toUpperCase();
    
    console.log(`💳 Processing ${paymentType} payment for ${context.type}:`, {
      id: context.id,
      registrationNumber: context.registrationNumber,
      amount: context.amount
    });

    switch (paymentType) {
      case 'CHEQUE':
      case 'BANK_TRANSFER':
        return await this.processBankPayment(paymentData, context, transaction, callbacks);
      
      case 'DEBIT_CARD':
        return await this.processDebitCardPayment(paymentData, context, transaction, callbacks);
      
      case 'CREDIT_CARD':
        return await this.processCreditCardPayment(paymentData, context, transaction, callbacks);
      
      case 'CREDIT':
        return await this.processCreditPayment(paymentData, context, transaction, callbacks);
      
      case 'CASH':
        return await this.processCashPayment(paymentData, context, transaction, callbacks);
      
      default:
        throw new ValidationError(`Unsupported payment type: ${paymentType}`);
    }
  }

  // ==========================================================================
  // BANK PAYMENT (CHEQUE, BANK_TRANSFER)
  // ==========================================================================

  private static async processBankPayment(
    paymentData: PaymentData,
    context: TransactionContext,
    transaction: Transaction,
    callbacks: any
  ): Promise<PaymentResult> {
    
    if (!paymentData.bankAccountId) {
      throw new ValidationError('Bank account is required for bank payments');
    }

    // Validate payment-specific fields
    if (paymentData.paymentType === 'CHEQUE') {
      if (!paymentData.chequeNumber) {
        throw new ValidationError('Cheque number is required for cheque payments');
      }
      if (!paymentData.chequeDate) {
        throw new ValidationError('Cheque date is required for cheque payments');
      }
    }

    if (paymentData.paymentType === 'BANK_TRANSFER') {
      if (!paymentData.transferNumber) {
        throw new ValidationError('Transfer number is required for bank transfers');
      }
      if (!paymentData.transferDate) {
        throw new ValidationError('Transfer date is required for bank transfers');
      }
    }

    // Fetch bank account
    const bankAccount = await BankAccount.findByPk(paymentData.bankAccountId, { transaction });
    if (!bankAccount) {
      throw new NotFoundError(`Bank account with ID ${paymentData.bankAccountId} not found`);
    }

    // Validate sufficient balance
    const currentBalance = Number(bankAccount.balance);
    if (currentBalance < context.amount) {
      const shortfall = context.amount - currentBalance;
      throw new InsufficientBalanceError(
        `Insufficient balance in ${bankAccount.bankName} (${bankAccount.accountNumber}). ` +
        `Available: ${currentBalance.toFixed(2)}, Required: ${context.amount.toFixed(2)}. ` +
        `Shortfall: ${shortfall.toFixed(2)}`
      );
    }

    // Update bank account balance
    await callbacks.updateBankBalance(paymentData.bankAccountId, context.amount, true, transaction);

    // Create bank register entry
    const paymentMethodLabel = paymentData.paymentType === 'CHEQUE' ? 'Cheque' : 'Bank Transfer';
    const referenceNumber = paymentData.paymentType === 'CHEQUE' 
      ? paymentData.chequeNumber 
      : paymentData.transferNumber;

    const bankEntryData = {
      registrationNumber: context.registrationNumber,
      transactionType: 'OUTFLOW' as const,
      amount: context.amount,
      paymentMethod: paymentMethodLabel,
      relatedDocumentType: context.type,
      relatedDocumentNumber: context.registrationNumber,
      sourceTransactionType: this.getTransactionType(context.type),
      clientRnc: paymentData.supplierRnc || '',
      clientName: context.description,
      ncf: paymentData.ncf || '',
      description: `Payment for ${context.type.toLowerCase()} ${context.registrationNumber} via ${paymentMethodLabel} (${referenceNumber}) - Bank: ${bankAccount.bankName} (${bankAccount.accountNumber})`,
      bankAccountId: paymentData.bankAccountId,
      chequeNumber: paymentData.paymentType === 'CHEQUE' ? paymentData.chequeNumber : undefined,
      transferNumber: paymentData.paymentType === 'BANK_TRANSFER' ? paymentData.transferNumber : undefined,
      originalPaymentType: paymentMethodLabel,
    };

    await callbacks.createBankEntry(bankEntryData, transaction);

    console.log(`✅ ${paymentMethodLabel} payment processed successfully`);

    return {
      success: true,
      paymentType: paymentData.paymentType,
      bankAccountId: paymentData.bankAccountId,
      message: `${paymentMethodLabel} payment processed successfully`
    };
  }

  // ==========================================================================
  // DEBIT CARD PAYMENT
  // ==========================================================================

  private static async processDebitCardPayment(
    paymentData: PaymentData,
    context: TransactionContext,
    transaction: Transaction,
    callbacks: any
  ): Promise<PaymentResult> {
    
    if (!paymentData.cardId) {
      throw new ValidationError('Card is required for debit card payments');
    }

    if (!paymentData.paymentReference) {
      throw new ValidationError('Payment reference is required for card payments');
    }

    if (!paymentData.voucherDate) {
      throw new ValidationError('Voucher date is required for card payments');
    }

    // Fetch card
    const card = await Card.findByPk(paymentData.cardId, { transaction });
    if (!card) {
      throw new NotFoundError('Card not found');
    }

    if (card.cardType !== 'DEBIT') {
      throw new ValidationError('Selected card is not a DEBIT card');
    }

    if (!card.bankAccountId) {
      throw new ValidationError('DEBIT card must be linked to a bank account');
    }

    // Fetch linked bank account
    const bankAccount = await BankAccount.findByPk(card.bankAccountId, { transaction });
    if (!bankAccount) {
      throw new NotFoundError('Bank account not found for this DEBIT card');
    }

    // Validate balance
    const currentBalance = Number(bankAccount.balance);
    if (currentBalance < context.amount) {
      const shortfall = context.amount - currentBalance;
      const cardInfo = `${card.cardBrand || 'Card'} ****${card.cardNumberLast4}`;
      throw new InsufficientBalanceError(
        `Insufficient balance in bank account linked to DEBIT card ${cardInfo}. ` +
        `Available: ${currentBalance.toFixed(2)}, Required: ${context.amount.toFixed(2)}. ` +
        `Shortfall: ${shortfall.toFixed(2)}`
      );
    }

    // Update bank account balance
    await callbacks.updateBankBalance(card.bankAccountId, context.amount, true, transaction);

    // Create bank register entry
    const cardInfo = `${card.cardBrand || 'Card'} ****${card.cardNumberLast4}`;
    const bankEntryData = {
      registrationNumber: context.registrationNumber,
      transactionType: 'OUTFLOW' as const,
      amount: context.amount,
      paymentMethod: 'Debit Card',
      relatedDocumentType: context.type,
      relatedDocumentNumber: context.registrationNumber,
      sourceTransactionType: this.getTransactionType(context.type),
      clientRnc: paymentData.supplierRnc || '',
      clientName: context.description,
      ncf: paymentData.ncf || '',
      description: `Payment for ${context.type.toLowerCase()} ${context.registrationNumber} via DEBIT card ${cardInfo} - Bank: ${bankAccount.bankName} (${bankAccount.accountNumber}) - Ref: ${paymentData.paymentReference}`,
      bankAccountId: card.bankAccountId,
      referenceNumber: paymentData.paymentReference,
      originalPaymentType: 'Debit Card',
    };

    await callbacks.createBankEntry(bankEntryData, transaction);

    console.log(`✅ DEBIT card payment processed successfully`);

    return {
      success: true,
      paymentType: 'DEBIT_CARD',
      cardId: paymentData.cardId,
      bankAccountId: card.bankAccountId,
      message: 'DEBIT card payment processed successfully'
    };
  }

  // ==========================================================================
  // CREDIT CARD PAYMENT
  // ==========================================================================

  private static async processCreditCardPayment(
    paymentData: PaymentData,
    context: TransactionContext,
    transaction: Transaction,
    callbacks: any
  ): Promise<PaymentResult> {
    
    if (!paymentData.cardId) {
      throw new ValidationError('Card is required for credit card payments');
    }

    if (!paymentData.paymentReference) {
      throw new ValidationError('Payment reference is required for card payments');
    }

    if (!paymentData.voucherDate) {
      throw new ValidationError('Voucher date is required for card payments');
    }

    // Fetch card
    const card = await Card.findByPk(paymentData.cardId, { transaction });
    if (!card) {
      throw new NotFoundError('Card not found');
    }

    if (card.cardType !== 'CREDIT') {
      throw new ValidationError('Selected card is not a CREDIT card');
    }

    // Validate credit limit
    const creditLimit = Number(card.creditLimit || 0);
    const usedCredit = Number(card.usedCredit || 0);
    const availableCredit = creditLimit - usedCredit;

    if (availableCredit < context.amount) {
      const shortfall = context.amount - availableCredit;
      const cardInfo = `${card.cardBrand || 'Card'} ****${card.cardNumberLast4}`;
      throw new InsufficientBalanceError(
        `Insufficient credit limit on CREDIT card ${cardInfo}. ` +
        `Available: ${availableCredit.toFixed(2)}, Required: ${context.amount.toFixed(2)}. ` +
        `Shortfall: ${shortfall.toFixed(2)}`
      );
    }

    // Create AP entry (credit card liability)
    const cardInfo = `${card.cardBrand || 'Card'} ****${card.cardNumberLast4}`;
    
    // Determine the AP type based on the context type
    const apType = this.getCreditCardAPType(context.type);
    
    const apEntryData = {
      registrationNumber: context.registrationNumber,
      registrationDate: new Date(),  // ✅ Added
      type: apType,  // ✅ Updated to use dynamic type
      sourceTransactionType: this.getTransactionType(context.type),  // ✅ Added
      relatedDocumentType: context.type,
      relatedDocumentId: context.id,
      relatedDocumentNumber: context.registrationNumber,
      supplierId: paymentData.supplierId,
      supplierName: cardInfo,
      supplierRnc: paymentData.supplierRnc || '',
      ncf: paymentData.ncf || '',
      purchaseDate: context.date,
      purchaseType: context.type,
      paymentType: 'CREDIT_CARD',
      cardId: card.id,
      cardIssuer: cardInfo,
      paymentReference: paymentData.paymentReference,
      amount: context.amount,
      paidAmount: 0,  // ✅ Added
      balanceAmount: context.amount,  // ✅ Added
      status: 'Pending',  // ✅ Added
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),  // ✅ Added (30 days)
      notes: `Credit card ${context.type.toLowerCase()} ${context.registrationNumber} - ${cardInfo} - Ref: ${paymentData.paymentReference} - Credit will be used when paid`,
    };

    await callbacks.createAPEntry(apEntryData, transaction);

    console.log(`✅ CREDIT card payment processed successfully (AP created, credit will be used when paid)`);

    return {
      success: true,
      paymentType: 'CREDIT_CARD',
      cardId: paymentData.cardId,
      message: 'CREDIT card payment processed successfully (AP created)'
    };
  }

  // ==========================================================================
  // CREDIT PAYMENT (SUPPLIER CREDIT)
  // ==========================================================================

  private static async processCreditPayment(
    paymentData: PaymentData,
    context: TransactionContext,
    transaction: Transaction,
    callbacks: any
  ): Promise<PaymentResult> {
    
    // Fetch supplier if available
    let supplier = null;
    if (paymentData.supplierId) {
      supplier = await Supplier.findByPk(paymentData.supplierId, { transaction });
    }

    // Determine the AP type based on the context type
    const apType = this.getCreditAPType(context.type);

    // Create AP entry
    const apEntryData = {
      registrationNumber: context.registrationNumber,
      registrationDate: new Date(),  // ✅ Added
      type: apType,  // ✅ Updated to use dynamic type
      sourceTransactionType: this.getTransactionType(context.type),  // ✅ Added
      relatedDocumentType: context.type,
      relatedDocumentId: context.id,
      relatedDocumentNumber: context.registrationNumber,
      supplierId: paymentData.supplierId,
      supplierName: supplier?.name || context.description,
      supplierRnc: paymentData.supplierRnc || supplier?.rnc || '',
      ncf: paymentData.ncf || '',
      purchaseDate: context.date,
      purchaseType: context.type,
      paymentType: 'CREDIT',
      amount: context.amount,
      paidAmount: 0,  // ✅ Added
      balanceAmount: context.amount,  // ✅ Added
      status: 'Pending',  // ✅ Added
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),  // ✅ Added (30 days)
      notes: `Credit ${context.type.toLowerCase()} ${context.registrationNumber} - ${supplier?.name || context.description}`,
    };

    await callbacks.createAPEntry(apEntryData, transaction);

    console.log(`✅ CREDIT payment processed successfully (AP created)`);

    return {
      success: true,
      paymentType: 'CREDIT',
      message: 'CREDIT payment processed successfully (AP created)'
    };
  }

  // ==========================================================================
  // CASH PAYMENT
  // ==========================================================================

  private static async processCashPayment(
    paymentData: PaymentData,
    context: TransactionContext,
    transaction: Transaction,
    callbacks: any
  ): Promise<PaymentResult> {
    
    // For CASH payments, we would typically:
    // 1. Reduce cash register balance
    // 2. Create cash register entry
    // 
    // For now, we'll just log it (implement cash register integration later)
    
    console.log(`💵 CASH payment processed for ${context.type} ${context.registrationNumber}`);

    return {
      success: true,
      paymentType: 'CASH',
      message: 'CASH payment processed successfully'
    };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private static getTransactionType(contextType: string): TransactionType {
    const typeMap: Record<string, TransactionType> = {
      'FIXED_ASSET': TransactionType.FIXED_ASSET_PURCHASE,
      'INVESTMENT': TransactionType.INVESTMENT_PURCHASE,
      'PREPAID_EXPENSE': TransactionType.PREPAID_EXPENSE,
      'PURCHASE': TransactionType.PURCHASE,
      'BUSINESS_EXPENSE': TransactionType.BUSINESS_EXPENSE,
    };

    return typeMap[contextType] || TransactionType.PURCHASE;
  }

  /**
   * Get the appropriate AP type for credit card purchases based on context type
   */
  private static getCreditCardAPType(contextType: string): string {
    const typeMap: Record<string, string> = {
      'FIXED_ASSET': 'CREDIT_CARD_FIXED_ASSET',
      'INVESTMENT': 'CREDIT_CARD_INVESTMENT',
      'PREPAID_EXPENSE': 'CREDIT_CARD_PREPAID_EXPENSE',
      'PURCHASE': 'CREDIT_CARD_PURCHASE',
      'EXPENSE': 'CREDIT_CARD_EXPENSE',
      'BUSINESS_EXPENSE': 'CREDIT_CARD_EXPENSE',
    };

    return typeMap[contextType] || 'CREDIT_CARD_PURCHASE';
  }

  /**
   * Get the appropriate AP type for credit purchases based on context type
   */
  private static getCreditAPType(contextType: string): string {
    const typeMap: Record<string, string> = {
      'FIXED_ASSET': 'CREDIT_FIXED_ASSET',
      'INVESTMENT': 'CREDIT_INVESTMENT',
      'PREPAID_EXPENSE': 'CREDIT_PREPAID_EXPENSE',
      'PURCHASE': 'CREDIT_PURCHASE',
      'EXPENSE': 'CREDIT_EXPENSE',
      'BUSINESS_EXPENSE': 'CREDIT_EXPENSE',
    };

    return typeMap[contextType] || 'CREDIT_PURCHASE';
  }
}
