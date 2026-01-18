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

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'ERP API is running' });
});

const startServer = async () => {
  try {
    // Start the server FIRST to bind to port immediately
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Then connect to database in background
    console.log('Attempting database connection...');
    await sequelize.authenticate();
    console.log('Database connected successfully');

    // Skip database sync in production (it takes too long)
    if (process.env.NODE_ENV !== 'production') {
      console.log('Synchronizing database...');
      await sequelize.sync({ alter: true });
      console.log('Database synchronized');
    } else {
      console.log('Production mode: Skipping database sync');
    }
  } catch (error) {
    console.error('Database connection error:', error);
    // Don't exit - server is already running
  }
};

startServer();
