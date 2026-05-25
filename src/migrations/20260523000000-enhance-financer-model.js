'use strict';

/**
 * Migration: Enhance Financer Model
 * 
 * Purpose: 
 * - Add financer_type (SHAREHOLDER, FINANCIER, RELATED_PARTY)
 * - Add financial_nature (EQUITY, LOAN)
 * - Rename 'type' to 'legacy_type' for backward compatibility
 * - Add total_contributed and outstanding_balance tracking
 * 
 * Date: 2026-05-23
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔵 [Migration] Enhancing Financer model...');
      
      const tableDescription = await queryInterface.describeTable('financers');
      
      // Step 1: Rename existing 'type' column to 'legacy_type' for backward compatibility
      if (tableDescription.type && !tableDescription.legacy_type) {
        console.log('📝 [Migration] Renaming type to legacy_type...');
        await queryInterface.renameColumn('financers', 'type', 'legacy_type', { transaction });
        console.log('✅ [Migration] Column renamed successfully');
      }
      
      // Step 2: Add financer_type column (SHAREHOLDER_CONTRIBUTOR, FINANCIER, SHAREHOLDER_LENDER, RELATED_PARTY_LENDER)
      if (!tableDescription.financer_type) {
        console.log('📝 [Migration] Adding financer_type column...');
        
        // Create ENUM type first (PostgreSQL)
        await queryInterface.sequelize.query(`
          DO $$ BEGIN
            CREATE TYPE enum_financers_financer_type AS ENUM ('SHAREHOLDER_CONTRIBUTOR', 'FINANCIER', 'SHAREHOLDER_LENDER', 'RELATED_PARTY_LENDER');
          EXCEPTION
            WHEN duplicate_object THEN null;
          END $$;
        `, { transaction });
        
        // Add column with ENUM type
        await queryInterface.sequelize.query(`
          ALTER TABLE financers 
          ADD COLUMN financer_type enum_financers_financer_type NOT NULL DEFAULT 'FINANCIER';
        `, { transaction });
        
        console.log('✅ [Migration] financer_type column added');
      }
      
      // Step 3: Add financial_nature column (EQUITY, LOAN)
      if (!tableDescription.financial_nature) {
        console.log('📝 [Migration] Adding financial_nature column...');
        
        // Create ENUM type first (PostgreSQL)
        await queryInterface.sequelize.query(`
          DO $$ BEGIN
            CREATE TYPE enum_financers_financial_nature AS ENUM ('EQUITY', 'LOAN');
          EXCEPTION
            WHEN duplicate_object THEN null;
          END $$;
        `, { transaction });
        
        // Add column with ENUM type
        await queryInterface.sequelize.query(`
          ALTER TABLE financers 
          ADD COLUMN financial_nature enum_financers_financial_nature NOT NULL DEFAULT 'EQUITY';
        `, { transaction });
        
        console.log('✅ [Migration] financial_nature column added');
      }
      
      // Step 4: Add total_contributed column
      if (!tableDescription.total_contributed) {
        console.log('📝 [Migration] Adding total_contributed column...');
        await queryInterface.addColumn(
          'financers',
          'total_contributed',
          {
            type: Sequelize.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0,
            comment: 'Total amount contributed/invested by this financer'
          },
          { transaction }
        );
        console.log('✅ [Migration] total_contributed column added');
      }
      
      // Step 5: Add outstanding_balance column
      if (!tableDescription.outstanding_balance) {
        console.log('📝 [Migration] Adding outstanding_balance column...');
        await queryInterface.addColumn(
          'financers',
          'outstanding_balance',
          {
            type: Sequelize.DECIMAL(15, 2),
            allowNull: false,
            defaultValue: 0,
            comment: 'Outstanding balance (for loans) or current equity value'
          },
          { transaction }
        );
        console.log('✅ [Migration] outstanding_balance column added');
      }
      
      // Step 6: Add equity_percentage column (for shareholders)
      if (!tableDescription.equity_percentage) {
        console.log('📝 [Migration] Adding equity_percentage column...');
        await queryInterface.addColumn(
          'financers',
          'equity_percentage',
          {
            type: Sequelize.DECIMAL(5, 2),
            allowNull: true,
            comment: 'Ownership percentage (for SHAREHOLDER type only)'
          },
          { transaction }
        );
        console.log('✅ [Migration] equity_percentage column added');
      }
      
      // Step 7: Add interest_rate column (for loans)
      if (!tableDescription.interest_rate) {
        console.log('📝 [Migration] Adding interest_rate column...');
        await queryInterface.addColumn(
          'financers',
          'interest_rate',
          {
            type: Sequelize.DECIMAL(5, 2),
            allowNull: true,
            comment: 'Interest rate (for LOAN financial nature only)'
          },
          { transaction }
        );
        console.log('✅ [Migration] interest_rate column added');
      }
      
      // Step 8: Add relationship_description column
      if (!tableDescription.relationship_description) {
        console.log('📝 [Migration] Adding relationship_description column...');
        await queryInterface.addColumn(
          'financers',
          'relationship_description',
          {
            type: Sequelize.TEXT,
            allowNull: true,
            comment: 'Description of relationship with the company'
          },
          { transaction }
        );
        console.log('✅ [Migration] relationship_description column added');
      }
      
      // Step 9: Add indexes for better query performance
      console.log('📝 [Migration] Adding indexes...');
      
      try {
        await queryInterface.addIndex('financers', ['financer_type'], {
          name: 'idx_financers_financer_type',
          transaction
        });
        console.log('✅ [Migration] Index on financer_type created');
      } catch (error) {
        console.log('⚠️ [Migration] Index on financer_type may already exist');
      }
      
      try {
        await queryInterface.addIndex('financers', ['financial_nature'], {
          name: 'idx_financers_financial_nature',
          transaction
        });
        console.log('✅ [Migration] Index on financial_nature created');
      } catch (error) {
        console.log('⚠️ [Migration] Index on financial_nature may already exist');
      }
      
      try {
        await queryInterface.addIndex('financers', ['status'], {
          name: 'idx_financers_status',
          transaction
        });
        console.log('✅ [Migration] Index on status created');
      } catch (error) {
        console.log('⚠️ [Migration] Index on status may already exist');
      }
      
      // Step 10: Migrate existing data
      console.log('📝 [Migration] Migrating existing data...');
      
      // Map legacy_type to new financer_type and financial_nature
      await queryInterface.sequelize.query(`
        UPDATE financers 
        SET 
          financer_type = CASE 
            WHEN legacy_type = 'INVESTOR' THEN 'SHAREHOLDER_CONTRIBUTOR'::enum_financers_financer_type
            WHEN legacy_type = 'BANK' THEN 'FINANCIER'::enum_financers_financer_type
            ELSE 'RELATED_PARTY_LENDER'::enum_financers_financer_type
          END,
          financial_nature = CASE 
            WHEN legacy_type = 'INVESTOR' THEN 'EQUITY'::enum_financers_financial_nature
            WHEN legacy_type = 'BANK' THEN 'LOAN'::enum_financers_financial_nature
            ELSE 'LOAN'::enum_financers_financial_nature
          END
        WHERE legacy_type IS NOT NULL;
      `, { transaction });
      
      console.log('✅ [Migration] Existing data migrated successfully');
      
      await transaction.commit();
      console.log('✅ [Migration] Financer model enhancement completed successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ [Migration] Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔵 [Migration Rollback] Reverting Financer model changes...');
      
      // Remove indexes
      const indexes = [
        'idx_financers_financer_type',
        'idx_financers_financial_nature',
        'idx_financers_status'
      ];
      
      for (const indexName of indexes) {
        try {
          await queryInterface.removeIndex('financers', indexName, { transaction });
          console.log(`✅ [Migration Rollback] Index ${indexName} removed`);
        } catch (error) {
          console.log(`⚠️ [Migration Rollback] Index ${indexName} may not exist`);
        }
      }
      
      // Remove columns
      const columnsToRemove = [
        'relationship_description',
        'interest_rate',
        'equity_percentage',
        'outstanding_balance',
        'total_contributed',
        'financial_nature',
        'financer_type'
      ];
      
      for (const column of columnsToRemove) {
        try {
          await queryInterface.removeColumn('financers', column, { transaction });
          console.log(`✅ [Migration Rollback] Column ${column} removed`);
        } catch (error) {
          console.log(`⚠️ [Migration Rollback] Column ${column} may not exist`);
        }
      }
      
      // Drop ENUM types (PostgreSQL)
      try {
        await queryInterface.sequelize.query(`
          DROP TYPE IF EXISTS enum_financers_financer_type CASCADE;
        `, { transaction });
        console.log('✅ [Migration Rollback] ENUM type enum_financers_financer_type dropped');
      } catch (error) {
        console.log('⚠️ [Migration Rollback] ENUM type may not exist');
      }
      
      try {
        await queryInterface.sequelize.query(`
          DROP TYPE IF EXISTS enum_financers_financial_nature CASCADE;
        `, { transaction });
        console.log('✅ [Migration Rollback] ENUM type enum_financers_financial_nature dropped');
      } catch (error) {
        console.log('⚠️ [Migration Rollback] ENUM type may not exist');
      }
      
      // Rename legacy_type back to type
      try {
        await queryInterface.renameColumn('financers', 'legacy_type', 'type', { transaction });
        console.log('✅ [Migration Rollback] Column legacy_type renamed back to type');
      } catch (error) {
        console.log('⚠️ [Migration Rollback] Column rename may have failed');
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
