import BusinessExpense from './BusinessExpense';
import BusinessExpenseAssociatedCost from './BusinessExpenseAssociatedCost';

/**
 * Define associations between BusinessExpense and BusinessExpenseAssociatedCost
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

export { BusinessExpense, BusinessExpenseAssociatedCost };