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

    // Check if old column exists
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      AND column_name = 'quantity'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('Renaming column in products table...');
      await client.query('ALTER TABLE products RENAME COLUMN "quantity" TO "amount"');
      console.log('✓ Renamed quantity → amount');
    } else {
      console.log('Column already renamed or does not exist');
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
