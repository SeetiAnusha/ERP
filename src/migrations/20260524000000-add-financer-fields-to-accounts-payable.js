'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔵 Starting migration: Add financer fields to accounts_payable table');
    
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Check if columns already exist before adding
      const tableDescription = await queryInterface.describeTable('accounts_payable');
      
      // Add financer_id column if it doesn't exist
      if (!tableDescription.financer_id) {
        console.log('➕ Adding financer_id column...');
        await queryInterface.addColumn(
          'accounts_payable',
          'financer_id',
          {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'Financer ID for loan-based AP (FINANCIER, SHAREHOLDER_LENDER, RELATED_PARTY_LENDER)',
          },
          { transaction }
        );
        console.log('✅ financer_id column added');
      } else {
        console.log('⏭️ financer_id column already exists, skipping');
      }
      
      // Add financer_name column if it doesn't exist
      if (!tableDescription.financer_name) {
        console.log('➕ Adding financer_name column...');
        await queryInterface.addColumn(
          'accounts_payable',
          'financer_name',
          {
            type: Sequelize.STRING(200),
            allowNull: true,
            comment: 'Financer name for display purposes',
          },
          { transaction }
        );
        console.log('✅ financer_name column added');
      } else {
        console.log('⏭️ financer_name column already exists, skipping');
      }
      
      // Add loan_amount column if it doesn't exist
      if (!tableDescription.loan_amount) {
        console.log('➕ Adding loan_amount column...');
        await queryInterface.addColumn(
          'accounts_payable',
          'loan_amount',
          {
            type: Sequelize.DECIMAL(15, 2),
            allowNull: true,
            comment: 'Original loan amount (same as amount, but explicit for loans)',
          },
          { transaction }
        );
        console.log('✅ loan_amount column added');
      } else {
        console.log('⏭️ loan_amount column already exists, skipping');
      }
      
      // Add interest_rate column if it doesn't exist
      if (!tableDescription.interest_rate) {
        console.log('➕ Adding interest_rate column...');
        await queryInterface.addColumn(
          'accounts_payable',
          'interest_rate',
          {
            type: Sequelize.DECIMAL(5, 2),
            allowNull: true,
            comment: 'Interest rate for the loan (percentage)',
          },
          { transaction }
        );
        console.log('✅ interest_rate column added');
      } else {
        console.log('⏭️ interest_rate column already exists, skipping');
      }
      
      // Add foreign key constraint for financer_id if it doesn't exist
      if (!tableDescription.financer_id) {
        console.log('➕ Adding foreign key constraint for financer_id...');
        await queryInterface.addConstraint('accounts_payable', {
          fields: ['financer_id'],
          type: 'foreign key',
          name: 'fk_accounts_payable_financer',
          references: {
            table: 'financers',
            field: 'id',
          },
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE',
          transaction,
        });
        console.log('✅ Foreign key constraint added');
      }
      
      await transaction.commit();
      console.log('✅ Migration completed successfully: Add financer fields to accounts_payable');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('🔵 Starting rollback: Remove financer fields from accounts_payable table');
    
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      const tableDescription = await queryInterface.describeTable('accounts_payable');
      
      // Remove foreign key constraint first
      try {
        console.log('➖ Removing foreign key constraint...');
        await queryInterface.removeConstraint(
          'accounts_payable',
          'fk_accounts_payable_financer',
          { transaction }
        );
        console.log('✅ Foreign key constraint removed');
      } catch (error) {
        console.log('⏭️ Foreign key constraint does not exist or already removed');
      }
      
      // Remove columns if they exist
      if (tableDescription.interest_rate) {
        console.log('➖ Removing interest_rate column...');
        await queryInterface.removeColumn('accounts_payable', 'interest_rate', { transaction });
        console.log('✅ interest_rate column removed');
      }
      
      if (tableDescription.loan_amount) {
        console.log('➖ Removing loan_amount column...');
        await queryInterface.removeColumn('accounts_payable', 'loan_amount', { transaction });
        console.log('✅ loan_amount column removed');
      }
      
      if (tableDescription.financer_name) {
        console.log('➖ Removing financer_name column...');
        await queryInterface.removeColumn('accounts_payable', 'financer_name', { transaction });
        console.log('✅ financer_name column removed');
      }
      
      if (tableDescription.financer_id) {
        console.log('➖ Removing financer_id column...');
        await queryInterface.removeColumn('accounts_payable', 'financer_id', { transaction });
        console.log('✅ financer_id column removed');
      }
      
      await transaction.commit();
      console.log('✅ Rollback completed successfully: Remove financer fields from accounts_payable');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};
