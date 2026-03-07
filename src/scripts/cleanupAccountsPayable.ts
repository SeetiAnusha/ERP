import sequelize from '../config/database';
import AccountsPayable from '../models/AccountsPayable';

/**
 * Clean up AccountsPayable entries for CONTRIBUTION and LOAN transactions
 * These should not be in AccountsPayable since they are cash transactions
 */
export const cleanupAccountsPayable = async () => {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('🧹 Starting AccountsPayable cleanup for CONTRIBUTION/LOAN transactions...');
    
    // Find all CONTRIBUTION and LOAN entries in AccountsPayable
    const contributionLoanEntries = await AccountsPayable.findAll({
      where: {
        type: ['CONTRIBUTION', 'LOAN']
      },
      transaction
    });
    
    console.log(`📊 Found ${contributionLoanEntries.length} CONTRIBUTION/LOAN entries in AccountsPayable to remove`);
    
    if (contributionLoanEntries.length === 0) {
      console.log('✅ No CONTRIBUTION/LOAN entries found in AccountsPayable');
      await transaction.commit();
      return { success: true, message: 'No entries to clean up', removedCount: 0 };
    }
    
    // Log the entries being removed
    console.log('🗑️  Removing the following entries:');
    contributionLoanEntries.forEach((entry: any) => {
      console.log(`  - ${entry.type}: ${entry.registrationNumber} - ${entry.supplierName} - ${entry.amount}`);
    });
    
    // Delete all CONTRIBUTION and LOAN entries from AccountsPayable
    const deletedCount = await AccountsPayable.destroy({
      where: {
        type: ['CONTRIBUTION', 'LOAN']
      },
      transaction
    });
    
    await transaction.commit();
    
    console.log(`🎉 Successfully removed ${deletedCount} CONTRIBUTION/LOAN entries from AccountsPayable`);
    console.log('💡 These transactions are now tracked only through CashRegister + InvestmentAgreement');
    
    return {
      success: true,
      message: `Removed ${deletedCount} CONTRIBUTION/LOAN entries from AccountsPayable`,
      removedCount: deletedCount
    };
    
  } catch (error: any) {
    await transaction.rollback();
    console.error('❌ Error cleaning up AccountsPayable:', error);
    throw new Error(`Failed to cleanup AccountsPayable: ${error.message}`);
  }
};

// Run the cleanup if this file is executed directly
if (require.main === module) {
  cleanupAccountsPayable()
    .then((result) => {
      console.log('✅ Cleanup completed:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    });
}