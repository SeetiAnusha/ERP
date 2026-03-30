// Sales Transaction Types - Following Bank Register execution pattern
import { TransactionType } from './TransactionType';

// Sales-specific context for frontend display
export interface SalesContext {
  sale: {
    id: number;
    registrationNumber: string;
    documentNumber: string;
    clientId: number;
    clientName: string;
    clientRnc?: string;
    ncf?: string;
    saleType: string;
    paymentType: string;
    total: number;
    collectedAmount: number;
    balanceAmount: number;
    collectionStatus: string;
  };
}

// Sales form data for frontend
export interface SalesFormData {
  // Basic sale information
  date: Date;
  clientId: number;
  clientRnc?: string;
  ncf?: string;
  saleType: string;
  
  // Payment information
  paymentType: 'CASH' | 'CREDIT' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'BANK_TRANSFER' | 'CHEQUE';
  cardPaymentNetworkId?: number; // For card payments
  cashRegisterId?: number; // For cash/cheque payments
  bankAccountId?: number; // For bank transfers
  
  // Sale items
  items: SaleItemData[];
  
  // Totals
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  
  // Additional fields
  notes?: string;
}

// Sale item data structure
export interface SaleItemData {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

// Sales execution result (what gets created when sale is executed)
export interface SalesExecutionResult {
  sale: {
    id: number;
    registrationNumber: string;
    documentNumber: string;
    status: string;
    collectionStatus: string;
    total: number;
  };
  
  // Related transactions created based on payment type
  relatedTransactions: {
    cashRegister?: {
      id: number;
      registrationNumber: string;
      transactionType: 'INFLOW';
      amount: number;
      description: string;
    };
    
    accountsReceivable?: {
      id: number;
      registrationNumber: string;
      amount: number;
      status: 'Pending';
      dueDate: Date;
    };
    
    bankRegister?: {
      id: number;
      registrationNumber: string;
      transactionType: 'INFLOW';
      amount: number;
      bankAccountId: number;
    };
  };
}

// Sales collection request (for collecting pending sales)
export interface SalesCollectionRequest {
  saleId: number;
  amount: number;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
  cashRegisterId?: number;
  bankAccountId?: number;
  collectionDate?: Date;
  reference?: string;
  notes?: string;
}

// Sales list view data (for frontend tables)
export interface SalesListItem {
  id: number;
  registrationNumber: string;
  documentNumber: string;
  date: Date;
  clientName: string;
  clientRnc?: string;
  saleType: string;
  paymentType: string;
  total: number;
  collectedAmount: number;
  balanceAmount: number;
  collectionStatus: 'Not Collected' | 'Partial' | 'Collected';
  status: string;
  deletion_status?: 'NONE' | 'REQUESTED' | 'APPROVED' | 'EXECUTED';
}

// Sales analytics data
export interface SalesAnalytics {
  totalSales: number;
  totalAmount: number;
  totalCollected: number;
  totalPending: number;
  byPaymentType: Record<string, {
    count: number;
    amount: number;
    collected: number;
    pending: number;
  }>;
  byCollectionStatus: Record<string, {
    count: number;
    amount: number;
  }>;
  dateRange: {
    from: Date;
    to: Date;
  };
}