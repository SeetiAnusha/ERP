'use strict';

/**
 * Migration: Add Shareholder Fields to Cash Register
 * 
 * Purpose:
 * - Add shareholder_id foreign key to financers table
 * - Add shareholder_amount for contribution tracking
 * - Convert relatedDocumentType from STRING to ENUM with financer types
 * 
 * Business Logic:
 * - When relatedDocumentType = 'SHAREHOLDER_CONTRIBUTOR', shareholder_id is required
 * - CARD payment = Future payment (like Credit Card Sale Collection)
 * - CASH/CHECK/TRANSFER = Immediate payment
 * 
 * Date: 2026-05-23
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔵 [Migration] Adding shareholder fields to cash_register...');
      
      const tableDescription = await queryInterface.describeTable('cash_register');
      
      // Step 1: Add shareholder_id column (foreign key to financers)
      if (!tableDescription.shareholder_id) {
        console.log('📝 [Migration] Adding shareholder_id column...');
        await queryInterface.addColumn(
          'cash_register',
          'shareholder_id',
          {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
              model: 'financers',
              key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
            comment: 'Foreign key to financers table (for SHAREHOLDER_CONTRIBUTOR transactions)'
          },
          { transaction }
        );
        console.log('✅ [Migration] shareholder_id column added');
      }
      
      // Step 2: Add shareholder_amount column
      if (!tableDescription.shareholder_amount) {
        console.log('📝 [Migration] Adding shareholder_amount column...');
        await queryInterface.addColumn(
          'cash_register',
          'shareholder_amount',
          {
            type: Sequelize.DECIMAL(15, 2),
            allowNull: true,
            comment: 'Amount of shareholder contribution'
          },
          { transaction }
        );
        console.log('✅ [Migration] shareholder_amount column added');
      }
      
      // Step 3: Create ENUM type for relatedDocumentType
      console.log('📝 [Migration] Creating ENUM type for relatedDocumentType...');
      await queryInterface.sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE enum_cash_register_related_document_type AS ENUM (
            'CREDIT_CARD_SALE_COLLECTION',
            'SHAREHOLDER_CONTRIBUTOR',
            'FINANCIER',
            'SHAREHOLDER_LENDER',
            'RELATED_PARTY_LENDER'
          );
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `, { transaction });
      console.log('✅ [Migration] ENUM type created');
      
      // Step 4: Migrate existing relatedDocumentType data
      console.log('📝 [Migration] Migrating existing relatedDocumentType data...');
      
      // Map old values to new ENUM values (if any exist)
      // Note: PostgreSQL stores column names with underscores: related_document_type
      await queryInterface.sequelize.query(`
        UPDATE cash_register
        SET related_document_type = CASE
          WHEN related_document_type = 'CREDIT_CARD_SALE' THEN 'CREDIT_CARD_SALE_COLLECTION'
          WHEN related_document_type = 'SHAREHOLDER' THEN 'SHAREHOLDER_CONTRIBUTOR'
          WHEN related_document_type = 'CONTRIBUTION' THEN 'SHAREHOLDER_CONTRIBUTOR'
          ELSE related_document_type
        END
        WHERE related_document_type IS NOT NULL;
      `, { transaction });
      
      // Step 5: Change relatedDocumentType column to use ENUM
      console.log('📝 [Migration] Converting relatedDocumentType to ENUM...');
      // First, set NULL for any values that don't match our ENUM
      await queryInterface.sequelize.query(`
        UPDATE cash_register
        SET related_document_type = NULL
        WHERE related_document_type NOT IN (
          'CREDIT_CARD_SALE_COLLECTION',
          'SHAREHOLDER_CONTRIBUTOR',
          'FINANCIER',
          'SHAREHOLDER_LENDER',
          'RELATED_PARTY_LENDER'
        );
      `, { transaction });
      
      // Now convert to ENUM
      await queryInterface.sequelize.query(`
        ALTER TABLE cash_register 
        ALTER COLUMN related_document_type 
        TYPE enum_cash_register_related_document_type 
        USING related_document_type::enum_cash_register_related_document_type;
      `, { transaction });
      console.log('✅ [Migration] relatedDocumentType converted to ENUM');
      
      // Step 6: Add indexes for performance
      console.log('📝 [Migration] Adding indexes...');
      
      try {
        await queryInterface.addIndex('cash_register', ['shareholder_id'], {
          name: 'idx_cash_register_shareholder_id',
          transaction
        });
        console.log('✅ [Migration] Index on shareholder_id created');
      } catch (error) {
        console.log('⚠️ [Migration] Index on shareholder_id may already exist');
      }
      
      try {
        await queryInterface.addIndex('cash_register', ['related_document_type'], {
          name: 'idx_cash_register_related_document_type',
          transaction
        });
        console.log('✅ [Migration] Index on relatedDocumentType created');
      } catch (error) {
        console.log('⚠️ [Migration] Index on relatedDocumentType may already exist');
      }
      
      await transaction.commit();
      console.log('✅ [Migration] Shareholder fields added successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ [Migration] Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔵 [Migration Rollback] Removing shareholder fields from cash_register...');
      
      // Remove indexes
      try {
        await queryInterface.removeIndex('cash_register', 'idx_cash_register_shareholder_id', { transaction });
        console.log('✅ [Migration Rollback] Index on shareholder_id removed');
      } catch (error) {
        console.log('⚠️ [Migration Rollback] Index may not exist');
      }
      
      try {
        await queryInterface.removeIndex('cash_register', 'idx_cash_register_related_document_type', { transaction });
        console.log('✅ [Migration Rollback] Index on relatedDocumentType removed');
      } catch (error) {
        console.log('⚠️ [Migration Rollback] Index may not exist');
      }
      
      // Convert relatedDocumentType back to VARCHAR
      console.log('📝 [Migration Rollback] Converting relatedDocumentType back to VARCHAR...');
      await queryInterface.sequelize.query(`
        ALTER TABLE cash_register 
        ALTER COLUMN related_document_type 
        TYPE VARCHAR(50);
      `, { transaction });
      console.log('✅ [Migration Rollback] relatedDocumentType converted back to VARCHAR');
      
      // Drop ENUM type
      try {
        await queryInterface.sequelize.query(`
          DROP TYPE IF EXISTS enum_cash_register_related_document_type CASCADE;
        `, { transaction });
        console.log('✅ [Migration Rollback] ENUM type dropped');
      } catch (error) {
        console.log('⚠️ [Migration Rollback] ENUM type may not exist');
      }
      
      // Remove columns
      try {
        await queryInterface.removeColumn('cash_register', 'shareholder_amount', { transaction });
        console.log('✅ [Migration Rollback] shareholder_amount column removed');
      } catch (error) {
        console.log('⚠️ [Migration Rollback] Column may not exist');
      }
      
      try {
        await queryInterface.removeColumn('cash_register', 'shareholder_id', { transaction });
        console.log('✅ [Migration Rollback] shareholder_id column removed');
      } catch (error) {
        console.log('⚠️ [Migration Rollback] Column may not exist');
      }
      
      await transaction.commit();
      console.log('✅ [Migration Rollback] Rollback completed successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ [Migration Rollback] Rollback failed:', error);
      throw error;
    }
  }
};
