'use strict';

/**
 * Migration: Add collection_method column to accounts_receivable table
 * 
 * Purpose: Track how AR payments were collected (CASH, CREDIT_CARD, DEBIT_CARD, etc.)
 * This prevents duplicate AR records when collecting with Credit/Debit Card
 * 
 * Date: 2026-05-22
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔵 [Migration] Adding collection_method column to accounts_receivable table...');
      
      // Check if column already exists
      const tableDescription = await queryInterface.describeTable('accounts_receivable');
      
      if (!tableDescription.collection_method) {
        // Add collection_method column
        await queryInterface.addColumn(
          'accounts_receivable',
          'collection_method',
          {
            type: Sequelize.STRING(50),
            allowNull: true,
            comment: 'How payment was collected (CASH, CREDIT_CARD, DEBIT_CARD, BANK_TRANSFER, etc.)'
          },
          { transaction }
        );
        
        console.log('✅ [Migration] collection_method column added successfully');
        
        // Add index for better query performance
        await queryInterface.addIndex(
          'accounts_receivable',
          ['collection_method'],
          {
            name: 'idx_ar_collection_method',
            transaction
          }
        );
        
        console.log('✅ [Migration] Index idx_ar_collection_method created successfully');
      } else {
        console.log('⚠️ [Migration] collection_method column already exists, skipping...');
      }
      
      await transaction.commit();
      console.log('✅ [Migration] Migration completed successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ [Migration] Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔵 [Migration Rollback] Removing collection_method column from accounts_receivable table...');
      
      // Check if column exists before removing
      const tableDescription = await queryInterface.describeTable('accounts_receivable');
      
      if (tableDescription.collection_method) {
        // Remove index first
        try {
          await queryInterface.removeIndex(
            'accounts_receivable',
            'idx_ar_collection_method',
            { transaction }
          );
          console.log('✅ [Migration Rollback] Index removed successfully');
        } catch (error) {
          console.log('⚠️ [Migration Rollback] Index may not exist, continuing...');
        }
        
        // Remove column
        await queryInterface.removeColumn(
          'accounts_receivable',
          'collection_method',
          { transaction }
        );
        
        console.log('✅ [Migration Rollback] collection_method column removed successfully');
      } else {
        console.log('⚠️ [Migration Rollback] collection_method column does not exist, skipping...');
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
