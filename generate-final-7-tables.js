/**
 * GENERATE FINAL 7 TABLES MIGRATION
 * 
 * This script creates the migration content for the last 7 tables:
 * 7. credit_card_fees
 * 8. credit_card_networks
 * 9. credit_card_registers
 * 10. data_classification_metadata
 * 11. expenses
 * 12. fixed_assets
 * 13. prepaid_expenses
 */

const fs = require('fs');
const path = require('path');

const migrationContent = `'use strict';

/**
 * ADD FINAL 7 TABLES (Part 3 of 3)
 * 
 * Tables 7-13:
 * 7. credit_card_fees
 * 8. credit_card_networks
 * 9. credit_card_registers
 * 10. data_classification_metadata
 * 11. expenses
 * 12. fixed_assets
 * 13. prepaid_expenses
 * 
 * After this migration, you'll have ALL 52 TABLES!
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🏗️  Adding final 7 tables (7-13)...\\n');

    const existingTables = await queryInterface.showAllTables();

    // Table 7: credit_card_fees
    if (!existingTables.includes('credit_card_fees')) {
      console.log('   📋 Creating table: credit_card_fees');
      await queryInterface.createTable('credit_card_fees', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        transaction_date: { type: Sequelize.DATE, allowNull: false },
        transaction_number: { type: Sequelize.STRING(50), allowNull: false },
        customer_id: { type: Sequelize.INTEGER, allowNull: true },
        customer_name: { type: Sequelize.STRING(200), allowNull: false },
        payment_amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
        fee_percentage: { type: Sequelize.DECIMAL(5, 2), allowNull: false },
        fee_amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
        net_amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
        card_type: { type: Sequelize.ENUM('VISA', 'MASTERCARD', 'AMEX', 'DISCOVER', 'OTHER'), allowNull: true },
        card_last_four: { type: Sequelize.STRING(4), allowNull: true },
        ar_id: { type: Sequelize.INTEGER, allowNull: true },
        ar_registration_number: { type: Sequelize.STRING(50), allowNull: true },
        status: { type: Sequelize.ENUM('RECORDED', 'RECONCILED', 'DISPUTED'), allowNull: false, defaultValue: 'RECORDED' },
        gl_entry_id: { type: Sequelize.BIGINT, allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },
        created_by: { type: Sequelize.INTEGER, allowNull: true },
        deletion_status: { type: Sequelize.STRING(20), allowNull: true },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
        deleted_by: { type: Sequelize.INTEGER, allowNull: true },
        deletion_reason_code: { type: Sequelize.STRING(50), allowNull: true },
        deletion_memo: { type: Sequelize.TEXT, allowNull: true },
        deletion_approval_id: { type: Sequelize.INTEGER, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      console.log('   ✅ Table created: credit_card_fees');
    }

    // Table 8: credit_card_networks
    if (!existingTables.includes('credit_card_networks')) {
      console.log('   📋 Creating table: credit_card_networks');
      await queryInterface.createTable('credit_card_networks', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
        network_name: { type: Sequelize.STRING(100), allowNull: false },
        display_name: { type: Sequelize.STRING(255), allowNull: false },
        processing_fee_rate: { type: Sequelize.DECIMAL(5, 4), allowNull: false, defaultValue: 0 },
        settlement_days: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 2 },
        status: { type: Sequelize.ENUM('ACTIVE', 'INACTIVE'), allowNull: false, defaultValue: 'ACTIVE' },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      console.log('   ✅ Table created: credit_card_networks');
    }

    // Table 9: credit_card_registers
    if (!existingTables.includes('credit_card_registers')) {
      console.log('   📋 Creating table: credit_card_registers');
      await queryInterface.createTable('credit_card_registers', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        registration_number: { type: Sequelize.STRING(50), allowNull: false, unique: true },
        registration_date: { type: Sequelize.DATE, allowNull: false },
        transaction_type: { type: Sequelize.ENUM('CHARGE', 'REFUND', 'ADJUSTMENT'), allowNull: false },
        source_transaction_type: { type: Sequelize.STRING(50), allowNull: false },
        amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
        payment_method: { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'CREDIT_CARD' },
        related_document_type: { type: Sequelize.STRING(100), allowNull: false },
        related_document_id: { type: Sequelize.INTEGER, allowNull: true },
        related_document_number: { type: Sequelize.STRING(100), allowNull: false },
        client_name: { type: Sequelize.STRING(255), allowNull: true },
        client_rnc: { type: Sequelize.STRING(20), allowNull: true },
        supplier_name: { type: Sequelize.STRING(255), allowNull: true },
        supplier_rnc: { type: Sequelize.STRING(20), allowNull: true },
        ncf: { type: Sequelize.STRING(20), allowNull: true },
        description: { type: Sequelize.TEXT, allowNull: false },
        card_id: { type: Sequelize.INTEGER, allowNull: false },
        card_issuer: { type: Sequelize.STRING(100), allowNull: true },
        card_brand: { type: Sequelize.STRING(50), allowNull: true },
        card_number_last4: { type: Sequelize.STRING(4), allowNull: true },
        authorization_code: { type: Sequelize.STRING(20), allowNull: true },
        merchant_id: { type: Sequelize.STRING(50), allowNull: true },
        terminal_id: { type: Sequelize.STRING(50), allowNull: true },
        batch_number: { type: Sequelize.STRING(20), allowNull: true },
        reference_number: { type: Sequelize.STRING(50), allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },
        balance: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        available_credit: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        used_credit: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        status: { type: Sequelize.STRING(20), allowNull: true },
        deletion_status: { type: Sequelize.STRING(20), allowNull: true, defaultValue: 'NONE' },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
        deleted_by: { type: Sequelize.INTEGER, allowNull: true },
        deletion_reason_code: { type: Sequelize.STRING(50), allowNull: true },
        deletion_memo: { type: Sequelize.TEXT, allowNull: true },
        deletion_approval_id: { type: Sequelize.INTEGER, allowNull: true },
        reversal_transaction_id: { type: Sequelize.INTEGER, allowNull: true },
        is_reversal: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
        original_transaction_id: { type: Sequelize.INTEGER, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      console.log('   ✅ Table created: credit_card_registers');
    }

    // Table 10: data_classification_metadata
    if (!existingTables.includes('data_classification_metadata')) {
      console.log('   📋 Creating table: data_classification_metadata');
      await queryInterface.createTable('data_classification_metadata', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        entity_type: { type: Sequelize.STRING(100), allowNull: false },
        entity_id: { type: Sequelize.STRING(100), allowNull: false },
        classification: { type: Sequelize.ENUM('public', 'internal', 'confidential', 'restricted'), allowNull: false, defaultValue: 'internal' },
        retention_days: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1095 },
        classified_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        expires_at: { type: Sequelize.DATE, allowNull: true },
        compliance_reasons: { type: Sequelize.TEXT, allowNull: false, defaultValue: '[]' },
        auto_classified: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      console.log('   ✅ Table created: data_classification_metadata');
    }

    // Table 11: expenses
    if (!existingTables.includes('expenses')) {
      console.log('   📋 Creating table: expenses');
      await queryInterface.createTable('expenses', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        registration_number: { type: Sequelize.STRING(50), allowNull: false, unique: true },
        registration_date: { type: Sequelize.DATE, allowNull: false },
        expense_type: { type: Sequelize.STRING(50), allowNull: false },
        amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        related_document_type: { type: Sequelize.STRING(50), allowNull: true },
        related_document_number: { type: Sequelize.STRING(50), allowNull: true },
        payment_method: { type: Sequelize.STRING(50), allowNull: false },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'PENDING' },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      console.log('   ✅ Table created: expenses');
    }

    // Table 12: fixed_assets
    if (!existingTables.includes('fixed_assets')) {
      console.log('   📋 Creating table: fixed_assets');
      await queryInterface.createTable('fixed_assets', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        asset_code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
        asset_name: { type: Sequelize.STRING(255), allowNull: false },
        notes: { type: Sequelize.TEXT, allowNull: false },
        category: { type: Sequelize.STRING(100), allowNull: false },
        purchase_date: { type: Sequelize.DATE, allowNull: false },
        purchase_cost: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
        useful_life_years: { type: Sequelize.INTEGER, allowNull: false },
        depreciation_method: { type: Sequelize.STRING(50), allowNull: false },
        salvage_value: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        accumulated_depreciation: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        book_value: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
        status: { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'ACTIVE' },
        location: { type: Sequelize.STRING(255), allowNull: true },
        serial_number: { type: Sequelize.STRING(100), allowNull: true },
        registration_number: { type: Sequelize.STRING(50), allowNull: true, unique: true },
        supplier: { type: Sequelize.STRING(255), allowNull: true },
        invoice_number: { type: Sequelize.STRING(100), allowNull: true },
        warranty_expiry_date: { type: Sequelize.DATE, allowNull: true },
        insurance_policy_number: { type: Sequelize.STRING(100), allowNull: true },
        insurance_expiry_date: { type: Sequelize.DATE, allowNull: true },
        maintenance_schedule: { type: Sequelize.STRING(50), allowNull: true },
        last_maintenance_date: { type: Sequelize.DATE, allowNull: true },
        next_maintenance_date: { type: Sequelize.DATE, allowNull: true },
        assigned_to: { type: Sequelize.STRING(255), allowNull: true },
        purchase_order_number: { type: Sequelize.STRING(100), allowNull: true },
        disposal_date: { type: Sequelize.DATE, allowNull: true },
        disposal_value: { type: Sequelize.DECIMAL(15, 2), allowNull: true },
        disposal_reason: { type: Sequelize.STRING(255), allowNull: true },
        depreciation_start_date: { type: Sequelize.DATE, allowNull: true },
        tags: { type: Sequelize.TEXT, allowNull: true },
        payment_type: { type: Sequelize.STRING(50), allowNull: true },
        bank_account_id: { type: Sequelize.INTEGER, allowNull: true },
        card_id: { type: Sequelize.INTEGER, allowNull: true },
        cheque_number: { type: Sequelize.STRING(100), allowNull: true },
        cheque_date: { type: Sequelize.DATE, allowNull: true },
        transfer_number: { type: Sequelize.STRING(100), allowNull: true },
        transfer_date: { type: Sequelize.DATE, allowNull: true },
        payment_reference: { type: Sequelize.STRING(100), allowNull: true },
        voucher_date: { type: Sequelize.DATE, allowNull: true },
        supplier_id: { type: Sequelize.INTEGER, allowNull: true },
        supplier_rnc: { type: Sequelize.STRING(50), allowNull: true },
        ncf: { type: Sequelize.STRING(50), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      console.log('   ✅ Table created: fixed_assets');
    }

    // Table 13: prepaid_expenses
    if (!existingTables.includes('prepaid_expenses')) {
      console.log('   📋 Creating table: prepaid_expenses');
      await queryInterface.createTable('prepaid_expenses', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
        name: { type: Sequelize.STRING(255), allowNull: false },
        type: { type: Sequelize.STRING(100), allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: false },
        start_date: { type: Sequelize.DATE, allowNull: false },
        end_date: { type: Sequelize.DATE, allowNull: false },
        total_amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
        amortized_amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
        remaining_amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
        monthly_amortization: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
        status: { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'ACTIVE' },
        supplier_id: { type: Sequelize.INTEGER, allowNull: true },
        registration_number: { type: Sequelize.STRING(50), allowNull: true },
        date: { type: Sequelize.DATE, allowNull: true },
        expense_category_id: { type: Sequelize.INTEGER, allowNull: true },
        amortization_period: { type: Sequelize.STRING(20), allowNull: true },
        payment_type: { type: Sequelize.STRING(50), allowNull: true },
        bank_account_id: { type: Sequelize.INTEGER, allowNull: true },
        card_id: { type: Sequelize.INTEGER, allowNull: true },
        cheque_number: { type: Sequelize.STRING(100), allowNull: true },
        cheque_date: { type: Sequelize.DATE, allowNull: true },
        transfer_number: { type: Sequelize.STRING(100), allowNull: true },
        transfer_date: { type: Sequelize.DATE, allowNull: true },
        payment_reference: { type: Sequelize.STRING(100), allowNull: true },
        voucher_date: { type: Sequelize.DATE, allowNull: true },
        supplier_rnc: { type: Sequelize.STRING(50), allowNull: true },
        ncf: { type: Sequelize.STRING(50), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      console.log('   ✅ Table created: prepaid_expenses');
    }

    console.log('\\n🎉 ALL 13 TABLES ADDED! You now have ALL 52 TABLES!\\n');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('prepaid_expenses');
    await queryInterface.dropTable('fixed_assets');
    await queryInterface.dropTable('expenses');
    await queryInterface.dropTable('data_classification_metadata');
    await queryInterface.dropTable('credit_card_registers');
    await queryInterface.dropTable('credit_card_networks');
    await queryInterface.dropTable('credit_card_fees');
  }
};`;

// Write to the migration file
const migrationFile = path.join(__dirname, 'src', 'migrations', '20260513214421-add-final-7-tables.js');
fs.writeFileSync(migrationFile, migrationContent);

console.log('✅ Final 7 tables migration created!');
console.log(`File: ${migrationFile}`);
console.log('\n🚀 Now run: npm run db:migrate');
console.log('   This will create ALL 52 tables!\n');
