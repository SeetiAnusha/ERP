// Cash Transaction Types - Following AP pattern
import { TransactionType } from './TransactionType';

// Cash-specific context
export interface CashContext {
  cash: {
    id: number;
    registrationNumber: string;
    transactionType: 'INFLOW' | 'OUTFLOW';
    amount: number;
    paymentMethod: string;
    description: string;
  };
}

// Cash in options
export interface CashInOptions {
  transactionType: 'INFLOW';
  amount: number;
  paymentMethod: string;
  sourceType: 'CUSTOMER_PAYMENT' | 'LOAN_RECEIVED' | 'INVESTMENT' | 'OTHER_INCOME';
  customerId?: number;
  customerName?: string;
  customerRnc?: string;
  description: string;
  receiptNumber?: string;
  referenceNumber?: string;
  receivedDate?: Date;
}

// Cash out options
export interface CashOutOptions {
  transactionType: 'OUTFLOW';
  amount: number;
  paymentMethod: string;
  expenseType: 'SUPPLIER_PAYMENT' | 'BUSINESS_EXPENSE' | 'LOAN_PAYMENT' | 'WITHDRAWAL' | 'OTHER_EXPENSE';
  supplierId?: number;
  supplierName?: string;
  supplierRnc?: string;
  description: string;
  voucherNumber?: string;
  referenceNumber?: string;
  paidDate?: Date;
}

// Cash register entry data
export interface CashRegisterEntryData {
  registrationNumber: string;
  registrationDate: Date;
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
  cashRegisterId?: number;
  receiptNumber?: string;
  customerId?: number;
  referenceNumber?: string;
}

// Cash transaction request interface
export interface CashTransactionRequest {
  transactionType: 'INFLOW' | 'OUTFLOW';
  amount: number;
  paymentMethod: string;
  description: string;
  sourceType?: string;
  expenseType?: string;
  customerId?: number;
  customerName?: string;
  customerRnc?: string;
  supplierId?: number;
  supplierName?: string;
  supplierRnc?: string;
  receiptNumber?: string;
  voucherNumber?: string;
  referenceNumber?: string;
  transactionDate?: Date;
  notes?: string;
}