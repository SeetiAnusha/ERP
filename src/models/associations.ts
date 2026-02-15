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

// Purchase associations
Purchase.belongsTo(Supplier, { foreignKey: 'supplierId', as: 'supplier' });
Purchase.hasMany(PurchaseItem, { foreignKey: 'purchaseId', as: 'items' });
Purchase.hasMany(AssociatedInvoice, { foreignKey: 'purchaseId', as: 'associatedInvoices' });

// PurchaseItem associations
PurchaseItem.belongsTo(Purchase, { foreignKey: 'purchaseId', as: 'purchase' });
PurchaseItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// AssociatedInvoice associations
AssociatedInvoice.belongsTo(Purchase, { foreignKey: 'purchaseId', as: 'purchase' });

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

// Product associations (if any)
// Product.hasMany(PurchaseItem, { foreignKey: 'productId', as: 'purchaseItems' });
// Product.hasMany(SaleItem, { foreignKey: 'productId', as: 'saleItems' });

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
};
