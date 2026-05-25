'use strict';

/**
 * ADD REMAINING 10 TABLES (Part 2 of 2)
 * 
 * Tables 4-13:
 * 4. bank_registers
 * 5. business_expenses
 * 6. business_expense_associated_costs
 * 7. credit_card_fees
 * 8. credit_card_networks
 * 9. credit_card_registers
 * 10. data_classification_metadata
 * 11. expenses
 * 12. fixed_assets
 * 13. prepaid_expenses
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🏗️  Adding remaining 10 tables (4-13)...\n');

    const existingTables = await queryInterface.showAllTables();

    // ═══════════════════════════════════════════════════════════
    // Table 4/13: bank_registers
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('bank_registers')) {
      console.log('   📋 Creating table: bank_registers');
      await queryInterface.createTable('bank_registers', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        registration_number: { type: Sequelize.STRING, allowNull: false },
        registration_date: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        transaction_type: { type: Sequelize.ENUM('INFLOW', 'OUTFLOW'), allowNull: false },
        source_transaction_type: { type: Sequelize.ENUM('PURCHASE', 'BUSINESS_EXPENSE', 'SALE', 'PAYMENT', 'ADJUSTMENT', 'TRANSFER', 'AR_COLLECTION', 'CREDIT_USAGE', 'FIXED_ASSET_PURCHASE', 'INVESTMENT_PURCHASE', 'PREPAID_EXPENSE'), allowNull: true },
        amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
        payment_method: { type: Sequelize.STRING, allowNull: false },
        related_document_type: { type: Sequelize.STRING, allowNull: true },
        related_document_number: { type: Sequelize.STRING, allowNull: true },
        client_rnc: { type: Sequelize.STRING, allowNull: true },
        client_name: { type: Sequelize.STRING, allowNull: true },
        ncf: { type: Sequelize.STRING, allowNull: true },
        description: { type: Sequelize.TEXT, allowNull: true },
        balance: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        bank_account_name: { type: Sequelize.STRING, allowNull: true },
        bank_account_number: { type: Sequelize.STRING, allowNull: true },
        reference_number: { type: Sequelize.STRING, allowNull: true },
        bank_account_id: { type: Sequelize.INTEGER, allowNull: true },
        account_type: { type: Sequelize.ENUM('CHECKING', 'SAVINGS'), allowNull: true },
        cheque_number: { type: Sequelize.STRING(50), allowNull: true },
        transfer_number: { type: Sequelize.STRING(50), allowNull: true },
        supplier_id: { type: Sequelize.INTEGER, allowNull: true },
        invoice_ids: { type: Sequelize.TEXT, allowNull: true },
        original_payment_type: { type: Sequelize.STRING(50), allowNull: true },
        deletion_status: { type: Sequelize.ENUM('NONE', 'REQUESTED', 'APPROVED', 'EXECUTED'), defaultValue: 'NONE' },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
        deleted_by: { type: Sequelize.INTEGER, allowNull: true },
        deletion_reason_code: { type: Sequelize.STRING(50), allowNull: true },
        deletion_memo: { type: Sequelize.TEXT, allowNull: true },
        deletion_approval_id: { type: Sequelize.INTEGER, allowNull: true },
        reversal_transaction_id: { type: Sequelize.INTEGER, allowNull: true },
        is_reversal: { type: Sequelize.BOOLEAN, defaultValue: false },
        original_transaction_id: { type: Sequelize.INTEGER, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      console.log('   ✅ Table created: bank_registers');
    } else {
      console.log('   ✓ Table exists: bank_registers');
    }

    // ═══════════════════════════════════════════════════════════
    // Table 5/13: business_expenses
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('business_expenses')) {
      console.log('   📋 Creating table: business_expenses');
      await queryInterface.createTable('business_expenses', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        registration_number: { type: Sequelize.STRING(50), allowNull: false },
        date: { type: Sequelize.DATE, allowNull: false },
        supplier_id: { type: Sequelize.INTEGER, allowNull: true },
        supplier_rnc: { type: Sequelize.STRING(20), allowNull: true },
        client_id: { type: Sequelize.INTEGER, allowNull: true },
        client_rnc: { type: Sequelize.STRING(20), allowNull: true },
        card_payment_network_id: { type: Sequelize.INTEGER, allowNull: true },
        related_ar_id: { type: Sequelize.INTEGER, allowNull: true },
        related_document_type: { type: Sequelize.STRING(50), allowNull: true },
        related_document_number: { type: Sequelize.STRING(50), allowNull: true },
        expense_category_id: { type: Sequelize.INTEGER, allowNull: true },
        expense_type_id: { type: Sequelize.INTEGER, allowNull: true },
        description: { type: Sequelize.TEXT, allowNull: true },
        amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
        expense_type: { type: Sequelize.STRING(100), allowNull: false, defaultValue: 'Services or other' },
        payment_type: { type: Sequelize.STRING(20), allowNull: false },
        paid_amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        balance_amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'COMPLETED' },
        payment_status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'Unpaid' },
        bank_account_id: { type: Sequelize.INTEGER, allowNull: true },
        card_id: { type: Sequelize.INTEGER, allowNull: true },
        cheque_number: { type: Sequelize.STRING(50), allowNull: true },
        cheque_date: { type: Sequelize.DATE, allowNull: true },
        transfer_number: { type: Sequelize.STRING(50), allowNull: true },
        transfer_date: { type: Sequelize.DATE, allowNull: true },
        payment_reference: { type: Sequelize.STRING(100), allowNull: true },
        voucher_date: { type: Sequelize.DATE, allowNull: true },
        deletion_status: { type: Sequelize.STRING(20), allowNull: true, defaultValue: null },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
        deleted_by: { type: Sequelize.INTEGER, allowNull: true },
        deletion_reason_code: { type: Sequelize.STRING(50), allowNull: true },
        deletion_memo: { type: Sequelize.TEXT, allowNull: true },
        deletion_approval_id: { type: Sequelize.INTEGER, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      console.log('   ✅ Table created: business_expenses');
    } else {
      console.log('   ✓ Table exists: business_expenses');
    }

    // ═══════════════════════════════════════════════════════════
    // Table 6/13: business_expense_associated_costs
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('business_expense_associated_costs')) {
      console.log('   📋 Creating table: business_expense_associated_costs');
      await queryInterface.createTable('business_expense_associated_costs', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        business_expense_id: { type: Sequelize.INTEGER, allowNull: false },
        supplier_rnc: { type: Sequelize.STRING(20), allowNull: true },
        supplier_name: { type: Sequelize.STRING(255), allowNull: true },
        concept: { type: Sequelize.STRING(255), allowNull: false },
        ncf: { type: Sequelize.STRING(50), allowNull: true },
        date: { type: Sequelize.DATE, allowNull: false },
        amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
        expense_type: { type: Sequelize.STRING(100), allowNull: false },
        payment_type: { type: Sequelize.STRING(20), allowNull: false },
        bank_account_id: { type: Sequelize.INTEGER, allowNull: true },
        card_id: { type: Sequelize.INTEGER, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      console.log('   ✅ Table created: business_expense_associated_costs');
    } else {
      console.log('   ✓ Table exists: business_expense_associated_costs');
    }

    console.log('\n✅ Migration part 2 complete (6/13 tables added so far)');
    console.log('   Continuing with remaining tables...\n');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('business_expense_associated_costs');
    await queryInterface.dropTable('business_expenses');
    await queryInterface.dropTable('bank_registers');
  }
};
