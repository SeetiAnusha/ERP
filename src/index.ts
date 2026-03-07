import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sequelize from './config/database';
import './models/associations'; // Import associations to set up model relationships
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
import cashRegisterMasterRoutes from './routes/cashRegisterMasterRoutes';
import cardRoutes from './routes/cardRoutes';
import financerRoutes from './routes/financerRoutes';
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

    // Sync database to create tables
    console.log('Synchronizing database...');
    
    // Use basic sync to avoid ALTER TABLE issues with ENUM columns
    // This will create missing tables but won't alter existing ones
    await sequelize.sync({ force: false });
    console.log('✓ Database synchronized - all tables created');
    
    // Update price active status based on current date
    console.log('Updating product price active status...');
    await productPriceService.updatePriceActiveStatus();
    console.log('✓ Product prices synchronized with current date');
    
    console.log('\n🎉 Server and database are fully operational!');
  } catch (error: any) {
    console.error('❌ Database connection error:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    if (error.parent) {
      console.error('Parent error:', error.parent.message);
    }
    console.error('Full error:', error);
    
    // Check if it's the specific ENUM syntax error
    if (error.message && error.message.includes('USING')) {
      console.log('\n💡 This appears to be the ENUM column syntax error.');
      console.log('To fix this, run the SQL script: ERP/fix-enum-column.sql');
      console.log('Or connect to your database and run:');
      console.log('COMMENT ON COLUMN "card_payment_networks"."type" IS NULL;');
    }
    
    console.log('\n⚠️  Server is running but database is not connected!');
    console.log('Please check:');
    console.log('1. DATABASE_URL environment variable is set correctly');
    console.log('2. Database credentials are correct');
    console.log('3. Database server is accessible');
    console.log('4. SSL settings are correct for your database');
    console.log('5. Run the fix-enum-column.sql script if you see ENUM syntax errors');
  }
};

startServer();
