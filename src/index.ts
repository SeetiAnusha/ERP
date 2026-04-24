import './config/sequelize-fix'; // Must be first!
import './models/associations'; // Import associations early to set up model relationships
import './models/accounting/associations'; // Import accounting associations
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sequelize from './config/database';
import { setupSwagger } from './middleware/swaggerMiddleware';
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware';
import clientRoutes from './routes/clientRoutes';
import supplierRoutes from './routes/supplierRoutes';
import saleRoutes from './routes/saleRoutes';
import purchaseRoutes from './routes/purchaseRoutes';
import productRoutes from './routes/productRoutes';
import productPriceRoutes from './routes/productPriceRoutes';
import inventoryRoutes from './routes/inventoryRoutes';
import fixedAssetRoutes from './routes/fixedAssetRoutes';
import investmentRoutes from './routes/investmentRoutes';
import investmentAgreementRoutes from './routes/investmentAgreementRoutes';
import investorRoutes from './routes/investorRoutes';
import cardPaymentNetworkRoutes from './routes/cardPaymentNetworkRoutes';
import cardTransactionRoutes from './routes/cardTransactionRoutes';
import bankRoutes from './routes/bankRoutes';
import investmentSummaryRoutes from './routes/investmentSummaryRoutes';
import recentActivityRoutes from './routes/recentActivityRoutes';
import prepaidExpenseRoutes from './routes/prepaidExpenseRoutes';
import paymentRoutes from './routes/paymentRoutes';
import cashRegisterRoutes from './routes/cashRegisterRoutes';
import bankRegisterRoutes from './routes/bankRegisterRoutes';
import adjustmentRoutes from './routes/adjustmentRoutes';
import reportRoutes from './routes/reportRoutes';
import accountsReceivableRoutes from './routes/accountsReceivableRoutes';
import accountsPayableRoutes from './routes/accountsPayableRoutes';
import bankAccountRoutes from './routes/bankAccountRoutes';
import creditAwarePaymentRoutes from './routes/creditAwarePaymentRoutes';
import cashRegisterMasterRoutes from './routes/cashRegisterMasterRoutes';
import cardRoutes from './routes/cardRoutes';
import financerRoutes from './routes/financerRoutes';
import expenseRoutes from './routes/expenseRoutes';
import businessExpenseRoutes from './routes/businessExpenseRoutes';
import creditBalanceRoutes from './routes/creditBalanceRoutes';
import customerCreditAwarePaymentRoutes from './routes/customerCreditAwarePaymentRoutes';
import authRoutes from './routes/authRoutes';
import userRoleRoutes from './routes/userRoleRoutes';
import dataClassificationRoutes from './routes/dataClassificationRoutes.minimal';
import transactionDeletionRoutes from './routes/transactionDeletionRoutes';
import creditCardRegisterRoutes from './routes/creditCardRegisterRoutes';
import chartOfAccountsRoutes from './routes/accounting/chartOfAccountsRoutes';
import generalLedgerRoutes from './routes/accounting/generalLedgerRoutes';
import trialBalanceRoutes from './routes/accounting/trialBalanceRoutes';
import accountBalanceRoutes from './routes/accounting/accountBalanceRoutes';
import fiscalPeriodRoutes from './routes/accounting/fiscalPeriodRoutes';
import openingBalanceRoutes from './routes/accounting/openingBalanceRoutes';
import creditCardFeeRoutes from './routes/creditCardFeeRoutes';
import importRoutes from './routes/importRoutes';
import * as productPriceService from './services/productPriceService';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

app.use(cors());
app.use(express.json());

// Setup Swagger Documentation
setupSwagger(app);

