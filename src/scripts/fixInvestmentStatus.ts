import sequelize from '../config/database';
import AccountsPayable from '../models/AccountsPayable';
import CashRegister from '../models/CashRegister';

/**
 * Fix existing investment status - mark CONTRIBUTION entries as Paid
 * since they represent money already received in cash register
 */
export const fixInvestmentStatus = async () => {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('🔧 Starting investment status fix...');
    
    // Find all CONTRIBUTION AccountsPayable entries that are not yet paid
    const pendingContributions = await AccountsPayable.findAll({
      where: {
        type: 'CONTRIBUTION',
        status: ['Pending', 'Partial']
      },
      transaction
    });
    
    console.log(`📊 Found ${pendingContributions.length} pending contribution entries to fix`);
    
    let fixedCount = 0;
    
    for (const contribution of pendingContributions) {
      // Check if there's a corresponding cash register transaction
      const cashTransaction = await CashRegister.findOne({
        where: {
          registrationNumber: contribution.relatedDocumentNumber,
          relatedDocumentType: 'CONTRIBUTION'
        },
        transaction
      });
      
      if (cashTransaction) {
        // Money was received in cash register, so mark as paid
        const amount = parseFloat(contribution.amount.toString());
        
        await contribution.update({
          paidAmount: amount,
          balanceAmount: 0,
          status: 'Paid',
          paidDate: contribution.registrationDate // Use registration date as paid date
        }, { transaction });
        
        fixedCount++;
        console.log(`✅ Fixed contribution ${contribution.registrationNumber} - marked as Paid`);
      }
    }
    
    await transaction.commit();
    console.log(`🎉 Successfully fixed ${fixedCount} investment entries`);
    
    return {
      success: true,
      message: `Fixed ${fixedCount} investment entries`,
      fixedCount
    };
    
  } catch (error: any) {
    await transaction.rollback();
    console.error('❌ Error fixing investment status:', error);
    throw new Error(`Failed to fix investment status: ${error.message}`);
  }
};

// Run the fix if this file is executed directly
if (require.main === module) {
  fixInvestmentStatus()
    .then((result) => {
      console.log('✅ Fix completed:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fix failed:', error);
      process.exit(1);
    });
}