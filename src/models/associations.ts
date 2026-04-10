// This file sets up all model associations to avoid circular dependency issues
import Purchase from './Purchase';
import PurchaseItem from './PurchaseItem';
import Product from './Product';
import ProductPrice from './ProductPrice';
import Supplier from './Supplier';
import Sale from './Sale';
import SaleItem from './SaleItem';
import Client from './Client';
import AssociatedInvoice from './AssociatedInvoice';
import Payment from './Payment';
import PaymentInvoiceApplication from './PaymentInvoiceApplication';
import SupplierCredit from './SupplierCredit';
import ClientCredit from './ClientCredit';
import Card from './Card';
import BankAccount from './BankAccount';
import CashRegister from './CashRegister';
import CashRegisterMaster from './CashRegisterMaster';
import AccountsPayable from './AccountsPayable';
import Financer from './Financer';
import InvestmentAgreement from './InvestmentAgreement';
import CardPaymentNetwork from './CardPaymentNetwork';
import ClientPaymentMethod from './ClientPaymentMethod';
import CreditBalance from './CreditBalance';
import ExpenseCategory from './ExpenseCategory';
import ExpenseType from './ExpenseType';
import User from './User';
// Transaction Deletion System Models
import TransactionDeletionReason from './TransactionDeletionReason';
import UserRole from './UserRole';
import ApprovalRequest from './ApprovalRequest';
import ApprovalStep from './ApprovalStep';
import TransactionAuditTrail from './TransactionAuditTrail';
import CreditCardFee from './CreditCardFee';
import AccountsReceivable from './AccountsReceivable';

// Investment Summary associations
CashRegister.belongsTo(CashRegisterMaster, { foreignKey: 'cashRegisterId', as: 'cashRegisterMaster' });
CashRegisterMaster.hasMany(CashRegister, { foreignKey: 'cashRegisterId', as: 'transactions' });

// Cash Register - Bank Account association (for outflows)
CashRegister.belongsTo(BankAccount, { foreignKey: 'bankAccountId', as: 'bankAccount' });
BankAccount.hasMany(CashRegister, { foreignKey: 'bankAccountId', as: 'cashTransactions' });

// Bank Register - Bank Account association
// BankRegister.belongsTo(BankAccount, { foreignKey: 'bankAccountId', as: 'bankAccount' });
// BankAccount.hasMany(BankRegister, { foreignKey: 'bankAccountId', as: 'bankTransactions' });

// Remove problematic foreign key constraint - keep as optional reference only
// AccountsPayable.belongsTo(Financer, { foreignKey: 'supplierId', as: 'financer' });
// Financer.hasMany(AccountsPayable, { foreignKey: 'supplierId', as: 'payables' });

// Investment Agreement associations
InvestmentAgreement.belongsTo(Financer, { foreignKey: 'investorId', as: 'investor' });
Financer.hasMany(InvestmentAgreement, { foreignKey: 'investorId', as: 'agreements' });

// Card associations
Card.belongsTo(BankAccount, { foreignKey: 'bankAccountId', as: 'BankAccount' });
BankAccount.hasMany(Card, { foreignKey: 'bankAccountId', as: 'Cards' });

// Purchase associations
Purchase.belongsTo(Supplier, { foreignKey: 'supplierId', as: 'supplier' });
Purchase.hasMany(PurchaseItem, { foreignKey: 'purchaseId', as: 'items' });
// Temporarily disable AssociatedInvoice association due to schema issues
// Purchase.hasMany(AssociatedInvoice, { foreignKey: 'purchaseId', as: 'associatedInvoices' });
// Expense Management associations
Purchase.belongsTo(ExpenseCategory, { foreignKey: 'expenseCategoryId', as: 'expenseCategory' });
Purchase.belongsTo(ExpenseType, { foreignKey: 'expenseTypeId', as: 'expenseType' });

// PurchaseItem associations
PurchaseItem.belongsTo(Purchase, { foreignKey: 'purchaseId', as: 'purchase' });
PurchaseItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// AssociatedInvoice associations - temporarily disabled due to schema issues
// AssociatedInvoice.belongsTo(Purchase, { foreignKey: 'purchaseId', as: 'purchase' });

// Sale associations
Sale.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });
Sale.hasMany(SaleItem, { foreignKey: 'saleId', as: 'items' });

// SaleItem associations
SaleItem.belongsTo(Sale, { foreignKey: 'saleId', as: 'sale' });
SaleItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// Payment associations
Payment.hasMany(PaymentInvoiceApplication, { foreignKey: 'paymentId', as: 'applications' });

