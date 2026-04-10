/**
 * Initialize Double-Entry Accounting System
 * 
 * This script:
 * 1. Creates accounting tables (chart_of_accounts, general_ledger, etc.)
 * 2. Initializes default chart of accounts
 * 3. Verifies system setup
 */

import sequelize from '../config/database';
import ChartOfAccountsService from '../services/accounting/ChartOfAccountsService';
import { syncAllModels } from '../models';

async function initializeAccounting() {
  try {
    console.log('🚀 Starting Double-Entry Accounting System Initialization...\n');
    
    // Step 1: Sync all models (including new accounting models)
    console.log('📊 Step 1: Creating database tables...');
    await syncAllModels({ alter: true });
    console.log('✅ Database tables created\n');
    
    // Step 2: Initialize default chart of accounts
    console.log('📋 Step 2: Initializing default chart of accounts...');
    await ChartOfAccountsService.initializeDefaultAccounts();
    console.log('✅ Default accounts created\n');
    
    // Step 3: Verify setup
    console.log('🔍 Step 3: Verifying setup...');
    const accounts = await ChartOfAccountsService.getAllAccounts();
    console.log(`✅ Found ${accounts.length} accounts in chart of accounts\n`);
    
    console.log('🎉 Double-Entry Accounting System Initialized Successfully!\n');
    console.log('📝 Next Steps:');
    console.log('   1. Start your server: npm run dev');
    console.log('   2. Access Chart of Accounts: GET /api/accounting/chart-of-accounts');
    console.log('   3. View General Ledger: GET /api/accounting/general-ledger');
    console.log('   4. Generate Trial Balance: GET /api/accounting/trial-balance\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing accounting system:', error);
    process.exit(1);
  }
}

// Run initialization
initializeAccounting();
