// Core transaction types for the refactored system
import { TransactionType } from './TransactionType';

export interface TransactionContext {
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
    id: number;
    name: string;
    rnc?: string;
  };
  amount: number;
  transaction: any; // Database transaction
}

export interface BankEntryConfig {
  paymentMethod: 'Bank Transfer' | 'Cheque' | 'Debit Card' | 'Deposit';
  documentType: 'Purchase' | 'Purchase Invoice';
  bankAccountId?: number;
  chequeNumber?: string;
  transferNumber?: string;
  paymentReference?: string;
  description?: string;
}

export interface APEntryConfig {
  type: 'CREDIT_CARD_PURCHASE' | 'SUPPLIER_CREDIT';
  documentType: 'Purchase' | 'InvoiceAssociate';
  supplierName: string;
  supplierRnc?: string;
  cardId?: number;
  cardIssuer?: string;
  paymentType: string;
  notes?: string;
}

export interface BankRegisterEntryData {
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
}

export interface AccountsPayableEntryData {
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
  amount: number;
  notes?: string;
}