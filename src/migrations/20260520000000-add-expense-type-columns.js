'use strict';

/**
 * ADD EXPENSE TYPE COLUMNS TO CREDIT_CARD_FEES
 * 
 * Adds expense_type and expense_category columns to support
 * flexible expense categorization without hardcoding.
 * 
 * This allows the same table to handle:
 * - Card Processing Fees
 * - Bank Charges
 * - Payment Gateway Fees
 * - Any future expense types
 * 
 * Created: 2026-05-20
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔧 Adding expense type columns to credit_card_fees...\n');
    
    const tableDesc = await queryInterface.describeTable('credit_card_fees');
    const existingColumns = Object.keys(tableDesc);
    
    // Add expense_type column
    if (!existingColumns.includes('expense_type')) {
      console.log('   + Adding column: expense_type');
      await queryInterface.addColumn('credit_card_fees', 'expense_type', {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'CARD_PROCESSING_FEE',
        comment: 'Type of expense: CARD_PROCESSING_FEE, BANK_CHARGE, GATEWAY_FEE, etc.',
      });
      console.log('   ✅ Column added: expense_type');
    } else {
      console.log('   ✓ Column exists: expense_type');
    }
    
    // Add expense_category column
    if (!existingColumns.includes('expense_category')) {
      console.log('   + Adding column: expense_category');
      await queryInterface.addColumn('credit_card_fees', 'expense_category', {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: 'Card Expenses',
        comment: 'Display category: Card Expenses, Bank Expenses, Gateway Expenses, etc.',
      });
      console.log('   ✅ Column added: expense_category');
    } else {
      console.log('   ✓ Column exists: expense_category');
    }
    
    // Add indexes for better query performance
    console.log('   + Adding indexes...');
    
    try {
      await queryInterface.addIndex('credit_card_fees', ['expense_type'], {
        name: 'idx_credit_card_fees_expense_type',
      });
      console.log('   ✅ Index added: expense_type');
    } catch (error) {
      console.log('   ✓ Index exists: expense_type');
    }
    
    try {
      await queryInterface.addIndex('credit_card_fees', ['expense_category'], {
        name: 'idx_credit_card_fees_expense_category',
      });
      console.log('   ✅ Index added: expense_category');
    } catch (error) {
      console.log('   ✓ Index exists: expense_category');
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log('   Now you can group expenses by type/category in the frontend.\n');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Rolling back expense type columns...\n');
    
    // Remove indexes
    try {
      await queryInterface.removeIndex('credit_card_fees', 'idx_credit_card_fees_expense_category');
      console.log('   ✅ Index removed: expense_category');
    } catch (error) {
      console.log('   ⚠️  Index not found: expense_category');
    }
    
    try {
      await queryInterface.removeIndex('credit_card_fees', 'idx_credit_card_fees_expense_type');
      console.log('   ✅ Index removed: expense_type');
    } catch (error) {
      console.log('   ⚠️  Index not found: expense_type');
    }
    
    // Remove columns
    await queryInterface.removeColumn('credit_card_fees', 'expense_category');
    console.log('   ✅ Column removed: expense_category');
    
    await queryInterface.removeColumn('credit_card_fees', 'expense_type');
    console.log('   ✅ Column removed: expense_type');
    
    console.log('\n✅ Rollback completed successfully!\n');
  }
};
