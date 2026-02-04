const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres.kdianmdldhhounhbxpqs:ERPPROJECTANUSHA@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrate() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Check if old columns exist
    const checkProducts = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      AND column_name IN ('costPrice', 'salePrice', 'Amount')
    `);

    if (checkProducts.rows.length > 0) {
      console.log('Renaming columns in products table...');
      
      if (checkProducts.rows.find(r => r.column_name === 'costPrice')) {
        await client.query('ALTER TABLE products RENAME COLUMN "costPrice" TO "unitCost"');
        console.log('✓ Renamed costPrice → unitCost');
      }
      
      if (checkProducts.rows.find(r => r.column_name === 'salePrice')) {
        await client.query('ALTER TABLE products RENAME COLUMN "salePrice" TO "subtotal"');
        console.log('✓ Renamed salePrice → subtotal');
      }
      
      if (checkProducts.rows.find(r => r.column_name === 'Amount')) {
        // Check if quantity already exists
        const quantityExists = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'products' AND column_name = 'quantity'
        `);
        
        if (quantityExists.rows.length === 0) {
          await client.query('ALTER TABLE products RENAME COLUMN "Amount" TO "quantity"');
          console.log('✓ Renamed Amount → quantity');
        } else {
          console.log('✓ quantity column already exists, dropping Amount column');
          await client.query('ALTER TABLE products DROP COLUMN "Amount"');
        }
      }
    } else {
      console.log('Products table columns already renamed');
    }

    // Check sale_items table
    const checkSaleItems = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sale_items' 
      AND column_name = 'salePrice'
    `);

    if (checkSaleItems.rows.length > 0) {
      console.log('Renaming column in sale_items table...');
      await client.query('ALTER TABLE sale_items RENAME COLUMN "salePrice" TO "unitPrice"');
      console.log('✓ Renamed salePrice → unitPrice');
    } else {
      console.log('Sale_items table column already renamed');
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
  } finally {
    await client.end();
  }
}

migrate();
