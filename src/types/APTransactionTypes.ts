// AP Transaction Types - Eliminates duplication in AP Service
import { TransactionType } from './TransactionType';

// AP-specific context
export interface APContext {
  ap: {
    id: number;
    registrationNumber: string;
    supplierName: string;
    supplierRnc?: string;
    ncf?: string;
    type: string;
    cardId?: number;
    cardIssuer?: string;
  };
  amount: number;
}

// Bank payment options for AP
export interface APBankPaymentOptions {
  paymentMethod: string;
  bankAccountId: number;
  paidDate?: Date;
  reference?: string;
  description?: string;
}

// Card payment options for AP
export interface APCardPaymentOptions {
  cardId: number;
  paidDate?: Date;
  reference?: string;
  description?: string;
}

// Bank register entry data for AP payments
export interface APBankRegisterEntryData {
  registrationNumber: string;
  registrationDate: Date;
  transactionType: 'INFLOW' | 'OUTFLOW';
  amount: number;
  paymentMethod: string;
  relatedDocumentType: string;
  relatedDocumentNumber: string;
  sourceTransactionType: TransactionType;
  clientRnc: string;
  clientName: string;
  ncf: string;
  description: string;
  bankAccountId?: number;
  referenceNumber?: string;
}

// Payment request interface
export interface APPaymentRequest {
  amount: number;
  paymentMethod: string;
  bankAccountId?: number;
  cardId?: number;
  paidDate?: Date;
  reference?: string;
  notes?: string;
}