app.use('/api/clients', clientRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/products', productRoutes);
app.use('/api/product-prices', productPriceRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/fixed-assets', fixedAssetRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/investment-agreements', investmentAgreementRoutes);
app.use('/api/investors', investorRoutes);
app.use('/api/card-payment-networks', cardPaymentNetworkRoutes);
app.use('/api/card-transactions', cardTransactionRoutes);
app.use('/api/banks', bankRoutes);
app.use('/api/investment-summary', investmentSummaryRoutes);
app.use('/api/recent-activity', recentActivityRoutes);
app.use('/api/prepaid-expenses', prepaidExpenseRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/cash-register', cashRegisterRoutes);
app.use('/api/bank-register', bankRegisterRoutes);
app.use('/api/adjustments', adjustmentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/accounts-receivable', accountsReceivableRoutes);
app.use('/api/accounts-payable', accountsPayableRoutes);
app.use('/api/bank-accounts', bankAccountRoutes);
app.use('/api/cash-register-masters', cashRegisterMasterRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/financers', financerRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/business-expenses', businessExpenseRoutes);
app.use('/api/credit-balances', creditBalanceRoutes);
app.use('/api/credit-aware-payment', creditAwarePaymentRoutes);
app.use('/api/accounting/chart-of-accounts', chartOfAccountsRoutes);
app.use('/api/accounting/general-ledger', generalLedgerRoutes);
app.use('/api/accounting/trial-balance', trialBalanceRoutes);
app.use('/api/accounting/account-balances', accountBalanceRoutes);
app.use('/api/accounting/fiscal-periods', fiscalPeriodRoutes);
app.use('/api/accounting/opening-balances', openingBalanceRoutes);
app.use('/api/credit-card-fees', creditCardFeeRoutes);
app.use('/api/customer-credit-aware-payment', customerCreditAwarePaymentRoutes);
app.use('/api/import', importRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user-roles', userRoleRoutes);
app.use('/api/data-classification', dataClassificationRoutes);
app.use('/api/transaction-deletion', transactionDeletionRoutes);
app.use('/api/credit-card-register', creditCardRegisterRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'ERP Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      products: '/api/products',
      clients: '/api/clients',
      suppliers: '/api/suppliers',
      sales: '/api/sales',
      purchases: '/api/purchases'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'ERP API is running' });
});

// ==================== ERROR HANDLING MIDDLEWARE ====================
// MUST be registered AFTER all routes
// This catches all errors thrown by controllers/services and converts them to HTTP responses
app.use(notFoundHandler); // Handle 404 for undefined routes
app.use(errorHandler);    // Handle all other errors

const startServer = async () => {
  try {
    // Start the server FIRST to bind to port immediately
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Then connect to database in background
    console.log('Attempting database connection...');
    console.log('Database URL:', process.env.DATABASE_URL ? 'Set (hidden for security)' : 'NOT SET!');
    
    await sequelize.authenticate();
    console.log('✓ Database connected successfully');

    // Import all models to ensure they're registered
    console.log('📦 Ensuring all models are imported...');
    try {
      // Use the comprehensive model registry
      const { setupAssociations, getModelCount } = await import('./models/index');
      console.log(`✅ Loaded ${getModelCount()} models from registry`);
      
      // Setup all associations
      setupAssociations();
      console.log('✅ All associations configured');
    } catch (importError: any) {
      console.warn('⚠️ Model import warning:', importError.message);
    }

    // ============================================
    // PROFESSIONAL APPROACH: Use Migrations
    // ============================================
    // Tables are created/updated via migrations, not sequelize.sync()
    // Run: npm run migrate (development)
    // Run: npm run migrate:production (production)
    
    console.log('🏗️ Database tables managed by migrations');
    console.log('💡 To create/update tables, run: npm run migrate');
    console.log('💡 To check migration status, run: npm run migrate:status');
    
    // Verify database connection only (don't sync)
    await sequelize.authenticate();
    console.log('✅ Database connection verified');
    
    // Optional: Verify critical tables exist
    try {
      await sequelize.query('SELECT 1 FROM chart_of_accounts LIMIT 1');
      await sequelize.query('SELECT 1 FROM general_ledger LIMIT 1');
      await sequelize.query('SELECT 1 FROM account_balances LIMIT 1');
      console.log('✅ Critical accounting tables verified');
    } catch (tableError: any) {
      console.warn('⚠️ Some tables may be missing. Run: npm run migrate');
    }
    
    // Update price active status based on current date
    console.log('Updating product price active status...');
    try {
      await productPriceService.updatePriceActiveStatus();
      console.log('✓ Product prices synchronized with current date');
    } catch (priceError: any) {
      console.warn('⚠️ Price update failed (non-critical):', priceError.message);
    }
    
    console.log('\n🎉 Server and database are fully operational!');
    console.log('📊 All tables should now exist and be ready for use');
  } catch (error: any) {
    console.error('❌ Startup error:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    if (error.parent) {
      console.error('Parent error:', error.parent.message);
    }
    console.error('Full error:', error);
    
    console.log('\n⚠️  Server is running but database setup failed!');
    console.log('Manual fix required:');
    console.log('1. Run: npm run db:init:complete');
    console.log('2. Or restart the service to retry table creation');
    console.log('3. Check DATABASE_URL is correctly set');
  }
};

startServer();
