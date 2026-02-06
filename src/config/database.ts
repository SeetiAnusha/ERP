import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

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
      max: 15, // Match your Supabase pool size
      min: 2,
      acquire: 60000,
      idle: 10000
    },
    logging: console.log,
    // Force snake_case for all column names to match Render database
    define: {
      underscored: true,
      freezeTableName: true
    }
  }
);

export default sequelize;
