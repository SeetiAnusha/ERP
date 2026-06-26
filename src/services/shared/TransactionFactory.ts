// Simple Transaction Factory - Eliminates duplication without over-engineering
import { TransactionType } from '../../types/TransactionType';

// Import AP types
import { APContext, APBankPaymentOptions, APCardPaymentOptions } from '../../types/APTransactionTypes';

// Simple, focused interfaces
export interface PurchaseContext {
  purchase: {
    id: number;
    registrationNumber: string;
    date: Date;
    supplierId?: number;
    supplierRnc?: string;
    ncf?: string;
    purchaseType: string;
  };
  supplier?: {
    name: string;
    rnc?: string;
  };
  amount: number;
}

export interface BankEntryOptions {
  paymentMethod: string;
  documentType: string;
  bankAccountId?: number;
  chequeNumber?: string;
  transferNumber?: string;
  referenceNumber?: string;
  description?: string;
}

export interface APEntryOptions {
  type: string;
  documentType: string;
  supplierName: string;
  supplierRnc?: string;
  cardId?: number;
  cardIssuer?: string;
  paymentType: string;
  paymentReference?: string;
  notes?: string;
}

/**
 * Simple factory to eliminate duplication in purchase service
 * No over-engineering - just solves the immediate problem
 */
export class TransactionFactory {
  
  /**
   * Create bank register entry data - eliminates 5+ duplicated calls
   */
  static createBankEntry(context: PurchaseContext, options: BankEntryOptions) {
    return {
      registrationNumber: context.purchase.registrationNumber,
      transactionType: 'OUTFLOW' as const,
      amount: context.amount,
      paymentMethod: options.paymentMethod,
      relatedDocumentType: options.documentType,
      relatedDocumentNumber: context.purchase.registrationNumber,
      sourceTransactionType: TransactionType.PURCHASE,
      clientRnc: context.supplier?.rnc || context.purchase.supplierRnc || '',
      clientName: context.supplier?.name || 'Unknown Supplier',
      ncf: context.purchase.ncf || '',
      description: options.description || `Payment for ${options.documentType.toLowerCase()} ${context.purchase.registrationNumber} via ${options.paymentMethod}`,
      bankAccountId: options.bankAccountId,
      bankAccountName: '', // Will be populated by the service when bank account is loaded
      chequeNumber: options.chequeNumber || undefined,
      transferNumber: options.transferNumber || undefined,
      referenceNumber: options.referenceNumber || undefined,
      supplierId: context.purchase.supplierId,
      originalPaymentType: options.paymentMethod, // Use actual payment method instead of hardcoded 'CREDIT'
    };
  }

  /**
   * Create accounts payable entry data.
   * All NOT NULL columns from the AccountsPayable model are explicitly set here
   * so bulkCreate never hits a NOT NULL constraint regardless of model defaults.
   *
   * NOT NULL columns in accounts_payable:
   *   registrationNumber, registrationDate, type, sourceTransactionType,
   *   relatedDocumentType, relatedDocumentId, relatedDocumentNumber,
   *   amount, paidAmount, balanceAmount, status
   */
  static createAPEntry(context: PurchaseContext, options: APEntryOptions) {
    return {
      // ── Required NOT NULL fields ──────────────────────────────────────────
      registrationNumber:    context.purchase.registrationNumber,
      registrationDate:      context.purchase.date ?? new Date(),
      type:                  options.type,
      sourceTransactionType: TransactionType.PURCHASE,          // always PURCHASE from this factory
      relatedDocumentType:   options.documentType,
      relatedDocumentId:     context.purchase.id,
      relatedDocumentNumber: context.purchase.registrationNumber,
      amount:                context.amount,
      paidAmount:            0,
      balanceAmount:         context.amount,
      status:                'Unpaid',

      // ── Optional supplier / card fields ───────────────────────────────────
      supplierId:            context.purchase.supplierId,
      supplierName:          options.supplierName,
      supplierRnc:           options.supplierRnc ?? context.supplier?.rnc ?? '',
      ncf:                   context.purchase.ncf ?? '',
      purchaseDate:          context.purchase.date,
      purchaseType:          context.purchase.purchaseType,
      paymentType:           options.paymentType,
      cardId:                options.cardId,
      cardIssuer:            options.cardIssuer,
      paymentReference:      options.paymentReference,

      // ── Soft-delete defaults ──────────────────────────────────────────────
      deletion_status:       'NONE',
      is_reversal:           false,

      notes: options.notes ?? `${options.type} for ${options.documentType.toLowerCase()} ${context.purchase.registrationNumber}`,
    };
  }

  /**
   * Create bank register entry data for AP PAYMENT - eliminates duplication in AP service
   */
  static createAPBankEntry(context: APContext, options: APBankPaymentOptions) {
    return {
      registrationDate: options.paidDate || new Date(),
      transactionType: 'OUTFLOW' as const,
      sourceTransactionType: TransactionType.PAYMENT,
      amount: context.amount,
      paymentMethod: options.paymentMethod,
      relatedDocumentType: 'Accounts Payable Payment',
      relatedDocumentNumber: context.ap.registrationNumber,
      clientRnc: context.ap.supplierRnc || '',
      clientName: context.ap.supplierName || context.ap.cardIssuer || '',
      ncf: context.ap.ncf || '',
      description: options.description || `AP Payment ${context.ap.registrationNumber} - ${context.ap.supplierName || context.ap.cardIssuer}`,
      bankAccountId: options.bankAccountId,
      referenceNumber: options.reference,
    };
  }

  /**
   * Create debit card payment data for AP - eliminates duplication
   */
  static createAPDebitCardEntry(context: APContext, card: any, cardInfo: string, options: APCardPaymentOptions) {
    return {
      registrationNumber: context.ap.registrationNumber,
      registrationDate: options.paidDate || new Date(),
      transactionType: 'OUTFLOW' as const,
      amount: context.amount,
      paymentMethod: 'Debit Card',
      relatedDocumentType: 'Accounts Payable Payment',
      relatedDocumentNumber: context.ap.registrationNumber,
      clientRnc: context.ap.supplierRnc || '',
      clientName: context.ap.supplierName || '',
      ncf: context.ap.ncf || '',
      description: `AP Payment ${context.ap.registrationNumber} via DEBIT card ${cardInfo}`,
      bankAccountId: card.bankAccountId,
    };
  }

  /**
   * Get payment method label for bank register - eliminates duplication
   */
  static getPaymentMethodForBankRegister(paymentMethod?: string): string {
    const methodMap: Record<string, string> = {
      'Bank Transfer': 'Bank Transfer',
      'Cheque': 'Cheque',
      'Debit Card': 'Debit Card',
      'Credit Card': 'Credit Card',
      'Cash': 'Cash',
      'Deposit': 'Deposit'
    };
    
    return methodMap[paymentMethod || ''] || paymentMethod || 'Bank Transfer';
  }
}