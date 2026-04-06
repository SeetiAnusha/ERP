import BusinessExpense from './BusinessExpense';
import BusinessExpenseAssociatedCost from './BusinessExpenseAssociatedCost';
import Client from './Client';
import CardPaymentNetwork from './CardPaymentNetwork';
import AccountsReceivable from './AccountsReceivable';

/**
 * Define associations between BusinessExpense and related models
 * This file resolves circular dependency issues
 */

// BusinessExpense has many associated costs
BusinessExpense.hasMany(BusinessExpenseAssociatedCost, { 
  foreignKey: 'businessExpenseId', 
  as: 'associatedCosts' 
});

// BusinessExpenseAssociatedCost belongs to BusinessExpense
BusinessExpenseAssociatedCost.belongsTo(BusinessExpense, { 
  foreignKey: 'businessExpenseId', 
  as: 'businessExpense' 
});

// ✅ NEW: Client-related associations for processing fees
BusinessExpense.belongsTo(Client, { 
  foreignKey: 'clientId', 
  as: 'client' 
});

// ✅ NEW: Card network association for processing fees
BusinessExpense.belongsTo(CardPaymentNetwork, { 
  foreignKey: 'cardPaymentNetworkId', 
  as: 'cardNetwork' 
});

// ✅ NEW: Related AR association for traceability
BusinessExpense.belongsTo(AccountsReceivable, { 
  foreignKey: 'relatedARId', 
  as: 'relatedAR' 
});

export { BusinessExpense, BusinessExpenseAssociatedCost };