import './config/sequelize-fix'; // Must be first!
import './models/associations'; // Import associations early to set up model relationships
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sequelize from './config/database';
import clientRoutes from './routes/clientRoutes';
import supplierRoutes from './routes/supplierRoutes';
import saleRoutes from './routes/saleRoutes';
import purchaseRoutes from './routes/purchaseRoutes';
import productRoutes from './routes/productRoutes';
import productPriceRoutes from './routes/productPriceRoutes';
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
import dataClassificationRoutes from './routes/dataClassificationRoutes.minimal';
import transactionDeletionRoutes from './routes/transactionDeletionRoutes';
import creditCardRegisterRoutes from './routes/creditCardRegisterRoutes';
import * as productPriceService from './services/productPriceService';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

app.use(cors());
app.use(express.json());

app.use('/api/clients', clientRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/products', productRoutes);
app.use('/api/product-prices', productPriceRoutes);
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
app.use('/api/customer-credit-aware-payment', customerCreditAwarePaymentRoutes);
app.use('/api/auth', authRoutes);
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
      // Force import of associations to register all models
      await import('./models/associations');
      console.log('✅ All models and associations imported');
    } catch (importError: any) {
      console.warn('⚠️ Model import warning:', importError.message);
    }

    // FORCE CREATE ALL TABLES - No checking, just create everything
    console.log('🏗️ Force creating ALL database tables...');
    
    try {
      // Use force: true to drop and recreate all tables
      await sequelize.sync({ force: true });
      console.log('✅ ALL database tables created successfully with force sync');
    } catch (syncError: any) {
      console.error('❌ Force sync failed:', syncError.message);
      
      // If even force sync fails, try individual table creation
      console.log('🔧 Attempting manual table creation...');
      
      try {
        // Import and sync each model individually
        const models = [
          './models/Supplier',
          './models/Client', 
          './models/BankAccount',
          './models/Card',
          './models/Product',
          './models/Purchase',
          './models/BankRegister',
          './models/AccountsPayable',
          './models/AccountsReceivable',
          './models/CreditCardRegister',
          './models/CashRegister',
          './models/CashRegisterMaster'
        ];

        for (const modelPath of models) {
          try {
            const Model = (await import(modelPath)).default;
            await Model.sync({ force: true });
            console.log(`✅ Created table for ${modelPath.split('/').pop()}`);
          } catch (modelError: any) {
            console.log(`⚠️ Could not create ${modelPath}: ${modelError.message}`);
          }
        }
        
        console.log('✅ Manual table creation completed');
      } catch (manualError: any) {
        console.error('❌ Manual table creation also failed:', manualError.message);
        throw manualError;
      }
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
