// This file sets up all model associations to avoid circular dependency issues
import Purchase from './Purchase';
import PurchaseItem from './PurchaseItem';
import Product from './Product';
import Supplier from './Supplier';
import Sale from './Sale';
import SaleItem from './SaleItem';
import Client from './Client';
import AssociatedInvoice from './AssociatedInvoice';

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

// Product associations (if any)
// Product.hasMany(PurchaseItem, { foreignKey: 'productId', as: 'purchaseItems' });
// Product.hasMany(SaleItem, { foreignKey: 'productId', as: 'saleItems' });

export default {
  Purchase,
  PurchaseItem,
  Product,
  Supplier,
  Sale,
  SaleItem,
  Client,
  AssociatedInvoice,
};