// PaymentInvoiceApplication associations
PaymentInvoiceApplication.belongsTo(Payment, { foreignKey: 'paymentId', as: 'payment' });

// SupplierCredit associations
SupplierCredit.belongsTo(Supplier, { foreignKey: 'supplierId', as: 'supplier' });
SupplierCredit.belongsTo(Payment, { foreignKey: 'paymentId', as: 'payment' });

// ClientCredit associations
ClientCredit.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });
ClientCredit.belongsTo(Payment, { foreignKey: 'paymentId', as: 'payment' });

// Product associations
Product.hasMany(ProductPrice, { foreignKey: 'product_id', as: 'priceHistory' });

// ProductPrice associations
ProductPrice.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// Client Payment Method associations
ClientPaymentMethod.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });
ClientPaymentMethod.belongsTo(CardPaymentNetwork, { foreignKey: 'cardPaymentNetworkId', as: 'CardPaymentNetwork' });
ClientPaymentMethod.belongsTo(BankAccount, { foreignKey: 'bankAccountId', as: 'BankAccount' });

// Client associations
Client.hasMany(ClientPaymentMethod, { foreignKey: 'clientId', as: 'paymentMethods' });

// Card Payment Network associations
CardPaymentNetwork.hasMany(ClientPaymentMethod, { foreignKey: 'cardPaymentNetworkId', as: 'clientPaymentMethods' });

// Product associations (if any)
// Product.hasMany(PurchaseItem, { foreignKey: 'productId', as: 'purchaseItems' });
// Product.hasMany(SaleItem, { foreignKey: 'productId', as: 'saleItems' });

// Expense Category associations
ExpenseCategory.belongsTo(ExpenseCategory, { foreignKey: 'parentCategoryId', as: 'parentCategory' });
ExpenseCategory.hasMany(ExpenseCategory, { foreignKey: 'parentCategoryId', as: 'subCategories' });
ExpenseCategory.hasMany(ExpenseType, { foreignKey: 'categoryId', as: 'expenseTypes' });
ExpenseCategory.hasMany(Purchase, { foreignKey: 'expenseCategoryId', as: 'purchases' });

// Expense Type associations
ExpenseType.belongsTo(ExpenseCategory, { foreignKey: 'categoryId', as: 'category' });
ExpenseType.hasMany(Purchase, { foreignKey: 'expenseTypeId', as: 'purchases' });

// Transaction Deletion System Associations
UserRole.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(UserRole, { foreignKey: 'user_id', as: 'roles' });

ApprovalRequest.belongsTo(User, { foreignKey: 'requested_by', as: 'requester' });
ApprovalRequest.belongsTo(TransactionDeletionReason, { foreignKey: 'deletion_reason_code', targetKey: 'reason_code', as: 'deletionReason' });
ApprovalRequest.hasMany(ApprovalStep, { foreignKey: 'request_id', as: 'steps' });

ApprovalStep.belongsTo(ApprovalRequest, { foreignKey: 'request_id', as: 'request' });
ApprovalStep.belongsTo(User, { foreignKey: 'approved_by', as: 'approvedByUser' });

TransactionAuditTrail.belongsTo(User, { foreignKey: 'user_id', as: 'auditUser' });
TransactionAuditTrail.belongsTo(ApprovalRequest, { foreignKey: 'approval_id', as: 'approvalRequest' });

// Credit Card Fee associations
CreditCardFee.belongsTo(Client, { foreignKey: 'customerId', as: 'customer' });
CreditCardFee.belongsTo(AccountsReceivable, { foreignKey: 'arId', as: 'accountsReceivable' });
CreditCardFee.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

// Accounts Receivable associations
AccountsReceivable.hasMany(CreditCardFee, { foreignKey: 'arId', as: 'creditCardFees' });

// Client associations for credit card fees
Client.hasMany(CreditCardFee, { foreignKey: 'customerId', as: 'creditCardFees' });

export default {
  Purchase,
  PurchaseItem,
  Product,
  ProductPrice,
  Supplier,
  Sale,
  SaleItem,
  Client,
  AssociatedInvoice,
  Payment,
  PaymentInvoiceApplication,
  SupplierCredit,
  ClientCredit,
  Card,
  BankAccount,
  CardPaymentNetwork,
  ClientPaymentMethod,
  CreditBalance,
  ExpenseCategory,
  ExpenseType,
  User,
  TransactionDeletionReason,
  UserRole,
  ApprovalRequest,
  ApprovalStep,
  TransactionAuditTrail,
  CreditCardFee,
  AccountsReceivable,
};
