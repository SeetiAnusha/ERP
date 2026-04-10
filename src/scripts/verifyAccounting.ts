/**
 * Verify Double-Entry Accounting System
 * 
 * This script verifies that the accounting system is properly set up
 */

import ChartOfAccountsService from '../services/accounting/ChartOfAccountsService';
import TrialBalanceService from '../services/accounting/TrialBalanceService';
import ChartOfAccounts from '../models/accounting/ChartOfAccounts';
import GeneralLedger from '../models/accounting/GeneralLedger';
import AccountBalance from '../models/accounting/AccountBalance';
import FiscalPeriod from '../models/accounting/FiscalPeriod';

async function verifyAccounting() {
  console.log('🔍 Verifying Double-Entry Accounting System...\n');
  
  let allChecksPass = true;
  
  try {
    // Check 1: Verify tables exist
    console.log('✓ Check 1: Database Tables');
    try {
      await ChartOfAccounts.findOne();
      console.log('  ✅ chart_of_accounts table exists');
    } catch (error) {
      console.log('  ❌ chart_of_accounts table missing');
      allChecksPass = false;
    }
    
    try {
      await GeneralLedger.findOne();
      console.log('  ✅ general_ledger table exists');
    } catch (error) {
      console.log('  ❌ general_ledger table missing');
      allChecksPass = false;
    }
    
    try {
      await AccountBalance.findOne();
      console.log('  ✅ account_balances table exists');
    } catch (error) {
      console.log('  ❌ account_balances table missing');
      allChecksPass = false;
    }
    
    try {
      await FiscalPeriod.findOne();
      console.log('  ✅ fiscal_periods table exists');
    } catch (error) {
      console.log('  ❌ fiscal_periods table missing');
      allChecksPass = false;
    }
    
    console.log('');
    
    // Check 2: Verify default accounts
    console.log('✓ Check 2: Default Chart of Accounts');
    const accounts = await ChartOfAccountsService.getAllAccounts();
    
    if (accounts.length >= 21) {
      console.log(`  ✅ Found ${accounts.length} accounts (expected at least 21)`);
    } else {
      console.log(`  ❌ Found only ${accounts.length} accounts (expected at least 21)`);
      allChecksPass = false;
    }
    
    // Check key accounts
    const keyAccounts = ['1010', '1020', '1200', '2100', '4000', '5000'];
    for (const code of keyAccounts) {
      try {
        const account = await ChartOfAccountsService.getAccountByCode(code);
        console.log(`  ✅ Account ${code} (${account.accountName}) exists`);
      } catch (error) {
        console.log(`  ❌ Account ${code} missing`);
        allChecksPass = false;
      }
    }
    
    console.log('');
    
    // Check 3: Verify services work
    console.log('✓ Check 3: Service Functionality');
    try {
      const trialBalance = await TrialBalanceService.generateTrialBalance();
      console.log(`  ✅ Trial balance generated successfully`);
      console.log(`  ✅ Total Debits: ${trialBalance.totalDebits}`);
      console.log(`  ✅ Total Credits: ${trialBalance.totalCredits}`);
      console.log(`  ✅ Balanced: ${trialBalance.isBalanced ? 'Yes' : 'No'}`);
    } catch (error: any) {
      console.log(`  ❌ Trial balance generation failed: ${error.message}`);
      allChecksPass = false;
    }
    
    console.log('');
    
    // Check 4: Verify account types
    console.log('✓ Check 4: Account Type Distribution');
    const assetAccounts = accounts.filter(a => a.accountType === 'ASSET');
    const liabilityAccounts = accounts.filter(a => a.accountType === 'LIABILITY');
    const equityAccounts = accounts.filter(a => a.accountType === 'EQUITY');
    const revenueAccounts = accounts.filter(a => a.accountType === 'REVENUE');
    const expenseAccounts = accounts.filter(a => a.accountType === 'EXPENSE');
    
    console.log(`  ✅ Assets: ${assetAccounts.length} accounts`);
    console.log(`  ✅ Liabilities: ${liabilityAccounts.length} accounts`);
    console.log(`  ✅ Equity: ${equityAccounts.length} accounts`);
    console.log(`  ✅ Revenue: ${revenueAccounts.length} accounts`);
    console.log(`  ✅ Expenses: ${expenseAccounts.length} accounts`);
    
    console.log('');
    
    // Final result
    if (allChecksPass) {
      console.log('🎉 All Checks Passed! Accounting System is Ready!\n');
      console.log('📝 Next Steps:');
      console.log('   1. Start your server: npm run dev');
      console.log('   2. Test API: curl http://localhost:5000/api/accounting/chart-of-accounts');
      console.log('   3. Proceed with Phase 2 integration\n');
      process.exit(0);
    } else {
      console.log('❌ Some Checks Failed. Please run: npm run accounting:init\n');
      process.exit(1);
    }
    
  } catch (error: any) {
    console.error('❌ Verification Error:', error.message);
    console.log('\n💡 Tip: Run npm run accounting:init to set up the system\n');
    process.exit(1);
  }
}

// Run verification
verifyAccounting();
