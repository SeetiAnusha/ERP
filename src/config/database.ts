import { Sequelize } from 'sequelize';
import * as dotenv from 'dotenv';

dotenv.config();

const sequelize = new Sequelize(
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/erp_database',
  {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false // Important for Supabase
      }
    },
    pool: {
      max: 25, // Increased for better concurrency
      min: 5, // Keep more connections ready
      acquire: 30000, // Reduced timeout for faster failures
      idle: 10000,
      evict: 60000 // Evict idle connections after 60s
    },
    logging: false, // Disable logging in production for performance
    // Force snake_case for all column names to match Render database
    define: {
      underscored: true,
      freezeTableName: true
    }
  }
);

export default sequelize;
