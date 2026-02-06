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
import fixedAssetRoutes from './routes/fixedAssetRoutes';
import investmentRoutes from './routes/investmentRoutes';
import prepaidExpenseRoutes from './routes/prepaidExpenseRoutes';
import paymentRoutes from './routes/paymentRoutes';
import cashRegisterRoutes from './routes/cashRegisterRoutes';
import adjustmentRoutes from './routes/adjustmentRoutes';
import reportRoutes from './routes/reportRoutes';

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
app.use('/api/fixed-assets', fixedAssetRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/prepaid-expenses', prepaidExpenseRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/cash-register', cashRegisterRoutes);
app.use('/api/adjustments', adjustmentRoutes);
app.use('/api/reports', reportRoutes);

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
    // Use alter: true to update existing tables without dropping data
    await sequelize.sync({ alter: true });
    console.log('✓ Database synchronized - all tables created/updated');
  } catch (error: any) {
    console.error('❌ Database connection error:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    if (error.parent) {
      console.error('Parent error:', error.parent.message);
    }
    console.error('Full error:', error);
    console.log('\n⚠️  Server is running but database is not connected!');
    console.log('Please check:');
    console.log('1. DATABASE_URL environment variable is set correctly');
    console.log('2. Database credentials are correct');
    console.log('3. Database server is accessible');
    console.log('4. SSL settings are correct for your database');
  }
};

startServer();
