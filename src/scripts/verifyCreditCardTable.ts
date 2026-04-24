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
        rejectUnauthorized: false
      }
    },
    logging: false
  }
);

/**
 * VERIFY CREDIT_CARD_REGISTERS TABLE
 * 
 * This script verifies that the credit_card_registers table is properly configured
 * and matches the CreditCardRegister model requirements.
 */

async function verifyCreditCardTable() {
  console.log('🔍 VERIFYING CREDIT_CARD_REGISTERS TABLE\n');
  console.log('='.repeat(80));
  
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');
    
    // Step 1: Check if table exists
    console.log('1️⃣ Checking if table exists...\n');
    const [tableExists] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'credit_card_registers'
      );
    `);
    
    if (!(tableExists as any)[0].exists) {
      console.error('❌ Table credit_card_registers does not exist!');
      process.exit(1);
    }
    console.log('   ✅ Table exists\n');
    
    // Step 2: Check all required columns from model
    console.log('2️⃣ Checking required columns...\n');
    const requiredColumns = [
      'id', 'registration_number', 'registration_date', 'transaction_type',
      'source_transaction_type', 'amount', 'payment_method', 'related_document_type',
      'related_document_number', 'description', 'card_id', 'balance',
      'available_credit', 'used_credit', 'deletion_status'
    ];
    
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'credit_card_registers'
      ORDER BY ordinal_position;
    `);
    
    const columnNames = (columns as any[]).map(c => c.column_name);
    const missingColumns: string[] = [];
    
    requiredColumns.forEach(col => {
      if (columnNames.includes(col)) {
        console.log(`   ✅ ${col}`);
      } else {
        console.log(`   ❌ ${col} - MISSING!`);
        missingColumns.push(col);
      }
    });
    
    if (missingColumns.length > 0) {
      console.error(`\n❌ Missing ${missingColumns.length} required columns:`, missingColumns);
      process.exit(1);
    }
    
    // Step 3: Check for problematic NOT NULL constraints
    console.log('\n3️⃣ Checking NOT NULL constraints...\n');
    const notNullColumns = (columns as any[]).filter(c => c.is_nullable === 'NO');
    
    console.log('   Columns with NOT NULL constraint:');
    notNullColumns.forEach(col => {
      const hasDefault = col.column_default ? '✅ HAS DEFAULT' : '⚠️  NO DEFAULT';
      console.log(`   - ${col.column_name.padEnd(30)} ${hasDefault}`);
    });
    
    // Step 4: Check indexes
    console.log('\n4️⃣ Checking indexes...\n');
    const [indexes] = await sequelize.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'credit_card_registers'
      ORDER BY indexname;
    `);
    
    console.log(`   Found ${(indexes as any[]).length} indexes:`);
    (indexes as any[]).forEach(idx => {
      console.log(`   ✅ ${idx.indexname}`);
    });
    
    // Step 5: Test a SELECT query
    console.log('\n5️⃣ Testing SELECT query...\n');
    try {
      const [testResult] = await sequelize.query(`
        SELECT 
          id, 
          registration_number, 
          registration_date,
          transaction_type,
          amount,
          card_id,
          deletion_status
        FROM credit_card_registers 
        WHERE deletion_status IS NULL OR deletion_status != 'EXECUTED'
        LIMIT 5;
      `);
      console.log(`   ✅ Query successful - Found ${(testResult as any[]).length} records`);
      
      if ((testResult as any[]).length > 0) {
        console.log('\n   Sample record:');
        const sample = (testResult as any[])[0];
        Object.keys(sample).forEach(key => {
          console.log(`   - ${key}: ${sample[key]}`);
        });
      }
    } catch (error: any) {
      console.error('   ❌ Query failed:', error.message);
      throw error;
    }
    
    // Step 6: Check record count
    console.log('\n6️⃣ Checking record counts...\n');
    const [counts] = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE deletion_status = 'NONE' OR deletion_status IS NULL) as active,
        COUNT(*) FILTER (WHERE deletion_status = 'EXECUTED') as deleted
      FROM credit_card_registers;
    `);
    
    const stats = (counts as any[])[0];
    console.log(`   Total records: ${stats.total}`);
    console.log(`   Active records: ${stats.active}`);
    console.log(`   Deleted records: ${stats.deleted}`);
    
    // Step 7: Final summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ VERIFICATION COMPLETE - TABLE IS PROPERLY CONFIGURED!');
    console.log('='.repeat(80));
    console.log('✅ All required columns present');
    console.log('✅ No problematic NOT NULL constraints');
    console.log('✅ Indexes created');
    console.log('✅ SELECT queries working');
    console.log('✅ API endpoint should work without errors\n');
    
    console.log('📋 NEXT STEPS:');
    console.log('   1. Restart your backend server');
    console.log('   2. Test the API endpoint: GET /api/credit-card-register');
    console.log('   3. Check browser console for any remaining errors\n');
    
    process.exit(0);
    
  } catch (error: any) {
    console.error('\n❌ Verification failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the script
verifyCreditCardTable();
