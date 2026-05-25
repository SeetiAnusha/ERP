'use strict';

/**
 * BASELINE MIGRATION - SMART VERSION
 * 
 * This migration captures the complete current database schema.
 * It's SUPER SAFE - checks if tables AND columns exist before creating.
 * Can be run multiple times without errors.
 * 
 * Generated: 2026-05-13T08:09:00.954Z
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🏗️  Running SMART baseline migration...');
    console.log('   This checks BOTH tables AND columns before creating');
    console.log('   100% safe - no "already exists" errors\n');
    
    // Get existing tables
    const existingTables = await queryInterface.showAllTables();
    console.log(`   Found ${existingTables.length} existing tables\n`);
    
    // ═══════════════════════════════════════════════════════════
    // Table: account_balances
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('account_balances')) {
      console.log('   📋 Creating table: account_balances');
      await queryInterface.createTable('account_balances', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        account_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        fiscal_period_id: {
          type: Sequelize.INTEGER
        },
        opening_balance: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        },
        debit_total: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        },
        credit_total: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        },
        closing_balance: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        },
        last_updated: {
          type: Sequelize.DATE
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });
      console.log('   ✅ Table created: account_balances');
    } else {
      console.log('   ✓ Table exists: account_balances - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('account_balances');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: account_balances.id');
        await queryInterface.addColumn('account_balances', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('account_id')) {
        console.log('   + Adding missing column: account_balances.account_id');
        await queryInterface.addColumn('account_balances', 'account_id', {
account_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('fiscal_period_id')) {
        console.log('   + Adding missing column: account_balances.fiscal_period_id');
        await queryInterface.addColumn('account_balances', 'fiscal_period_id', {
fiscal_period_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('opening_balance')) {
        console.log('   + Adding missing column: account_balances.opening_balance');
        await queryInterface.addColumn('account_balances', 'opening_balance', {
opening_balance: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('debit_total')) {
        console.log('   + Adding missing column: account_balances.debit_total');
        await queryInterface.addColumn('account_balances', 'debit_total', {
debit_total: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('credit_total')) {
        console.log('   + Adding missing column: account_balances.credit_total');
        await queryInterface.addColumn('account_balances', 'credit_total', {
credit_total: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('closing_balance')) {
        console.log('   + Adding missing column: account_balances.closing_balance');
        await queryInterface.addColumn('account_balances', 'closing_balance', {
closing_balance: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('last_updated')) {
        console.log('   + Adding missing column: account_balances.last_updated');
        await queryInterface.addColumn('account_balances', 'last_updated', {
last_updated: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: account_balances.created_at');
        await queryInterface.addColumn('account_balances', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: account_balances.updated_at');
        await queryInterface.addColumn('account_balances', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: account_classification
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('account_classification')) {
      console.log('   📋 Creating table: account_classification');
      await queryInterface.createTable('account_classification', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        account_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        activity_type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        is_cash_account: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        is_non_cash_item: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        is_working_capital: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        }
      });
      console.log('   ✅ Table created: account_classification');
    } else {
      console.log('   ✓ Table exists: account_classification - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('account_classification');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: account_classification.id');
        await queryInterface.addColumn('account_classification', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: account_classification.created_at');
        await queryInterface.addColumn('account_classification', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: account_classification.updated_at');
        await queryInterface.addColumn('account_classification', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('account_id')) {
        console.log('   + Adding missing column: account_classification.account_id');
        await queryInterface.addColumn('account_classification', 'account_id', {
account_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('activity_type')) {
        console.log('   + Adding missing column: account_classification.activity_type');
        await queryInterface.addColumn('account_classification', 'activity_type', {
activity_type: {
          type: Sequelize.STRING,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('is_cash_account')) {
        console.log('   + Adding missing column: account_classification.is_cash_account');
        await queryInterface.addColumn('account_classification', 'is_cash_account', {
is_cash_account: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        }        });
      }
      if (!existingColumns.includes('is_non_cash_item')) {
        console.log('   + Adding missing column: account_classification.is_non_cash_item');
        await queryInterface.addColumn('account_classification', 'is_non_cash_item', {
is_non_cash_item: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        }        });
      }
      if (!existingColumns.includes('is_working_capital')) {
        console.log('   + Adding missing column: account_classification.is_working_capital');
        await queryInterface.addColumn('account_classification', 'is_working_capital', {
is_working_capital: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: account_classifications
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('account_classifications')) {
      console.log('   📋 Creating table: account_classifications');
      await queryInterface.createTable('account_classifications', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        account_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        classification_type: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        classification_value: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          defaultValue: true
        },
        notes: {
          type: Sequelize.TEXT
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });
      console.log('   ✅ Table created: account_classifications');
    } else {
      console.log('   ✓ Table exists: account_classifications - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('account_classifications');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: account_classifications.id');
        await queryInterface.addColumn('account_classifications', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('account_id')) {
        console.log('   + Adding missing column: account_classifications.account_id');
        await queryInterface.addColumn('account_classifications', 'account_id', {
account_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('classification_type')) {
        console.log('   + Adding missing column: account_classifications.classification_type');
        await queryInterface.addColumn('account_classifications', 'classification_type', {
classification_type: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('classification_value')) {
        console.log('   + Adding missing column: account_classifications.classification_value');
        await queryInterface.addColumn('account_classifications', 'classification_value', {
classification_value: {
          type: Sequelize.STRING(255),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('is_active')) {
        console.log('   + Adding missing column: account_classifications.is_active');
        await queryInterface.addColumn('account_classifications', 'is_active', {
is_active: {
          type: Sequelize.BOOLEAN,
          defaultValue: true
        }        });
      }
      if (!existingColumns.includes('notes')) {
        console.log('   + Adding missing column: account_classifications.notes');
        await queryInterface.addColumn('account_classifications', 'notes', {
notes: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: account_classifications.created_at');
        await queryInterface.addColumn('account_classifications', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: account_classifications.updated_at');
        await queryInterface.addColumn('account_classifications', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: accounts_receivable
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('accounts_receivable')) {
      console.log('   📋 Creating table: accounts_receivable');
      await queryInterface.createTable('accounts_receivable', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        registration_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        registration_date: {
          type: Sequelize.DATE,
          allowNull: false
        },
        type: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        related_document_type: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        related_document_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        related_document_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        client_id: {
          type: Sequelize.INTEGER
        },
        client_name: {
          type: Sequelize.STRING(200)
        },
        client_rnc: {
          type: Sequelize.STRING(50)
        },
        ncf: {
          type: Sequelize.STRING(50)
        },
        sale_of: {
          type: Sequelize.TEXT
        },
        card_network: {
          type: Sequelize.STRING(50)
        },
        amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        received_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        },
        balance_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        expected_bank_deposit: {
          type: Sequelize.DECIMAL
        },
        actual_bank_deposit: {
          type: Sequelize.DECIMAL
        },
        bank_account_id: {
          type: Sequelize.INTEGER
        },
        status: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'Pending'
        },
        due_date: {
          type: Sequelize.DATE
        },
        received_date: {
          type: Sequelize.DATE
        },
        notes: {
          type: Sequelize.TEXT
        },
        collection_date: {
          type: Sequelize.DATE
        },
        transfer_reference: {
          type: Sequelize.STRING(100)
        },
        collection_notes: {
          type: Sequelize.TEXT
        },
        deletion_status: {
          type: Sequelize.STRING,
          defaultValue: 'NONE'
        },
        deleted_at: {
          type: Sequelize.DATE
        },
        deleted_by: {
          type: Sequelize.INTEGER
        },
        deletion_reason_code: {
          type: Sequelize.STRING(50)
        },
        deletion_memo: {
          type: Sequelize.TEXT
        },
        deletion_approval_id: {
          type: Sequelize.INTEGER
        },
        reversal_transaction_id: {
          type: Sequelize.INTEGER
        },
        is_reversal: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        },
        original_transaction_id: {
          type: Sequelize.INTEGER
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: accounts_receivable');
    } else {
      console.log('   ✓ Table exists: accounts_receivable - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('accounts_receivable');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: accounts_receivable.id');
        await queryInterface.addColumn('accounts_receivable', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('registration_number')) {
        console.log('   + Adding missing column: accounts_receivable.registration_number');
        await queryInterface.addColumn('accounts_receivable', 'registration_number', {
registration_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('registration_date')) {
        console.log('   + Adding missing column: accounts_receivable.registration_date');
        await queryInterface.addColumn('accounts_receivable', 'registration_date', {
registration_date: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('type')) {
        console.log('   + Adding missing column: accounts_receivable.type');
        await queryInterface.addColumn('accounts_receivable', 'type', {
type: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('related_document_type')) {
        console.log('   + Adding missing column: accounts_receivable.related_document_type');
        await queryInterface.addColumn('accounts_receivable', 'related_document_type', {
related_document_type: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('related_document_id')) {
        console.log('   + Adding missing column: accounts_receivable.related_document_id');
        await queryInterface.addColumn('accounts_receivable', 'related_document_id', {
related_document_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('related_document_number')) {
        console.log('   + Adding missing column: accounts_receivable.related_document_number');
        await queryInterface.addColumn('accounts_receivable', 'related_document_number', {
related_document_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('client_id')) {
        console.log('   + Adding missing column: accounts_receivable.client_id');
        await queryInterface.addColumn('accounts_receivable', 'client_id', {
client_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('client_name')) {
        console.log('   + Adding missing column: accounts_receivable.client_name');
        await queryInterface.addColumn('accounts_receivable', 'client_name', {
client_name: {
          type: Sequelize.STRING(200)
        }        });
      }
      if (!existingColumns.includes('client_rnc')) {
        console.log('   + Adding missing column: accounts_receivable.client_rnc');
        await queryInterface.addColumn('accounts_receivable', 'client_rnc', {
client_rnc: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('ncf')) {
        console.log('   + Adding missing column: accounts_receivable.ncf');
        await queryInterface.addColumn('accounts_receivable', 'ncf', {
ncf: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('sale_of')) {
        console.log('   + Adding missing column: accounts_receivable.sale_of');
        await queryInterface.addColumn('accounts_receivable', 'sale_of', {
sale_of: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('card_network')) {
        console.log('   + Adding missing column: accounts_receivable.card_network');
        await queryInterface.addColumn('accounts_receivable', 'card_network', {
card_network: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('amount')) {
        console.log('   + Adding missing column: accounts_receivable.amount');
        await queryInterface.addColumn('accounts_receivable', 'amount', {
amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('received_amount')) {
        console.log('   + Adding missing column: accounts_receivable.received_amount');
        await queryInterface.addColumn('accounts_receivable', 'received_amount', {
received_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('balance_amount')) {
        console.log('   + Adding missing column: accounts_receivable.balance_amount');
        await queryInterface.addColumn('accounts_receivable', 'balance_amount', {
balance_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('expected_bank_deposit')) {
        console.log('   + Adding missing column: accounts_receivable.expected_bank_deposit');
        await queryInterface.addColumn('accounts_receivable', 'expected_bank_deposit', {
expected_bank_deposit: {
          type: Sequelize.DECIMAL
        }        });
      }
      if (!existingColumns.includes('actual_bank_deposit')) {
        console.log('   + Adding missing column: accounts_receivable.actual_bank_deposit');
        await queryInterface.addColumn('accounts_receivable', 'actual_bank_deposit', {
actual_bank_deposit: {
          type: Sequelize.DECIMAL
        }        });
      }
      if (!existingColumns.includes('bank_account_id')) {
        console.log('   + Adding missing column: accounts_receivable.bank_account_id');
        await queryInterface.addColumn('accounts_receivable', 'bank_account_id', {
bank_account_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('status')) {
        console.log('   + Adding missing column: accounts_receivable.status');
        await queryInterface.addColumn('accounts_receivable', 'status', {
status: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'Pending'
        }        });
      }
      if (!existingColumns.includes('due_date')) {
        console.log('   + Adding missing column: accounts_receivable.due_date');
        await queryInterface.addColumn('accounts_receivable', 'due_date', {
due_date: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('received_date')) {
        console.log('   + Adding missing column: accounts_receivable.received_date');
        await queryInterface.addColumn('accounts_receivable', 'received_date', {
received_date: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('notes')) {
        console.log('   + Adding missing column: accounts_receivable.notes');
        await queryInterface.addColumn('accounts_receivable', 'notes', {
notes: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('collection_date')) {
        console.log('   + Adding missing column: accounts_receivable.collection_date');
        await queryInterface.addColumn('accounts_receivable', 'collection_date', {
collection_date: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('transfer_reference')) {
        console.log('   + Adding missing column: accounts_receivable.transfer_reference');
        await queryInterface.addColumn('accounts_receivable', 'transfer_reference', {
transfer_reference: {
          type: Sequelize.STRING(100)
        }        });
      }
      if (!existingColumns.includes('collection_notes')) {
        console.log('   + Adding missing column: accounts_receivable.collection_notes');
        await queryInterface.addColumn('accounts_receivable', 'collection_notes', {
collection_notes: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('deletion_status')) {
        console.log('   + Adding missing column: accounts_receivable.deletion_status');
        await queryInterface.addColumn('accounts_receivable', 'deletion_status', {
deletion_status: {
          type: Sequelize.STRING,
          defaultValue: 'NONE'
        }        });
      }
      if (!existingColumns.includes('deleted_at')) {
        console.log('   + Adding missing column: accounts_receivable.deleted_at');
        await queryInterface.addColumn('accounts_receivable', 'deleted_at', {
deleted_at: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('deleted_by')) {
        console.log('   + Adding missing column: accounts_receivable.deleted_by');
        await queryInterface.addColumn('accounts_receivable', 'deleted_by', {
deleted_by: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('deletion_reason_code')) {
        console.log('   + Adding missing column: accounts_receivable.deletion_reason_code');
        await queryInterface.addColumn('accounts_receivable', 'deletion_reason_code', {
deletion_reason_code: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('deletion_memo')) {
        console.log('   + Adding missing column: accounts_receivable.deletion_memo');
        await queryInterface.addColumn('accounts_receivable', 'deletion_memo', {
deletion_memo: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('deletion_approval_id')) {
        console.log('   + Adding missing column: accounts_receivable.deletion_approval_id');
        await queryInterface.addColumn('accounts_receivable', 'deletion_approval_id', {
deletion_approval_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('reversal_transaction_id')) {
        console.log('   + Adding missing column: accounts_receivable.reversal_transaction_id');
        await queryInterface.addColumn('accounts_receivable', 'reversal_transaction_id', {
reversal_transaction_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('is_reversal')) {
        console.log('   + Adding missing column: accounts_receivable.is_reversal');
        await queryInterface.addColumn('accounts_receivable', 'is_reversal', {
is_reversal: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        }        });
      }
      if (!existingColumns.includes('original_transaction_id')) {
        console.log('   + Adding missing column: accounts_receivable.original_transaction_id');
        await queryInterface.addColumn('accounts_receivable', 'original_transaction_id', {
original_transaction_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: accounts_receivable.created_at');
        await queryInterface.addColumn('accounts_receivable', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: accounts_receivable.updated_at');
        await queryInterface.addColumn('accounts_receivable', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: approval_requests
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('approval_requests')) {
      console.log('   📋 Creating table: approval_requests');
      await queryInterface.createTable('approval_requests', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        request_number: {
          type: Sequelize.STRING(20),
          allowNull: false
        },
        workflow_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        entity_type: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        entity_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        requested_by: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        request_reason: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        deletion_reason_code: {
          type: Sequelize.STRING(50)
        },
        custom_memo: {
          type: Sequelize.TEXT
        },
        impact_analysis: {
          type: Sequelize.JSON,
          allowNull: false
        },
        current_step: {
          type: Sequelize.INTEGER,
          defaultValue: 1
        },
        status: {
          type: Sequelize.STRING,
          defaultValue: 'Pending'
        },
        approved_at: {
          type: Sequelize.DATE
        },
        executed_at: {
          type: Sequelize.DATE
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: approval_requests');
    } else {
      console.log('   ✓ Table exists: approval_requests - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('approval_requests');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: approval_requests.id');
        await queryInterface.addColumn('approval_requests', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('request_number')) {
        console.log('   + Adding missing column: approval_requests.request_number');
        await queryInterface.addColumn('approval_requests', 'request_number', {
request_number: {
          type: Sequelize.STRING(20),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('workflow_id')) {
        console.log('   + Adding missing column: approval_requests.workflow_id');
        await queryInterface.addColumn('approval_requests', 'workflow_id', {
workflow_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('entity_type')) {
        console.log('   + Adding missing column: approval_requests.entity_type');
        await queryInterface.addColumn('approval_requests', 'entity_type', {
entity_type: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('entity_id')) {
        console.log('   + Adding missing column: approval_requests.entity_id');
        await queryInterface.addColumn('approval_requests', 'entity_id', {
entity_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('requested_by')) {
        console.log('   + Adding missing column: approval_requests.requested_by');
        await queryInterface.addColumn('approval_requests', 'requested_by', {
requested_by: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('request_reason')) {
        console.log('   + Adding missing column: approval_requests.request_reason');
        await queryInterface.addColumn('approval_requests', 'request_reason', {
request_reason: {
          type: Sequelize.TEXT,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('deletion_reason_code')) {
        console.log('   + Adding missing column: approval_requests.deletion_reason_code');
        await queryInterface.addColumn('approval_requests', 'deletion_reason_code', {
deletion_reason_code: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('custom_memo')) {
        console.log('   + Adding missing column: approval_requests.custom_memo');
        await queryInterface.addColumn('approval_requests', 'custom_memo', {
custom_memo: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('impact_analysis')) {
        console.log('   + Adding missing column: approval_requests.impact_analysis');
        await queryInterface.addColumn('approval_requests', 'impact_analysis', {
impact_analysis: {
          type: Sequelize.JSON,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('current_step')) {
        console.log('   + Adding missing column: approval_requests.current_step');
        await queryInterface.addColumn('approval_requests', 'current_step', {
current_step: {
          type: Sequelize.INTEGER,
          defaultValue: 1
        }        });
      }
      if (!existingColumns.includes('status')) {
        console.log('   + Adding missing column: approval_requests.status');
        await queryInterface.addColumn('approval_requests', 'status', {
status: {
          type: Sequelize.STRING,
          defaultValue: 'Pending'
        }        });
      }
      if (!existingColumns.includes('approved_at')) {
        console.log('   + Adding missing column: approval_requests.approved_at');
        await queryInterface.addColumn('approval_requests', 'approved_at', {
approved_at: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('executed_at')) {
        console.log('   + Adding missing column: approval_requests.executed_at');
        await queryInterface.addColumn('approval_requests', 'executed_at', {
executed_at: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: approval_requests.created_at');
        await queryInterface.addColumn('approval_requests', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: approval_requests.updated_at');
        await queryInterface.addColumn('approval_requests', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: approval_steps
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('approval_steps')) {
      console.log('   📋 Creating table: approval_steps');
      await queryInterface.createTable('approval_steps', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        request_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        step_number: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        approver_role: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        approver_id: {
          type: Sequelize.INTEGER
        },
        required_by: {
          type: Sequelize.DATE
        },
        approved_by: {
          type: Sequelize.INTEGER
        },
        approved_at: {
          type: Sequelize.DATE
        },
        approval_notes: {
          type: Sequelize.TEXT
        },
        status: {
          type: Sequelize.STRING,
          defaultValue: 'Pending'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: approval_steps');
    } else {
      console.log('   ✓ Table exists: approval_steps - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('approval_steps');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: approval_steps.id');
        await queryInterface.addColumn('approval_steps', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('request_id')) {
        console.log('   + Adding missing column: approval_steps.request_id');
        await queryInterface.addColumn('approval_steps', 'request_id', {
request_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('step_number')) {
        console.log('   + Adding missing column: approval_steps.step_number');
        await queryInterface.addColumn('approval_steps', 'step_number', {
step_number: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('approver_role')) {
        console.log('   + Adding missing column: approval_steps.approver_role');
        await queryInterface.addColumn('approval_steps', 'approver_role', {
approver_role: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('approver_id')) {
        console.log('   + Adding missing column: approval_steps.approver_id');
        await queryInterface.addColumn('approval_steps', 'approver_id', {
approver_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('required_by')) {
        console.log('   + Adding missing column: approval_steps.required_by');
        await queryInterface.addColumn('approval_steps', 'required_by', {
required_by: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('approved_by')) {
        console.log('   + Adding missing column: approval_steps.approved_by');
        await queryInterface.addColumn('approval_steps', 'approved_by', {
approved_by: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('approved_at')) {
        console.log('   + Adding missing column: approval_steps.approved_at');
        await queryInterface.addColumn('approval_steps', 'approved_at', {
approved_at: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('approval_notes')) {
        console.log('   + Adding missing column: approval_steps.approval_notes');
        await queryInterface.addColumn('approval_steps', 'approval_notes', {
approval_notes: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('status')) {
        console.log('   + Adding missing column: approval_steps.status');
        await queryInterface.addColumn('approval_steps', 'status', {
status: {
          type: Sequelize.STRING,
          defaultValue: 'Pending'
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: approval_steps.created_at');
        await queryInterface.addColumn('approval_steps', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: approval_steps.updated_at');
        await queryInterface.addColumn('approval_steps', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: associated_invoices
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('associated_invoices')) {
      console.log('   📋 Creating table: associated_invoices');
      await queryInterface.createTable('associated_invoices', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        purchase_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        supplier_rnc: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        supplier_name: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        concept: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        ncf: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        date: {
          type: Sequelize.DATE,
          allowNull: false
        },
        tax_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        tax: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        purchase_type: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        payment_type: {
          type: Sequelize.STRING(50)
        },
        bank_account_id: {
          type: Sequelize.INTEGER
        },
        card_id: {
          type: Sequelize.INTEGER
        },
        cheque_number: {
          type: Sequelize.STRING(100)
        },
        cheque_date: {
          type: Sequelize.DATE
        },
        transfer_number: {
          type: Sequelize.STRING(100)
        },
        transfer_date: {
          type: Sequelize.DATE
        },
        payment_reference: {
          type: Sequelize.STRING(100)
        },
        voucher_date: {
          type: Sequelize.DATE
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: associated_invoices');
    } else {
      console.log('   ✓ Table exists: associated_invoices - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('associated_invoices');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: associated_invoices.id');
        await queryInterface.addColumn('associated_invoices', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('purchase_id')) {
        console.log('   + Adding missing column: associated_invoices.purchase_id');
        await queryInterface.addColumn('associated_invoices', 'purchase_id', {
purchase_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('supplier_rnc')) {
        console.log('   + Adding missing column: associated_invoices.supplier_rnc');
        await queryInterface.addColumn('associated_invoices', 'supplier_rnc', {
supplier_rnc: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('supplier_name')) {
        console.log('   + Adding missing column: associated_invoices.supplier_name');
        await queryInterface.addColumn('associated_invoices', 'supplier_name', {
supplier_name: {
          type: Sequelize.STRING(255),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('concept')) {
        console.log('   + Adding missing column: associated_invoices.concept');
        await queryInterface.addColumn('associated_invoices', 'concept', {
concept: {
          type: Sequelize.STRING(255),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('ncf')) {
        console.log('   + Adding missing column: associated_invoices.ncf');
        await queryInterface.addColumn('associated_invoices', 'ncf', {
ncf: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('date')) {
        console.log('   + Adding missing column: associated_invoices.date');
        await queryInterface.addColumn('associated_invoices', 'date', {
date: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('tax_amount')) {
        console.log('   + Adding missing column: associated_invoices.tax_amount');
        await queryInterface.addColumn('associated_invoices', 'tax_amount', {
tax_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('tax')) {
        console.log('   + Adding missing column: associated_invoices.tax');
        await queryInterface.addColumn('associated_invoices', 'tax', {
tax: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('amount')) {
        console.log('   + Adding missing column: associated_invoices.amount');
        await queryInterface.addColumn('associated_invoices', 'amount', {
amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('purchase_type')) {
        console.log('   + Adding missing column: associated_invoices.purchase_type');
        await queryInterface.addColumn('associated_invoices', 'purchase_type', {
purchase_type: {
          type: Sequelize.STRING(100),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('payment_type')) {
        console.log('   + Adding missing column: associated_invoices.payment_type');
        await queryInterface.addColumn('associated_invoices', 'payment_type', {
payment_type: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('bank_account_id')) {
        console.log('   + Adding missing column: associated_invoices.bank_account_id');
        await queryInterface.addColumn('associated_invoices', 'bank_account_id', {
bank_account_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('card_id')) {
        console.log('   + Adding missing column: associated_invoices.card_id');
        await queryInterface.addColumn('associated_invoices', 'card_id', {
card_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('cheque_number')) {
        console.log('   + Adding missing column: associated_invoices.cheque_number');
        await queryInterface.addColumn('associated_invoices', 'cheque_number', {
cheque_number: {
          type: Sequelize.STRING(100)
        }        });
      }
      if (!existingColumns.includes('cheque_date')) {
        console.log('   + Adding missing column: associated_invoices.cheque_date');
        await queryInterface.addColumn('associated_invoices', 'cheque_date', {
cheque_date: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('transfer_number')) {
        console.log('   + Adding missing column: associated_invoices.transfer_number');
        await queryInterface.addColumn('associated_invoices', 'transfer_number', {
transfer_number: {
          type: Sequelize.STRING(100)
        }        });
      }
      if (!existingColumns.includes('transfer_date')) {
        console.log('   + Adding missing column: associated_invoices.transfer_date');
        await queryInterface.addColumn('associated_invoices', 'transfer_date', {
transfer_date: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('payment_reference')) {
        console.log('   + Adding missing column: associated_invoices.payment_reference');
        await queryInterface.addColumn('associated_invoices', 'payment_reference', {
payment_reference: {
          type: Sequelize.STRING(100)
        }        });
      }
      if (!existingColumns.includes('voucher_date')) {
        console.log('   + Adding missing column: associated_invoices.voucher_date');
        await queryInterface.addColumn('associated_invoices', 'voucher_date', {
voucher_date: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: associated_invoices.created_at');
        await queryInterface.addColumn('associated_invoices', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: associated_invoices.updated_at');
        await queryInterface.addColumn('associated_invoices', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: audit_logs
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('audit_logs')) {
      console.log('   📋 Creating table: audit_logs');
      await queryInterface.createTable('audit_logs', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        entity_type: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        entity_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        action: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        user_id: {
          type: Sequelize.INTEGER
        },
        changes: {
          type: Sequelize.JSONB
        },
        ip_address: {
          type: Sequelize.STRING(45)
        },
        user_agent: {
          type: Sequelize.TEXT
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });
      console.log('   ✅ Table created: audit_logs');
    } else {
      console.log('   ✓ Table exists: audit_logs - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('audit_logs');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: audit_logs.id');
        await queryInterface.addColumn('audit_logs', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('entity_type')) {
        console.log('   + Adding missing column: audit_logs.entity_type');
        await queryInterface.addColumn('audit_logs', 'entity_type', {
entity_type: {
          type: Sequelize.STRING(100),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('entity_id')) {
        console.log('   + Adding missing column: audit_logs.entity_id');
        await queryInterface.addColumn('audit_logs', 'entity_id', {
entity_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('action')) {
        console.log('   + Adding missing column: audit_logs.action');
        await queryInterface.addColumn('audit_logs', 'action', {
action: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('user_id')) {
        console.log('   + Adding missing column: audit_logs.user_id');
        await queryInterface.addColumn('audit_logs', 'user_id', {
user_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('changes')) {
        console.log('   + Adding missing column: audit_logs.changes');
        await queryInterface.addColumn('audit_logs', 'changes', {
changes: {
          type: Sequelize.JSONB
        }        });
      }
      if (!existingColumns.includes('ip_address')) {
        console.log('   + Adding missing column: audit_logs.ip_address');
        await queryInterface.addColumn('audit_logs', 'ip_address', {
ip_address: {
          type: Sequelize.STRING(45)
        }        });
      }
      if (!existingColumns.includes('user_agent')) {
        console.log('   + Adding missing column: audit_logs.user_agent');
        await queryInterface.addColumn('audit_logs', 'user_agent', {
user_agent: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: audit_logs.created_at');
        await queryInterface.addColumn('audit_logs', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: auth_users
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('auth_users')) {
      console.log('   📋 Creating table: auth_users');
      await queryInterface.createTable('auth_users', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        email: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        password_hash: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        first_name: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        last_name: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        role: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'user'
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        is_email_verified: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        email_verification_token: {
          type: Sequelize.STRING(255)
        },
        password_reset_token: {
          type: Sequelize.STRING(255)
        },
        password_reset_expires: {
          type: Sequelize.DATE
        },
        failed_login_attempts: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        account_locked_until: {
          type: Sequelize.DATE
        },
        last_login_at: {
          type: Sequelize.DATE
        },
        last_password_change_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        password_history: {
          type: Sequelize.JSON,
          allowNull: false,
          defaultValue: '[]'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: auth_users');
    } else {
      console.log('   ✓ Table exists: auth_users - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('auth_users');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: auth_users.id');
        await queryInterface.addColumn('auth_users', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('email')) {
        console.log('   + Adding missing column: auth_users.email');
        await queryInterface.addColumn('auth_users', 'email', {
email: {
          type: Sequelize.STRING(255),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('password_hash')) {
        console.log('   + Adding missing column: auth_users.password_hash');
        await queryInterface.addColumn('auth_users', 'password_hash', {
password_hash: {
          type: Sequelize.STRING(255),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('first_name')) {
        console.log('   + Adding missing column: auth_users.first_name');
        await queryInterface.addColumn('auth_users', 'first_name', {
first_name: {
          type: Sequelize.STRING(100),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('last_name')) {
        console.log('   + Adding missing column: auth_users.last_name');
        await queryInterface.addColumn('auth_users', 'last_name', {
last_name: {
          type: Sequelize.STRING(100),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('role')) {
        console.log('   + Adding missing column: auth_users.role');
        await queryInterface.addColumn('auth_users', 'role', {
role: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'user'
        }        });
      }
      if (!existingColumns.includes('is_active')) {
        console.log('   + Adding missing column: auth_users.is_active');
        await queryInterface.addColumn('auth_users', 'is_active', {
is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        }        });
      }
      if (!existingColumns.includes('is_email_verified')) {
        console.log('   + Adding missing column: auth_users.is_email_verified');
        await queryInterface.addColumn('auth_users', 'is_email_verified', {
is_email_verified: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        }        });
      }
      if (!existingColumns.includes('email_verification_token')) {
        console.log('   + Adding missing column: auth_users.email_verification_token');
        await queryInterface.addColumn('auth_users', 'email_verification_token', {
email_verification_token: {
          type: Sequelize.STRING(255)
        }        });
      }
      if (!existingColumns.includes('password_reset_token')) {
        console.log('   + Adding missing column: auth_users.password_reset_token');
        await queryInterface.addColumn('auth_users', 'password_reset_token', {
password_reset_token: {
          type: Sequelize.STRING(255)
        }        });
      }
      if (!existingColumns.includes('password_reset_expires')) {
        console.log('   + Adding missing column: auth_users.password_reset_expires');
        await queryInterface.addColumn('auth_users', 'password_reset_expires', {
password_reset_expires: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('failed_login_attempts')) {
        console.log('   + Adding missing column: auth_users.failed_login_attempts');
        await queryInterface.addColumn('auth_users', 'failed_login_attempts', {
failed_login_attempts: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('account_locked_until')) {
        console.log('   + Adding missing column: auth_users.account_locked_until');
        await queryInterface.addColumn('auth_users', 'account_locked_until', {
account_locked_until: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('last_login_at')) {
        console.log('   + Adding missing column: auth_users.last_login_at');
        await queryInterface.addColumn('auth_users', 'last_login_at', {
last_login_at: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('last_password_change_at')) {
        console.log('   + Adding missing column: auth_users.last_password_change_at');
        await queryInterface.addColumn('auth_users', 'last_password_change_at', {
last_password_change_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('password_history')) {
        console.log('   + Adding missing column: auth_users.password_history');
        await queryInterface.addColumn('auth_users', 'password_history', {
password_history: {
          type: Sequelize.JSON,
          allowNull: false,
          defaultValue: '[]'
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: auth_users.created_at');
        await queryInterface.addColumn('auth_users', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: auth_users.updated_at');
        await queryInterface.addColumn('auth_users', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: bank_accounts
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('bank_accounts')) {
      console.log('   📋 Creating table: bank_accounts');
      await queryInterface.createTable('bank_accounts', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        code: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        bank_name: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        account_number: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        account_type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        balance: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'ACTIVE'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: bank_accounts');
    } else {
      console.log('   ✓ Table exists: bank_accounts - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('bank_accounts');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: bank_accounts.id');
        await queryInterface.addColumn('bank_accounts', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('code')) {
        console.log('   + Adding missing column: bank_accounts.code');
        await queryInterface.addColumn('bank_accounts', 'code', {
code: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('bank_name')) {
        console.log('   + Adding missing column: bank_accounts.bank_name');
        await queryInterface.addColumn('bank_accounts', 'bank_name', {
bank_name: {
          type: Sequelize.STRING(255),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('account_number')) {
        console.log('   + Adding missing column: bank_accounts.account_number');
        await queryInterface.addColumn('bank_accounts', 'account_number', {
account_number: {
          type: Sequelize.STRING(100),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('account_type')) {
        console.log('   + Adding missing column: bank_accounts.account_type');
        await queryInterface.addColumn('bank_accounts', 'account_type', {
account_type: {
          type: Sequelize.STRING,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('balance')) {
        console.log('   + Adding missing column: bank_accounts.balance');
        await queryInterface.addColumn('bank_accounts', 'balance', {
balance: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('status')) {
        console.log('   + Adding missing column: bank_accounts.status');
        await queryInterface.addColumn('bank_accounts', 'status', {
status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'ACTIVE'
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: bank_accounts.created_at');
        await queryInterface.addColumn('bank_accounts', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: bank_accounts.updated_at');
        await queryInterface.addColumn('bank_accounts', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: card_payment_networks
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('card_payment_networks')) {
      console.log('   📋 Creating table: card_payment_networks');
      await queryInterface.createTable('card_payment_networks', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        name: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        processing_fee: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        },
        settlement_days: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        description: {
          type: Sequelize.TEXT
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: card_payment_networks');
    } else {
      console.log('   ✓ Table exists: card_payment_networks - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('card_payment_networks');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: card_payment_networks.id');
        await queryInterface.addColumn('card_payment_networks', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('name')) {
        console.log('   + Adding missing column: card_payment_networks.name');
        await queryInterface.addColumn('card_payment_networks', 'name', {
name: {
          type: Sequelize.STRING(100),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('type')) {
        console.log('   + Adding missing column: card_payment_networks.type');
        await queryInterface.addColumn('card_payment_networks', 'type', {
type: {
          type: Sequelize.STRING,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('processing_fee')) {
        console.log('   + Adding missing column: card_payment_networks.processing_fee');
        await queryInterface.addColumn('card_payment_networks', 'processing_fee', {
processing_fee: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('settlement_days')) {
        console.log('   + Adding missing column: card_payment_networks.settlement_days');
        await queryInterface.addColumn('card_payment_networks', 'settlement_days', {
settlement_days: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1
        }        });
      }
      if (!existingColumns.includes('is_active')) {
        console.log('   + Adding missing column: card_payment_networks.is_active');
        await queryInterface.addColumn('card_payment_networks', 'is_active', {
is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        }        });
      }
      if (!existingColumns.includes('description')) {
        console.log('   + Adding missing column: card_payment_networks.description');
        await queryInterface.addColumn('card_payment_networks', 'description', {
description: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: card_payment_networks.created_at');
        await queryInterface.addColumn('card_payment_networks', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: card_payment_networks.updated_at');
        await queryInterface.addColumn('card_payment_networks', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: cards
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('cards')) {
      console.log('   📋 Creating table: cards');
      await queryInterface.createTable('cards', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        code: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        bank_name: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        card_name: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        card_number_last4: {
          type: Sequelize.STRING(4),
          allowNull: false
        },
        card_type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        card_brand: {
          type: Sequelize.STRING(50)
        },
        bank_account_id: {
          type: Sequelize.INTEGER
        },
        credit_limit: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        },
        used_credit: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'ACTIVE'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: cards');
    } else {
      console.log('   ✓ Table exists: cards - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('cards');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: cards.id');
        await queryInterface.addColumn('cards', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('code')) {
        console.log('   + Adding missing column: cards.code');
        await queryInterface.addColumn('cards', 'code', {
code: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('bank_name')) {
        console.log('   + Adding missing column: cards.bank_name');
        await queryInterface.addColumn('cards', 'bank_name', {
bank_name: {
          type: Sequelize.STRING(255),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('card_name')) {
        console.log('   + Adding missing column: cards.card_name');
        await queryInterface.addColumn('cards', 'card_name', {
card_name: {
          type: Sequelize.STRING(255),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('card_number_last4')) {
        console.log('   + Adding missing column: cards.card_number_last4');
        await queryInterface.addColumn('cards', 'card_number_last4', {
card_number_last4: {
          type: Sequelize.STRING(4),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('card_type')) {
        console.log('   + Adding missing column: cards.card_type');
        await queryInterface.addColumn('cards', 'card_type', {
card_type: {
          type: Sequelize.STRING,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('card_brand')) {
        console.log('   + Adding missing column: cards.card_brand');
        await queryInterface.addColumn('cards', 'card_brand', {
card_brand: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('bank_account_id')) {
        console.log('   + Adding missing column: cards.bank_account_id');
        await queryInterface.addColumn('cards', 'bank_account_id', {
bank_account_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('credit_limit')) {
        console.log('   + Adding missing column: cards.credit_limit');
        await queryInterface.addColumn('cards', 'credit_limit', {
credit_limit: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('used_credit')) {
        console.log('   + Adding missing column: cards.used_credit');
        await queryInterface.addColumn('cards', 'used_credit', {
used_credit: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('status')) {
        console.log('   + Adding missing column: cards.status');
        await queryInterface.addColumn('cards', 'status', {
status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'ACTIVE'
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: cards.created_at');
        await queryInterface.addColumn('cards', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: cards.updated_at');
        await queryInterface.addColumn('cards', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: cash_register
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('cash_register')) {
      console.log('   📋 Creating table: cash_register');
      await queryInterface.createTable('cash_register', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        registration_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        registration_date: {
          type: Sequelize.DATE,
          allowNull: false
        },
        transaction_type: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        payment_method: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        related_document_type: {
          type: Sequelize.STRING(50)
        },
        related_document_number: {
          type: Sequelize.STRING(50)
        },
        client_rnc: {
          type: Sequelize.STRING(50)
        },
        client_name: {
          type: Sequelize.STRING(255)
        },
        ncf: {
          type: Sequelize.STRING(50)
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        balance: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        cash_register_id: {
          type: Sequelize.INTEGER
        },
        bank_account_id: {
          type: Sequelize.INTEGER
        },
        cheque_number: {
          type: Sequelize.STRING(50)
        },
        receipt_number: {
          type: Sequelize.STRING(50)
        },
        customer_id: {
          type: Sequelize.INTEGER
        },
        invoice_ids: {
          type: Sequelize.TEXT
        },
        investment_agreement_id: {
          type: Sequelize.INTEGER
        },
        deletion_status: {
          type: Sequelize.STRING,
          defaultValue: 'NONE'
        },
        deleted_at: {
          type: Sequelize.DATE
        },
        deleted_by: {
          type: Sequelize.INTEGER
        },
        deletion_reason_code: {
          type: Sequelize.STRING(50)
        },
        deletion_memo: {
          type: Sequelize.TEXT
        },
        deletion_approval_id: {
          type: Sequelize.INTEGER
        },
        reversal_transaction_id: {
          type: Sequelize.INTEGER
        },
        is_reversal: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        },
        original_transaction_id: {
          type: Sequelize.INTEGER
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        sales_date: {
          type: Sequelize.DATEONLY
        },
        deposit_date: {
          type: Sequelize.DATEONLY
        },
        deposit_reference_date: {
          type: Sequelize.DATEONLY
        },
        is_previous_day_deposit: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        },
        deposit_time: {
          type: Sequelize.TIME
        },
        deposited_by: {
          type: Sequelize.STRING(255)
        },
        deposit_reference_number: {
          type: Sequelize.STRING(100)
        },
        store_code: {
          type: Sequelize.STRING(50)
        },
        store_name: {
          type: Sequelize.STRING(255)
        },
        store_location: {
          type: Sequelize.STRING(255)
        },
        opening_balance: {
          type: Sequelize.DECIMAL(15, 2)
        },
        closing_balance: {
          type: Sequelize.DECIMAL(15, 2)
        }
      });
      console.log('   ✅ Table created: cash_register');
    } else {
      console.log('   ✓ Table exists: cash_register - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('cash_register');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: cash_register.id');
        await queryInterface.addColumn('cash_register', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('registration_number')) {
        console.log('   + Adding missing column: cash_register.registration_number');
        await queryInterface.addColumn('cash_register', 'registration_number', {
registration_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('registration_date')) {
        console.log('   + Adding missing column: cash_register.registration_date');
        await queryInterface.addColumn('cash_register', 'registration_date', {
registration_date: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('transaction_type')) {
        console.log('   + Adding missing column: cash_register.transaction_type');
        await queryInterface.addColumn('cash_register', 'transaction_type', {
transaction_type: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('amount')) {
        console.log('   + Adding missing column: cash_register.amount');
        await queryInterface.addColumn('cash_register', 'amount', {
amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('payment_method')) {
        console.log('   + Adding missing column: cash_register.payment_method');
        await queryInterface.addColumn('cash_register', 'payment_method', {
payment_method: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('related_document_type')) {
        console.log('   + Adding missing column: cash_register.related_document_type');
        await queryInterface.addColumn('cash_register', 'related_document_type', {
related_document_type: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('related_document_number')) {
        console.log('   + Adding missing column: cash_register.related_document_number');
        await queryInterface.addColumn('cash_register', 'related_document_number', {
related_document_number: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('client_rnc')) {
        console.log('   + Adding missing column: cash_register.client_rnc');
        await queryInterface.addColumn('cash_register', 'client_rnc', {
client_rnc: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('client_name')) {
        console.log('   + Adding missing column: cash_register.client_name');
        await queryInterface.addColumn('cash_register', 'client_name', {
client_name: {
          type: Sequelize.STRING(255)
        }        });
      }
      if (!existingColumns.includes('ncf')) {
        console.log('   + Adding missing column: cash_register.ncf');
        await queryInterface.addColumn('cash_register', 'ncf', {
ncf: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('description')) {
        console.log('   + Adding missing column: cash_register.description');
        await queryInterface.addColumn('cash_register', 'description', {
description: {
          type: Sequelize.TEXT,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('balance')) {
        console.log('   + Adding missing column: cash_register.balance');
        await queryInterface.addColumn('cash_register', 'balance', {
balance: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('cash_register_id')) {
        console.log('   + Adding missing column: cash_register.cash_register_id');
        await queryInterface.addColumn('cash_register', 'cash_register_id', {
cash_register_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('bank_account_id')) {
        console.log('   + Adding missing column: cash_register.bank_account_id');
        await queryInterface.addColumn('cash_register', 'bank_account_id', {
bank_account_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('cheque_number')) {
        console.log('   + Adding missing column: cash_register.cheque_number');
        await queryInterface.addColumn('cash_register', 'cheque_number', {
cheque_number: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('receipt_number')) {
        console.log('   + Adding missing column: cash_register.receipt_number');
        await queryInterface.addColumn('cash_register', 'receipt_number', {
receipt_number: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('customer_id')) {
        console.log('   + Adding missing column: cash_register.customer_id');
        await queryInterface.addColumn('cash_register', 'customer_id', {
customer_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('invoice_ids')) {
        console.log('   + Adding missing column: cash_register.invoice_ids');
        await queryInterface.addColumn('cash_register', 'invoice_ids', {
invoice_ids: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('investment_agreement_id')) {
        console.log('   + Adding missing column: cash_register.investment_agreement_id');
        await queryInterface.addColumn('cash_register', 'investment_agreement_id', {
investment_agreement_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('deletion_status')) {
        console.log('   + Adding missing column: cash_register.deletion_status');
        await queryInterface.addColumn('cash_register', 'deletion_status', {
deletion_status: {
          type: Sequelize.STRING,
          defaultValue: 'NONE'
        }        });
      }
      if (!existingColumns.includes('deleted_at')) {
        console.log('   + Adding missing column: cash_register.deleted_at');
        await queryInterface.addColumn('cash_register', 'deleted_at', {
deleted_at: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('deleted_by')) {
        console.log('   + Adding missing column: cash_register.deleted_by');
        await queryInterface.addColumn('cash_register', 'deleted_by', {
deleted_by: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('deletion_reason_code')) {
        console.log('   + Adding missing column: cash_register.deletion_reason_code');
        await queryInterface.addColumn('cash_register', 'deletion_reason_code', {
deletion_reason_code: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('deletion_memo')) {
        console.log('   + Adding missing column: cash_register.deletion_memo');
        await queryInterface.addColumn('cash_register', 'deletion_memo', {
deletion_memo: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('deletion_approval_id')) {
        console.log('   + Adding missing column: cash_register.deletion_approval_id');
        await queryInterface.addColumn('cash_register', 'deletion_approval_id', {
deletion_approval_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('reversal_transaction_id')) {
        console.log('   + Adding missing column: cash_register.reversal_transaction_id');
        await queryInterface.addColumn('cash_register', 'reversal_transaction_id', {
reversal_transaction_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('is_reversal')) {
        console.log('   + Adding missing column: cash_register.is_reversal');
        await queryInterface.addColumn('cash_register', 'is_reversal', {
is_reversal: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        }        });
      }
      if (!existingColumns.includes('original_transaction_id')) {
        console.log('   + Adding missing column: cash_register.original_transaction_id');
        await queryInterface.addColumn('cash_register', 'original_transaction_id', {
original_transaction_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: cash_register.created_at');
        await queryInterface.addColumn('cash_register', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: cash_register.updated_at');
        await queryInterface.addColumn('cash_register', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('sales_date')) {
        console.log('   + Adding missing column: cash_register.sales_date');
        await queryInterface.addColumn('cash_register', 'sales_date', {
sales_date: {
          type: Sequelize.DATEONLY
        }        });
      }
      if (!existingColumns.includes('deposit_date')) {
        console.log('   + Adding missing column: cash_register.deposit_date');
        await queryInterface.addColumn('cash_register', 'deposit_date', {
deposit_date: {
          type: Sequelize.DATEONLY
        }        });
      }
      if (!existingColumns.includes('deposit_reference_date')) {
        console.log('   + Adding missing column: cash_register.deposit_reference_date');
        await queryInterface.addColumn('cash_register', 'deposit_reference_date', {
deposit_reference_date: {
          type: Sequelize.DATEONLY
        }        });
      }
      if (!existingColumns.includes('is_previous_day_deposit')) {
        console.log('   + Adding missing column: cash_register.is_previous_day_deposit');
        await queryInterface.addColumn('cash_register', 'is_previous_day_deposit', {
is_previous_day_deposit: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        }        });
      }
      if (!existingColumns.includes('deposit_time')) {
        console.log('   + Adding missing column: cash_register.deposit_time');
        await queryInterface.addColumn('cash_register', 'deposit_time', {
deposit_time: {
          type: Sequelize.TIME
        }        });
      }
      if (!existingColumns.includes('deposited_by')) {
        console.log('   + Adding missing column: cash_register.deposited_by');
        await queryInterface.addColumn('cash_register', 'deposited_by', {
deposited_by: {
          type: Sequelize.STRING(255)
        }        });
      }
      if (!existingColumns.includes('deposit_reference_number')) {
        console.log('   + Adding missing column: cash_register.deposit_reference_number');
        await queryInterface.addColumn('cash_register', 'deposit_reference_number', {
deposit_reference_number: {
          type: Sequelize.STRING(100)
        }        });
      }
      if (!existingColumns.includes('store_code')) {
        console.log('   + Adding missing column: cash_register.store_code');
        await queryInterface.addColumn('cash_register', 'store_code', {
store_code: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('store_name')) {
        console.log('   + Adding missing column: cash_register.store_name');
        await queryInterface.addColumn('cash_register', 'store_name', {
store_name: {
          type: Sequelize.STRING(255)
        }        });
      }
      if (!existingColumns.includes('store_location')) {
        console.log('   + Adding missing column: cash_register.store_location');
        await queryInterface.addColumn('cash_register', 'store_location', {
store_location: {
          type: Sequelize.STRING(255)
        }        });
      }
      if (!existingColumns.includes('opening_balance')) {
        console.log('   + Adding missing column: cash_register.opening_balance');
        await queryInterface.addColumn('cash_register', 'opening_balance', {
opening_balance: {
          type: Sequelize.DECIMAL(15, 2)
        }        });
      }
      if (!existingColumns.includes('closing_balance')) {
        console.log('   + Adding missing column: cash_register.closing_balance');
        await queryInterface.addColumn('cash_register', 'closing_balance', {
closing_balance: {
          type: Sequelize.DECIMAL(15, 2)
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: cash_register_masters
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('cash_register_masters')) {
      console.log('   📋 Creating table: cash_register_masters');
      await queryInterface.createTable('cash_register_masters', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        code: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        name: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        location: {
          type: Sequelize.STRING(255)
        },
        balance: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'ACTIVE'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: cash_register_masters');
    } else {
      console.log('   ✓ Table exists: cash_register_masters - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('cash_register_masters');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: cash_register_masters.id');
        await queryInterface.addColumn('cash_register_masters', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('code')) {
        console.log('   + Adding missing column: cash_register_masters.code');
        await queryInterface.addColumn('cash_register_masters', 'code', {
code: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('name')) {
        console.log('   + Adding missing column: cash_register_masters.name');
        await queryInterface.addColumn('cash_register_masters', 'name', {
name: {
          type: Sequelize.STRING(255),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('location')) {
        console.log('   + Adding missing column: cash_register_masters.location');
        await queryInterface.addColumn('cash_register_masters', 'location', {
location: {
          type: Sequelize.STRING(255)
        }        });
      }
      if (!existingColumns.includes('balance')) {
        console.log('   + Adding missing column: cash_register_masters.balance');
        await queryInterface.addColumn('cash_register_masters', 'balance', {
balance: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('status')) {
        console.log('   + Adding missing column: cash_register_masters.status');
        await queryInterface.addColumn('cash_register_masters', 'status', {
status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'ACTIVE'
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: cash_register_masters.created_at');
        await queryInterface.addColumn('cash_register_masters', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: cash_register_masters.updated_at');
        await queryInterface.addColumn('cash_register_masters', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: chart_of_accounts
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('chart_of_accounts')) {
      console.log('   📋 Creating table: chart_of_accounts');
      await queryInterface.createTable('chart_of_accounts', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        account_code: {
          type: Sequelize.STRING(20),
          allowNull: false
        },
        account_name: {
          type: Sequelize.STRING(200),
          allowNull: false
        },
        account_type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        account_sub_type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        parent_account_id: {
          type: Sequelize.INTEGER
        },
        level: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        is_system_account: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        normal_balance: {
          type: Sequelize.STRING,
          allowNull: false
        },
        description: {
          type: Sequelize.TEXT
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: chart_of_accounts');
    } else {
      console.log('   ✓ Table exists: chart_of_accounts - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('chart_of_accounts');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: chart_of_accounts.id');
        await queryInterface.addColumn('chart_of_accounts', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('account_code')) {
        console.log('   + Adding missing column: chart_of_accounts.account_code');
        await queryInterface.addColumn('chart_of_accounts', 'account_code', {
account_code: {
          type: Sequelize.STRING(20),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('account_name')) {
        console.log('   + Adding missing column: chart_of_accounts.account_name');
        await queryInterface.addColumn('chart_of_accounts', 'account_name', {
account_name: {
          type: Sequelize.STRING(200),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('account_type')) {
        console.log('   + Adding missing column: chart_of_accounts.account_type');
        await queryInterface.addColumn('chart_of_accounts', 'account_type', {
account_type: {
          type: Sequelize.STRING,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('account_sub_type')) {
        console.log('   + Adding missing column: chart_of_accounts.account_sub_type');
        await queryInterface.addColumn('chart_of_accounts', 'account_sub_type', {
account_sub_type: {
          type: Sequelize.STRING,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('parent_account_id')) {
        console.log('   + Adding missing column: chart_of_accounts.parent_account_id');
        await queryInterface.addColumn('chart_of_accounts', 'parent_account_id', {
parent_account_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('level')) {
        console.log('   + Adding missing column: chart_of_accounts.level');
        await queryInterface.addColumn('chart_of_accounts', 'level', {
level: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1
        }        });
      }
      if (!existingColumns.includes('is_active')) {
        console.log('   + Adding missing column: chart_of_accounts.is_active');
        await queryInterface.addColumn('chart_of_accounts', 'is_active', {
is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        }        });
      }
      if (!existingColumns.includes('is_system_account')) {
        console.log('   + Adding missing column: chart_of_accounts.is_system_account');
        await queryInterface.addColumn('chart_of_accounts', 'is_system_account', {
is_system_account: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        }        });
      }
      if (!existingColumns.includes('normal_balance')) {
        console.log('   + Adding missing column: chart_of_accounts.normal_balance');
        await queryInterface.addColumn('chart_of_accounts', 'normal_balance', {
normal_balance: {
          type: Sequelize.STRING,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('description')) {
        console.log('   + Adding missing column: chart_of_accounts.description');
        await queryInterface.addColumn('chart_of_accounts', 'description', {
description: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: chart_of_accounts.created_at');
        await queryInterface.addColumn('chart_of_accounts', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: chart_of_accounts.updated_at');
        await queryInterface.addColumn('chart_of_accounts', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: client_credits
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('client_credits')) {
      console.log('   📋 Creating table: client_credits');
      await queryInterface.createTable('client_credits', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        client_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        client_rnc: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        client_name: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        payment_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        credit_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        used_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        },
        remaining_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        registration_date: {
          type: Sequelize.DATE,
          allowNull: false
        },
        status: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'Active'
        },
        notes: {
          type: Sequelize.TEXT
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: client_credits');
    } else {
      console.log('   ✓ Table exists: client_credits - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('client_credits');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: client_credits.id');
        await queryInterface.addColumn('client_credits', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('client_id')) {
        console.log('   + Adding missing column: client_credits.client_id');
        await queryInterface.addColumn('client_credits', 'client_id', {
client_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('client_rnc')) {
        console.log('   + Adding missing column: client_credits.client_rnc');
        await queryInterface.addColumn('client_credits', 'client_rnc', {
client_rnc: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('client_name')) {
        console.log('   + Adding missing column: client_credits.client_name');
        await queryInterface.addColumn('client_credits', 'client_name', {
client_name: {
          type: Sequelize.STRING(255),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('payment_id')) {
        console.log('   + Adding missing column: client_credits.payment_id');
        await queryInterface.addColumn('client_credits', 'payment_id', {
payment_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('credit_amount')) {
        console.log('   + Adding missing column: client_credits.credit_amount');
        await queryInterface.addColumn('client_credits', 'credit_amount', {
credit_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('used_amount')) {
        console.log('   + Adding missing column: client_credits.used_amount');
        await queryInterface.addColumn('client_credits', 'used_amount', {
used_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('remaining_amount')) {
        console.log('   + Adding missing column: client_credits.remaining_amount');
        await queryInterface.addColumn('client_credits', 'remaining_amount', {
remaining_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('registration_date')) {
        console.log('   + Adding missing column: client_credits.registration_date');
        await queryInterface.addColumn('client_credits', 'registration_date', {
registration_date: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('status')) {
        console.log('   + Adding missing column: client_credits.status');
        await queryInterface.addColumn('client_credits', 'status', {
status: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'Active'
        }        });
      }
      if (!existingColumns.includes('notes')) {
        console.log('   + Adding missing column: client_credits.notes');
        await queryInterface.addColumn('client_credits', 'notes', {
notes: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: client_credits.created_at');
        await queryInterface.addColumn('client_credits', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: client_credits.updated_at');
        await queryInterface.addColumn('client_credits', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: client_payment_methods
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('client_payment_methods')) {
      console.log('   📋 Creating table: client_payment_methods');
      await queryInterface.createTable('client_payment_methods', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        client_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        payment_type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        card_payment_network_id: {
          type: Sequelize.INTEGER
        },
        bank_account_id: {
          type: Sequelize.INTEGER
        },
        card_holder_name: {
          type: Sequelize.STRING(200)
        },
        card_number: {
          type: Sequelize.STRING(255)
        },
        card_last4: {
          type: Sequelize.STRING(4)
        },
        expiry_month: {
          type: Sequelize.INTEGER
        },
        expiry_year: {
          type: Sequelize.INTEGER
        },
        credit_limit: {
          type: Sequelize.DECIMAL,
          defaultValue: 0
        },
        used_credit: {
          type: Sequelize.DECIMAL,
          defaultValue: 0
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        is_default: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        notes: {
          type: Sequelize.TEXT
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: client_payment_methods');
    } else {
      console.log('   ✓ Table exists: client_payment_methods - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('client_payment_methods');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: client_payment_methods.id');
        await queryInterface.addColumn('client_payment_methods', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('client_id')) {
        console.log('   + Adding missing column: client_payment_methods.client_id');
        await queryInterface.addColumn('client_payment_methods', 'client_id', {
client_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('payment_type')) {
        console.log('   + Adding missing column: client_payment_methods.payment_type');
        await queryInterface.addColumn('client_payment_methods', 'payment_type', {
payment_type: {
          type: Sequelize.STRING,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('card_payment_network_id')) {
        console.log('   + Adding missing column: client_payment_methods.card_payment_network_id');
        await queryInterface.addColumn('client_payment_methods', 'card_payment_network_id', {
card_payment_network_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('bank_account_id')) {
        console.log('   + Adding missing column: client_payment_methods.bank_account_id');
        await queryInterface.addColumn('client_payment_methods', 'bank_account_id', {
bank_account_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('card_holder_name')) {
        console.log('   + Adding missing column: client_payment_methods.card_holder_name');
        await queryInterface.addColumn('client_payment_methods', 'card_holder_name', {
card_holder_name: {
          type: Sequelize.STRING(200)
        }        });
      }
      if (!existingColumns.includes('card_number')) {
        console.log('   + Adding missing column: client_payment_methods.card_number');
        await queryInterface.addColumn('client_payment_methods', 'card_number', {
card_number: {
          type: Sequelize.STRING(255)
        }        });
      }
      if (!existingColumns.includes('card_last4')) {
        console.log('   + Adding missing column: client_payment_methods.card_last4');
        await queryInterface.addColumn('client_payment_methods', 'card_last4', {
card_last4: {
          type: Sequelize.STRING(4)
        }        });
      }
      if (!existingColumns.includes('expiry_month')) {
        console.log('   + Adding missing column: client_payment_methods.expiry_month');
        await queryInterface.addColumn('client_payment_methods', 'expiry_month', {
expiry_month: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('expiry_year')) {
        console.log('   + Adding missing column: client_payment_methods.expiry_year');
        await queryInterface.addColumn('client_payment_methods', 'expiry_year', {
expiry_year: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('credit_limit')) {
        console.log('   + Adding missing column: client_payment_methods.credit_limit');
        await queryInterface.addColumn('client_payment_methods', 'credit_limit', {
credit_limit: {
          type: Sequelize.DECIMAL,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('used_credit')) {
        console.log('   + Adding missing column: client_payment_methods.used_credit');
        await queryInterface.addColumn('client_payment_methods', 'used_credit', {
used_credit: {
          type: Sequelize.DECIMAL,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('is_active')) {
        console.log('   + Adding missing column: client_payment_methods.is_active');
        await queryInterface.addColumn('client_payment_methods', 'is_active', {
is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        }        });
      }
      if (!existingColumns.includes('is_default')) {
        console.log('   + Adding missing column: client_payment_methods.is_default');
        await queryInterface.addColumn('client_payment_methods', 'is_default', {
is_default: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        }        });
      }
      if (!existingColumns.includes('notes')) {
        console.log('   + Adding missing column: client_payment_methods.notes');
        await queryInterface.addColumn('client_payment_methods', 'notes', {
notes: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: client_payment_methods.created_at');
        await queryInterface.addColumn('client_payment_methods', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: client_payment_methods.updated_at');
        await queryInterface.addColumn('client_payment_methods', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: clients
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('clients')) {
      console.log('   📋 Creating table: clients');
      await queryInterface.createTable('clients', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        code: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        name: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        rnc_cedula: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        phone: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        email: {
          type: Sequelize.STRING(255)
        },
        address: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        client_type: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'RETAIL'
        },
        credit_limit: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        },
        payment_terms: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'CASH'
        },
        current_balance: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        },
        status: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'ACTIVE'
        },
        contact_person: {
          type: Sequelize.STRING(255)
        },
        notes: {
          type: Sequelize.TEXT
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: clients');
    } else {
      console.log('   ✓ Table exists: clients - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('clients');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: clients.id');
        await queryInterface.addColumn('clients', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('code')) {
        console.log('   + Adding missing column: clients.code');
        await queryInterface.addColumn('clients', 'code', {
code: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('name')) {
        console.log('   + Adding missing column: clients.name');
        await queryInterface.addColumn('clients', 'name', {
name: {
          type: Sequelize.STRING(255),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('rnc_cedula')) {
        console.log('   + Adding missing column: clients.rnc_cedula');
        await queryInterface.addColumn('clients', 'rnc_cedula', {
rnc_cedula: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('phone')) {
        console.log('   + Adding missing column: clients.phone');
        await queryInterface.addColumn('clients', 'phone', {
phone: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('email')) {
        console.log('   + Adding missing column: clients.email');
        await queryInterface.addColumn('clients', 'email', {
email: {
          type: Sequelize.STRING(255)
        }        });
      }
      if (!existingColumns.includes('address')) {
        console.log('   + Adding missing column: clients.address');
        await queryInterface.addColumn('clients', 'address', {
address: {
          type: Sequelize.TEXT,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('client_type')) {
        console.log('   + Adding missing column: clients.client_type');
        await queryInterface.addColumn('clients', 'client_type', {
client_type: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'RETAIL'
        }        });
      }
      if (!existingColumns.includes('credit_limit')) {
        console.log('   + Adding missing column: clients.credit_limit');
        await queryInterface.addColumn('clients', 'credit_limit', {
credit_limit: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('payment_terms')) {
        console.log('   + Adding missing column: clients.payment_terms');
        await queryInterface.addColumn('clients', 'payment_terms', {
payment_terms: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'CASH'
        }        });
      }
      if (!existingColumns.includes('current_balance')) {
        console.log('   + Adding missing column: clients.current_balance');
        await queryInterface.addColumn('clients', 'current_balance', {
current_balance: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('status')) {
        console.log('   + Adding missing column: clients.status');
        await queryInterface.addColumn('clients', 'status', {
status: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'ACTIVE'
        }        });
      }
      if (!existingColumns.includes('contact_person')) {
        console.log('   + Adding missing column: clients.contact_person');
        await queryInterface.addColumn('clients', 'contact_person', {
contact_person: {
          type: Sequelize.STRING(255)
        }        });
      }
      if (!existingColumns.includes('notes')) {
        console.log('   + Adding missing column: clients.notes');
        await queryInterface.addColumn('clients', 'notes', {
notes: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: clients.created_at');
        await queryInterface.addColumn('clients', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: clients.updated_at');
        await queryInterface.addColumn('clients', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: credit_balances
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('credit_balances')) {
      console.log('   📋 Creating table: credit_balances');
      await queryInterface.createTable('credit_balances', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        registration_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        registration_date: {
          type: Sequelize.DATE,
          allowNull: false
        },
        type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        related_entity_type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        related_entity_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        related_entity_name: {
          type: Sequelize.STRING(200),
          allowNull: false
        },
        original_transaction_type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        original_transaction_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        original_transaction_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        credit_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        used_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        },
        available_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'ACTIVE'
        },
        expiry_date: {
          type: Sequelize.DATE
        },
        notes: {
          type: Sequelize.TEXT
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: credit_balances');
    } else {
      console.log('   ✓ Table exists: credit_balances - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('credit_balances');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: credit_balances.id');
        await queryInterface.addColumn('credit_balances', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('registration_number')) {
        console.log('   + Adding missing column: credit_balances.registration_number');
        await queryInterface.addColumn('credit_balances', 'registration_number', {
registration_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('registration_date')) {
        console.log('   + Adding missing column: credit_balances.registration_date');
        await queryInterface.addColumn('credit_balances', 'registration_date', {
registration_date: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('type')) {
        console.log('   + Adding missing column: credit_balances.type');
        await queryInterface.addColumn('credit_balances', 'type', {
type: {
          type: Sequelize.STRING,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('related_entity_type')) {
        console.log('   + Adding missing column: credit_balances.related_entity_type');
        await queryInterface.addColumn('credit_balances', 'related_entity_type', {
related_entity_type: {
          type: Sequelize.STRING,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('related_entity_id')) {
        console.log('   + Adding missing column: credit_balances.related_entity_id');
        await queryInterface.addColumn('credit_balances', 'related_entity_id', {
related_entity_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('related_entity_name')) {
        console.log('   + Adding missing column: credit_balances.related_entity_name');
        await queryInterface.addColumn('credit_balances', 'related_entity_name', {
related_entity_name: {
          type: Sequelize.STRING(200),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('original_transaction_type')) {
        console.log('   + Adding missing column: credit_balances.original_transaction_type');
        await queryInterface.addColumn('credit_balances', 'original_transaction_type', {
original_transaction_type: {
          type: Sequelize.STRING,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('original_transaction_id')) {
        console.log('   + Adding missing column: credit_balances.original_transaction_id');
        await queryInterface.addColumn('credit_balances', 'original_transaction_id', {
original_transaction_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('original_transaction_number')) {
        console.log('   + Adding missing column: credit_balances.original_transaction_number');
        await queryInterface.addColumn('credit_balances', 'original_transaction_number', {
original_transaction_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('credit_amount')) {
        console.log('   + Adding missing column: credit_balances.credit_amount');
        await queryInterface.addColumn('credit_balances', 'credit_amount', {
credit_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('used_amount')) {
        console.log('   + Adding missing column: credit_balances.used_amount');
        await queryInterface.addColumn('credit_balances', 'used_amount', {
used_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('available_amount')) {
        console.log('   + Adding missing column: credit_balances.available_amount');
        await queryInterface.addColumn('credit_balances', 'available_amount', {
available_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('status')) {
        console.log('   + Adding missing column: credit_balances.status');
        await queryInterface.addColumn('credit_balances', 'status', {
status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'ACTIVE'
        }        });
      }
      if (!existingColumns.includes('expiry_date')) {
        console.log('   + Adding missing column: credit_balances.expiry_date');
        await queryInterface.addColumn('credit_balances', 'expiry_date', {
expiry_date: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('notes')) {
        console.log('   + Adding missing column: credit_balances.notes');
        await queryInterface.addColumn('credit_balances', 'notes', {
notes: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: credit_balances.created_at');
        await queryInterface.addColumn('credit_balances', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: credit_balances.updated_at');
        await queryInterface.addColumn('credit_balances', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: expense_categories
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('expense_categories')) {
      console.log('   📋 Creating table: expense_categories');
      await queryInterface.createTable('expense_categories', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        name: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        code: {
          type: Sequelize.STRING(10),
          allowNull: false
        },
        description: {
          type: Sequelize.TEXT
        },
        parent_category_id: {
          type: Sequelize.INTEGER
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        sort_order: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        created_by_user_id: {
          type: Sequelize.INTEGER
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: expense_categories');
    } else {
      console.log('   ✓ Table exists: expense_categories - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('expense_categories');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: expense_categories.id');
        await queryInterface.addColumn('expense_categories', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('name')) {
        console.log('   + Adding missing column: expense_categories.name');
        await queryInterface.addColumn('expense_categories', 'name', {
name: {
          type: Sequelize.STRING(100),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('code')) {
        console.log('   + Adding missing column: expense_categories.code');
        await queryInterface.addColumn('expense_categories', 'code', {
code: {
          type: Sequelize.STRING(10),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('description')) {
        console.log('   + Adding missing column: expense_categories.description');
        await queryInterface.addColumn('expense_categories', 'description', {
description: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('parent_category_id')) {
        console.log('   + Adding missing column: expense_categories.parent_category_id');
        await queryInterface.addColumn('expense_categories', 'parent_category_id', {
parent_category_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('is_active')) {
        console.log('   + Adding missing column: expense_categories.is_active');
        await queryInterface.addColumn('expense_categories', 'is_active', {
is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        }        });
      }
      if (!existingColumns.includes('sort_order')) {
        console.log('   + Adding missing column: expense_categories.sort_order');
        await queryInterface.addColumn('expense_categories', 'sort_order', {
sort_order: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('created_by_user_id')) {
        console.log('   + Adding missing column: expense_categories.created_by_user_id');
        await queryInterface.addColumn('expense_categories', 'created_by_user_id', {
created_by_user_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: expense_categories.created_at');
        await queryInterface.addColumn('expense_categories', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: expense_categories.updated_at');
        await queryInterface.addColumn('expense_categories', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: expense_types
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('expense_types')) {
      console.log('   📋 Creating table: expense_types');
      await queryInterface.createTable('expense_types', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        category_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        name: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        code: {
          type: Sequelize.STRING(15),
          allowNull: false
        },
        description: {
          type: Sequelize.TEXT
        },
        default_account_code: {
          type: Sequelize.STRING(20)
        },
        requires_approval: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        approval_threshold: {
          type: Sequelize.DECIMAL
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        sort_order: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        created_by_user_id: {
          type: Sequelize.INTEGER
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: expense_types');
    } else {
      console.log('   ✓ Table exists: expense_types - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('expense_types');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: expense_types.id');
        await queryInterface.addColumn('expense_types', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('category_id')) {
        console.log('   + Adding missing column: expense_types.category_id');
        await queryInterface.addColumn('expense_types', 'category_id', {
category_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('name')) {
        console.log('   + Adding missing column: expense_types.name');
        await queryInterface.addColumn('expense_types', 'name', {
name: {
          type: Sequelize.STRING(100),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('code')) {
        console.log('   + Adding missing column: expense_types.code');
        await queryInterface.addColumn('expense_types', 'code', {
code: {
          type: Sequelize.STRING(15),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('description')) {
        console.log('   + Adding missing column: expense_types.description');
        await queryInterface.addColumn('expense_types', 'description', {
description: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('default_account_code')) {
        console.log('   + Adding missing column: expense_types.default_account_code');
        await queryInterface.addColumn('expense_types', 'default_account_code', {
default_account_code: {
          type: Sequelize.STRING(20)
        }        });
      }
      if (!existingColumns.includes('requires_approval')) {
        console.log('   + Adding missing column: expense_types.requires_approval');
        await queryInterface.addColumn('expense_types', 'requires_approval', {
requires_approval: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        }        });
      }
      if (!existingColumns.includes('approval_threshold')) {
        console.log('   + Adding missing column: expense_types.approval_threshold');
        await queryInterface.addColumn('expense_types', 'approval_threshold', {
approval_threshold: {
          type: Sequelize.DECIMAL
        }        });
      }
      if (!existingColumns.includes('is_active')) {
        console.log('   + Adding missing column: expense_types.is_active');
        await queryInterface.addColumn('expense_types', 'is_active', {
is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        }        });
      }
      if (!existingColumns.includes('sort_order')) {
        console.log('   + Adding missing column: expense_types.sort_order');
        await queryInterface.addColumn('expense_types', 'sort_order', {
sort_order: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('created_by_user_id')) {
        console.log('   + Adding missing column: expense_types.created_by_user_id');
        await queryInterface.addColumn('expense_types', 'created_by_user_id', {
created_by_user_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: expense_types.created_at');
        await queryInterface.addColumn('expense_types', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: expense_types.updated_at');
        await queryInterface.addColumn('expense_types', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: financers
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('financers')) {
      console.log('   📋 Creating table: financers');
      await queryInterface.createTable('financers', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        code: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        name: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        contact_person: {
          type: Sequelize.STRING(255)
        },
        phone: {
          type: Sequelize.STRING(50)
        },
        email: {
          type: Sequelize.STRING(255)
        },
        address: {
          type: Sequelize.TEXT
        },
        rnc: {
          type: Sequelize.STRING(50)
        },
        type: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'OTHER'
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'ACTIVE'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: financers');
    } else {
      console.log('   ✓ Table exists: financers - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('financers');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: financers.id');
        await queryInterface.addColumn('financers', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('code')) {
        console.log('   + Adding missing column: financers.code');
        await queryInterface.addColumn('financers', 'code', {
code: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('name')) {
        console.log('   + Adding missing column: financers.name');
        await queryInterface.addColumn('financers', 'name', {
name: {
          type: Sequelize.STRING(255),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('contact_person')) {
        console.log('   + Adding missing column: financers.contact_person');
        await queryInterface.addColumn('financers', 'contact_person', {
contact_person: {
          type: Sequelize.STRING(255)
        }        });
      }
      if (!existingColumns.includes('phone')) {
        console.log('   + Adding missing column: financers.phone');
        await queryInterface.addColumn('financers', 'phone', {
phone: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('email')) {
        console.log('   + Adding missing column: financers.email');
        await queryInterface.addColumn('financers', 'email', {
email: {
          type: Sequelize.STRING(255)
        }        });
      }
      if (!existingColumns.includes('address')) {
        console.log('   + Adding missing column: financers.address');
        await queryInterface.addColumn('financers', 'address', {
address: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('rnc')) {
        console.log('   + Adding missing column: financers.rnc');
        await queryInterface.addColumn('financers', 'rnc', {
rnc: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('type')) {
        console.log('   + Adding missing column: financers.type');
        await queryInterface.addColumn('financers', 'type', {
type: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'OTHER'
        }        });
      }
      if (!existingColumns.includes('status')) {
        console.log('   + Adding missing column: financers.status');
        await queryInterface.addColumn('financers', 'status', {
status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'ACTIVE'
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: financers.created_at');
        await queryInterface.addColumn('financers', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: financers.updated_at');
        await queryInterface.addColumn('financers', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: fiscal_periods
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('fiscal_periods')) {
      console.log('   📋 Creating table: fiscal_periods');
      await queryInterface.createTable('fiscal_periods', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        period_name: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        period_type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        start_date: {
          type: Sequelize.DATE,
          allowNull: false
        },
        end_date: {
          type: Sequelize.DATE,
          allowNull: false
        },
        fiscal_year: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'OPEN'
        },
        closed_at: {
          type: Sequelize.DATE
        },
        closed_by: {
          type: Sequelize.INTEGER
        },
        reopened_at: {
          type: Sequelize.DATE
        },
        reopened_by: {
          type: Sequelize.INTEGER
        },
        reopen_count: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: fiscal_periods');
    } else {
      console.log('   ✓ Table exists: fiscal_periods - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('fiscal_periods');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: fiscal_periods.id');
        await queryInterface.addColumn('fiscal_periods', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('period_name')) {
        console.log('   + Adding missing column: fiscal_periods.period_name');
        await queryInterface.addColumn('fiscal_periods', 'period_name', {
period_name: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('period_type')) {
        console.log('   + Adding missing column: fiscal_periods.period_type');
        await queryInterface.addColumn('fiscal_periods', 'period_type', {
period_type: {
          type: Sequelize.STRING,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('start_date')) {
        console.log('   + Adding missing column: fiscal_periods.start_date');
        await queryInterface.addColumn('fiscal_periods', 'start_date', {
start_date: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('end_date')) {
        console.log('   + Adding missing column: fiscal_periods.end_date');
        await queryInterface.addColumn('fiscal_periods', 'end_date', {
end_date: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('fiscal_year')) {
        console.log('   + Adding missing column: fiscal_periods.fiscal_year');
        await queryInterface.addColumn('fiscal_periods', 'fiscal_year', {
fiscal_year: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('status')) {
        console.log('   + Adding missing column: fiscal_periods.status');
        await queryInterface.addColumn('fiscal_periods', 'status', {
status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'OPEN'
        }        });
      }
      if (!existingColumns.includes('closed_at')) {
        console.log('   + Adding missing column: fiscal_periods.closed_at');
        await queryInterface.addColumn('fiscal_periods', 'closed_at', {
closed_at: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('closed_by')) {
        console.log('   + Adding missing column: fiscal_periods.closed_by');
        await queryInterface.addColumn('fiscal_periods', 'closed_by', {
closed_by: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('reopened_at')) {
        console.log('   + Adding missing column: fiscal_periods.reopened_at');
        await queryInterface.addColumn('fiscal_periods', 'reopened_at', {
reopened_at: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('reopened_by')) {
        console.log('   + Adding missing column: fiscal_periods.reopened_by');
        await queryInterface.addColumn('fiscal_periods', 'reopened_by', {
reopened_by: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('reopen_count')) {
        console.log('   + Adding missing column: fiscal_periods.reopen_count');
        await queryInterface.addColumn('fiscal_periods', 'reopen_count', {
reopen_count: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: fiscal_periods.created_at');
        await queryInterface.addColumn('fiscal_periods', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: fiscal_periods.updated_at');
        await queryInterface.addColumn('fiscal_periods', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: general_ledger
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('general_ledger')) {
      console.log('   📋 Creating table: general_ledger');
      await queryInterface.createTable('general_ledger', {
        id: {
          type: Sequelize.BIGINT,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        entry_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        entry_date: {
          type: Sequelize.DATE,
          allowNull: false
        },
        account_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        entry_type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        source_module: {
          type: Sequelize.STRING,
          allowNull: false
        },
        source_transaction_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        source_transaction_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        fiscal_period_id: {
          type: Sequelize.INTEGER
        },
        is_posted: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        posted_at: {
          type: Sequelize.DATE
        },
        posted_by: {
          type: Sequelize.INTEGER
        },
        is_reversed: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        reversal_entry_id: {
          type: Sequelize.BIGINT
        },
        original_entry_id: {
          type: Sequelize.BIGINT
        },
        is_opening_balance: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        created_by: {
          type: Sequelize.INTEGER
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: general_ledger');
    } else {
      console.log('   ✓ Table exists: general_ledger - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('general_ledger');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: general_ledger.id');
        await queryInterface.addColumn('general_ledger', 'id', {
id: {
          type: Sequelize.BIGINT,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('entry_number')) {
        console.log('   + Adding missing column: general_ledger.entry_number');
        await queryInterface.addColumn('general_ledger', 'entry_number', {
entry_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('entry_date')) {
        console.log('   + Adding missing column: general_ledger.entry_date');
        await queryInterface.addColumn('general_ledger', 'entry_date', {
entry_date: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('account_id')) {
        console.log('   + Adding missing column: general_ledger.account_id');
        await queryInterface.addColumn('general_ledger', 'account_id', {
account_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('entry_type')) {
        console.log('   + Adding missing column: general_ledger.entry_type');
        await queryInterface.addColumn('general_ledger', 'entry_type', {
entry_type: {
          type: Sequelize.STRING,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('amount')) {
        console.log('   + Adding missing column: general_ledger.amount');
        await queryInterface.addColumn('general_ledger', 'amount', {
amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('source_module')) {
        console.log('   + Adding missing column: general_ledger.source_module');
        await queryInterface.addColumn('general_ledger', 'source_module', {
source_module: {
          type: Sequelize.STRING,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('source_transaction_id')) {
        console.log('   + Adding missing column: general_ledger.source_transaction_id');
        await queryInterface.addColumn('general_ledger', 'source_transaction_id', {
source_transaction_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('source_transaction_number')) {
        console.log('   + Adding missing column: general_ledger.source_transaction_number');
        await queryInterface.addColumn('general_ledger', 'source_transaction_number', {
source_transaction_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('description')) {
        console.log('   + Adding missing column: general_ledger.description');
        await queryInterface.addColumn('general_ledger', 'description', {
description: {
          type: Sequelize.TEXT,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('fiscal_period_id')) {
        console.log('   + Adding missing column: general_ledger.fiscal_period_id');
        await queryInterface.addColumn('general_ledger', 'fiscal_period_id', {
fiscal_period_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('is_posted')) {
        console.log('   + Adding missing column: general_ledger.is_posted');
        await queryInterface.addColumn('general_ledger', 'is_posted', {
is_posted: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        }        });
      }
      if (!existingColumns.includes('posted_at')) {
        console.log('   + Adding missing column: general_ledger.posted_at');
        await queryInterface.addColumn('general_ledger', 'posted_at', {
posted_at: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('posted_by')) {
        console.log('   + Adding missing column: general_ledger.posted_by');
        await queryInterface.addColumn('general_ledger', 'posted_by', {
posted_by: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('is_reversed')) {
        console.log('   + Adding missing column: general_ledger.is_reversed');
        await queryInterface.addColumn('general_ledger', 'is_reversed', {
is_reversed: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        }        });
      }
      if (!existingColumns.includes('reversal_entry_id')) {
        console.log('   + Adding missing column: general_ledger.reversal_entry_id');
        await queryInterface.addColumn('general_ledger', 'reversal_entry_id', {
reversal_entry_id: {
          type: Sequelize.BIGINT
        }        });
      }
      if (!existingColumns.includes('original_entry_id')) {
        console.log('   + Adding missing column: general_ledger.original_entry_id');
        await queryInterface.addColumn('general_ledger', 'original_entry_id', {
original_entry_id: {
          type: Sequelize.BIGINT
        }        });
      }
      if (!existingColumns.includes('is_opening_balance')) {
        console.log('   + Adding missing column: general_ledger.is_opening_balance');
        await queryInterface.addColumn('general_ledger', 'is_opening_balance', {
is_opening_balance: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        }        });
      }
      if (!existingColumns.includes('created_by')) {
        console.log('   + Adding missing column: general_ledger.created_by');
        await queryInterface.addColumn('general_ledger', 'created_by', {
created_by: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: general_ledger.created_at');
        await queryInterface.addColumn('general_ledger', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: general_ledger.updated_at');
        await queryInterface.addColumn('general_ledger', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: investment_agreements
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('investment_agreements')) {
      console.log('   📋 Creating table: investment_agreements');
      await queryInterface.createTable('investment_agreements', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        agreement_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        agreement_date: {
          type: Sequelize.DATE,
          allowNull: false
        },
        investor_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        investor_name: {
          type: Sequelize.STRING(200),
          allowNull: false
        },
        agreement_type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        total_committed_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        received_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        },
        balance_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        interest_rate: {
          type: Sequelize.DECIMAL
        },
        maturity_date: {
          type: Sequelize.DATE
        },
        status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'ACTIVE'
        },
        terms: {
          type: Sequelize.TEXT
        },
        notes: {
          type: Sequelize.TEXT
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: investment_agreements');
    } else {
      console.log('   ✓ Table exists: investment_agreements - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('investment_agreements');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: investment_agreements.id');
        await queryInterface.addColumn('investment_agreements', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('agreement_number')) {
        console.log('   + Adding missing column: investment_agreements.agreement_number');
        await queryInterface.addColumn('investment_agreements', 'agreement_number', {
agreement_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('agreement_date')) {
        console.log('   + Adding missing column: investment_agreements.agreement_date');
        await queryInterface.addColumn('investment_agreements', 'agreement_date', {
agreement_date: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('investor_id')) {
        console.log('   + Adding missing column: investment_agreements.investor_id');
        await queryInterface.addColumn('investment_agreements', 'investor_id', {
investor_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('investor_name')) {
        console.log('   + Adding missing column: investment_agreements.investor_name');
        await queryInterface.addColumn('investment_agreements', 'investor_name', {
investor_name: {
          type: Sequelize.STRING(200),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('agreement_type')) {
        console.log('   + Adding missing column: investment_agreements.agreement_type');
        await queryInterface.addColumn('investment_agreements', 'agreement_type', {
agreement_type: {
          type: Sequelize.STRING,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('total_committed_amount')) {
        console.log('   + Adding missing column: investment_agreements.total_committed_amount');
        await queryInterface.addColumn('investment_agreements', 'total_committed_amount', {
total_committed_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('received_amount')) {
        console.log('   + Adding missing column: investment_agreements.received_amount');
        await queryInterface.addColumn('investment_agreements', 'received_amount', {
received_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('balance_amount')) {
        console.log('   + Adding missing column: investment_agreements.balance_amount');
        await queryInterface.addColumn('investment_agreements', 'balance_amount', {
balance_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('interest_rate')) {
        console.log('   + Adding missing column: investment_agreements.interest_rate');
        await queryInterface.addColumn('investment_agreements', 'interest_rate', {
interest_rate: {
          type: Sequelize.DECIMAL
        }        });
      }
      if (!existingColumns.includes('maturity_date')) {
        console.log('   + Adding missing column: investment_agreements.maturity_date');
        await queryInterface.addColumn('investment_agreements', 'maturity_date', {
maturity_date: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('status')) {
        console.log('   + Adding missing column: investment_agreements.status');
        await queryInterface.addColumn('investment_agreements', 'status', {
status: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'ACTIVE'
        }        });
      }
      if (!existingColumns.includes('terms')) {
        console.log('   + Adding missing column: investment_agreements.terms');
        await queryInterface.addColumn('investment_agreements', 'terms', {
terms: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('notes')) {
        console.log('   + Adding missing column: investment_agreements.notes');
        await queryInterface.addColumn('investment_agreements', 'notes', {
notes: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: investment_agreements.created_at');
        await queryInterface.addColumn('investment_agreements', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: investment_agreements.updated_at');
        await queryInterface.addColumn('investment_agreements', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: payment_invoice_applications
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('payment_invoice_applications')) {
      console.log('   📋 Creating table: payment_invoice_applications');
      await queryInterface.createTable('payment_invoice_applications', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        payment_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        invoice_type: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        invoice_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        invoice_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        applied_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: payment_invoice_applications');
    } else {
      console.log('   ✓ Table exists: payment_invoice_applications - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('payment_invoice_applications');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: payment_invoice_applications.id');
        await queryInterface.addColumn('payment_invoice_applications', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('payment_id')) {
        console.log('   + Adding missing column: payment_invoice_applications.payment_id');
        await queryInterface.addColumn('payment_invoice_applications', 'payment_id', {
payment_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('invoice_type')) {
        console.log('   + Adding missing column: payment_invoice_applications.invoice_type');
        await queryInterface.addColumn('payment_invoice_applications', 'invoice_type', {
invoice_type: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('invoice_id')) {
        console.log('   + Adding missing column: payment_invoice_applications.invoice_id');
        await queryInterface.addColumn('payment_invoice_applications', 'invoice_id', {
invoice_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('invoice_number')) {
        console.log('   + Adding missing column: payment_invoice_applications.invoice_number');
        await queryInterface.addColumn('payment_invoice_applications', 'invoice_number', {
invoice_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('applied_amount')) {
        console.log('   + Adding missing column: payment_invoice_applications.applied_amount');
        await queryInterface.addColumn('payment_invoice_applications', 'applied_amount', {
applied_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: payment_invoice_applications.created_at');
        await queryInterface.addColumn('payment_invoice_applications', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: payment_invoice_applications.updated_at');
        await queryInterface.addColumn('payment_invoice_applications', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: payments
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('payments')) {
      console.log('   📋 Creating table: payments');
      await queryInterface.createTable('payments', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        registration_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        registration_date: {
          type: Sequelize.DATE,
          allowNull: false
        },
        payment_method: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        payment_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        type: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        related_entity_type: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        related_entity_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        supplier_rnc: {
          type: Sequelize.STRING(50)
        },
        supplier_name: {
          type: Sequelize.STRING(255)
        },
        client_rnc: {
          type: Sequelize.STRING(50)
        },
        client_name: {
          type: Sequelize.STRING(255)
        },
        outstanding_credit_invoices: {
          type: Sequelize.TEXT
        },
        outstanding_cash_invoices: {
          type: Sequelize.TEXT
        },
        invoice_applications: {
          type: Sequelize.TEXT
        },
        excess_amount: {
          type: Sequelize.DECIMAL,
          defaultValue: 0
        },
        notes: {
          type: Sequelize.TEXT
        },
        deletion_status: {
          type: Sequelize.STRING,
          defaultValue: 'NONE'
        },
        deleted_at: {
          type: Sequelize.DATE
        },
        deleted_by: {
          type: Sequelize.INTEGER
        },
        deletion_reason_code: {
          type: Sequelize.STRING(50)
        },
        deletion_memo: {
          type: Sequelize.TEXT
        },
        deletion_approval_id: {
          type: Sequelize.INTEGER
        },
        reversal_transaction_id: {
          type: Sequelize.INTEGER
        },
        is_reversal: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        },
        original_transaction_id: {
          type: Sequelize.INTEGER
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: payments');
    } else {
      console.log('   ✓ Table exists: payments - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('payments');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: payments.id');
        await queryInterface.addColumn('payments', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('registration_number')) {
        console.log('   + Adding missing column: payments.registration_number');
        await queryInterface.addColumn('payments', 'registration_number', {
registration_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('registration_date')) {
        console.log('   + Adding missing column: payments.registration_date');
        await queryInterface.addColumn('payments', 'registration_date', {
registration_date: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('payment_method')) {
        console.log('   + Adding missing column: payments.payment_method');
        await queryInterface.addColumn('payments', 'payment_method', {
payment_method: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('payment_amount')) {
        console.log('   + Adding missing column: payments.payment_amount');
        await queryInterface.addColumn('payments', 'payment_amount', {
payment_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('type')) {
        console.log('   + Adding missing column: payments.type');
        await queryInterface.addColumn('payments', 'type', {
type: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('related_entity_type')) {
        console.log('   + Adding missing column: payments.related_entity_type');
        await queryInterface.addColumn('payments', 'related_entity_type', {
related_entity_type: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('related_entity_id')) {
        console.log('   + Adding missing column: payments.related_entity_id');
        await queryInterface.addColumn('payments', 'related_entity_id', {
related_entity_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('supplier_rnc')) {
        console.log('   + Adding missing column: payments.supplier_rnc');
        await queryInterface.addColumn('payments', 'supplier_rnc', {
supplier_rnc: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('supplier_name')) {
        console.log('   + Adding missing column: payments.supplier_name');
        await queryInterface.addColumn('payments', 'supplier_name', {
supplier_name: {
          type: Sequelize.STRING(255)
        }        });
      }
      if (!existingColumns.includes('client_rnc')) {
        console.log('   + Adding missing column: payments.client_rnc');
        await queryInterface.addColumn('payments', 'client_rnc', {
client_rnc: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('client_name')) {
        console.log('   + Adding missing column: payments.client_name');
        await queryInterface.addColumn('payments', 'client_name', {
client_name: {
          type: Sequelize.STRING(255)
        }        });
      }
      if (!existingColumns.includes('outstanding_credit_invoices')) {
        console.log('   + Adding missing column: payments.outstanding_credit_invoices');
        await queryInterface.addColumn('payments', 'outstanding_credit_invoices', {
outstanding_credit_invoices: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('outstanding_cash_invoices')) {
        console.log('   + Adding missing column: payments.outstanding_cash_invoices');
        await queryInterface.addColumn('payments', 'outstanding_cash_invoices', {
outstanding_cash_invoices: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('invoice_applications')) {
        console.log('   + Adding missing column: payments.invoice_applications');
        await queryInterface.addColumn('payments', 'invoice_applications', {
invoice_applications: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('excess_amount')) {
        console.log('   + Adding missing column: payments.excess_amount');
        await queryInterface.addColumn('payments', 'excess_amount', {
excess_amount: {
          type: Sequelize.DECIMAL,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('notes')) {
        console.log('   + Adding missing column: payments.notes');
        await queryInterface.addColumn('payments', 'notes', {
notes: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('deletion_status')) {
        console.log('   + Adding missing column: payments.deletion_status');
        await queryInterface.addColumn('payments', 'deletion_status', {
deletion_status: {
          type: Sequelize.STRING,
          defaultValue: 'NONE'
        }        });
      }
      if (!existingColumns.includes('deleted_at')) {
        console.log('   + Adding missing column: payments.deleted_at');
        await queryInterface.addColumn('payments', 'deleted_at', {
deleted_at: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('deleted_by')) {
        console.log('   + Adding missing column: payments.deleted_by');
        await queryInterface.addColumn('payments', 'deleted_by', {
deleted_by: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('deletion_reason_code')) {
        console.log('   + Adding missing column: payments.deletion_reason_code');
        await queryInterface.addColumn('payments', 'deletion_reason_code', {
deletion_reason_code: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('deletion_memo')) {
        console.log('   + Adding missing column: payments.deletion_memo');
        await queryInterface.addColumn('payments', 'deletion_memo', {
deletion_memo: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('deletion_approval_id')) {
        console.log('   + Adding missing column: payments.deletion_approval_id');
        await queryInterface.addColumn('payments', 'deletion_approval_id', {
deletion_approval_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('reversal_transaction_id')) {
        console.log('   + Adding missing column: payments.reversal_transaction_id');
        await queryInterface.addColumn('payments', 'reversal_transaction_id', {
reversal_transaction_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('is_reversal')) {
        console.log('   + Adding missing column: payments.is_reversal');
        await queryInterface.addColumn('payments', 'is_reversal', {
is_reversal: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        }        });
      }
      if (!existingColumns.includes('original_transaction_id')) {
        console.log('   + Adding missing column: payments.original_transaction_id');
        await queryInterface.addColumn('payments', 'original_transaction_id', {
original_transaction_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: payments.created_at');
        await queryInterface.addColumn('payments', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: payments.updated_at');
        await queryInterface.addColumn('payments', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: product_prices
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('product_prices')) {
      console.log('   📋 Creating table: product_prices');
      await queryInterface.createTable('product_prices', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        product_id: {
          type: Sequelize.INTEGER
        },
        sales_price: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        effective_date: {
          type: Sequelize.DATE,
          allowNull: false
        },
        end_date: {
          type: Sequelize.DATE
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: product_prices');
    } else {
      console.log('   ✓ Table exists: product_prices - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('product_prices');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: product_prices.id');
        await queryInterface.addColumn('product_prices', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('product_id')) {
        console.log('   + Adding missing column: product_prices.product_id');
        await queryInterface.addColumn('product_prices', 'product_id', {
product_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('sales_price')) {
        console.log('   + Adding missing column: product_prices.sales_price');
        await queryInterface.addColumn('product_prices', 'sales_price', {
sales_price: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('effective_date')) {
        console.log('   + Adding missing column: product_prices.effective_date');
        await queryInterface.addColumn('product_prices', 'effective_date', {
effective_date: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('end_date')) {
        console.log('   + Adding missing column: product_prices.end_date');
        await queryInterface.addColumn('product_prices', 'end_date', {
end_date: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('is_active')) {
        console.log('   + Adding missing column: product_prices.is_active');
        await queryInterface.addColumn('product_prices', 'is_active', {
is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: product_prices.created_at');
        await queryInterface.addColumn('product_prices', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: product_prices.updated_at');
        await queryInterface.addColumn('product_prices', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: products
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('products')) {
      console.log('   📋 Creating table: products');
      await queryInterface.createTable('products', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        code: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        name: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        category: {
          type: Sequelize.STRING(100),
          allowNull: false,
          defaultValue: 'General'
        },
        unit: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        amount: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        },
        unit_cost: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        sales_price: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        },
        subtotal: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        supplier_id: {
          type: Sequelize.INTEGER
        },
        minimum_stock: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 10
        },
        tax_rate: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 18
        },
        barcode: {
          type: Sequelize.STRING(100)
        },
        status: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'ACTIVE'
        },
        description: {
          type: Sequelize.TEXT
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: products');
    } else {
      console.log('   ✓ Table exists: products - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('products');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: products.id');
        await queryInterface.addColumn('products', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('code')) {
        console.log('   + Adding missing column: products.code');
        await queryInterface.addColumn('products', 'code', {
code: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('name')) {
        console.log('   + Adding missing column: products.name');
        await queryInterface.addColumn('products', 'name', {
name: {
          type: Sequelize.STRING(255),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('category')) {
        console.log('   + Adding missing column: products.category');
        await queryInterface.addColumn('products', 'category', {
category: {
          type: Sequelize.STRING(100),
          allowNull: false,
          defaultValue: 'General'
        }        });
      }
      if (!existingColumns.includes('unit')) {
        console.log('   + Adding missing column: products.unit');
        await queryInterface.addColumn('products', 'unit', {
unit: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('amount')) {
        console.log('   + Adding missing column: products.amount');
        await queryInterface.addColumn('products', 'amount', {
amount: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('unit_cost')) {
        console.log('   + Adding missing column: products.unit_cost');
        await queryInterface.addColumn('products', 'unit_cost', {
unit_cost: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('sales_price')) {
        console.log('   + Adding missing column: products.sales_price');
        await queryInterface.addColumn('products', 'sales_price', {
sales_price: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('subtotal')) {
        console.log('   + Adding missing column: products.subtotal');
        await queryInterface.addColumn('products', 'subtotal', {
subtotal: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('supplier_id')) {
        console.log('   + Adding missing column: products.supplier_id');
        await queryInterface.addColumn('products', 'supplier_id', {
supplier_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('minimum_stock')) {
        console.log('   + Adding missing column: products.minimum_stock');
        await queryInterface.addColumn('products', 'minimum_stock', {
minimum_stock: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 10
        }        });
      }
      if (!existingColumns.includes('tax_rate')) {
        console.log('   + Adding missing column: products.tax_rate');
        await queryInterface.addColumn('products', 'tax_rate', {
tax_rate: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 18
        }        });
      }
      if (!existingColumns.includes('barcode')) {
        console.log('   + Adding missing column: products.barcode');
        await queryInterface.addColumn('products', 'barcode', {
barcode: {
          type: Sequelize.STRING(100)
        }        });
      }
      if (!existingColumns.includes('status')) {
        console.log('   + Adding missing column: products.status');
        await queryInterface.addColumn('products', 'status', {
status: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'ACTIVE'
        }        });
      }
      if (!existingColumns.includes('description')) {
        console.log('   + Adding missing column: products.description');
        await queryInterface.addColumn('products', 'description', {
description: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: products.created_at');
        await queryInterface.addColumn('products', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: products.updated_at');
        await queryInterface.addColumn('products', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: purchase_items
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('purchase_items')) {
      console.log('   📋 Creating table: purchase_items');
      await queryInterface.createTable('purchase_items', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        purchase_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        product_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        product_code: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        product_name: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        unit_of_measurement: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        quantity: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        unit_cost: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        subtotal: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        tax: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        total: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        adjusted_unit_cost: {
          type: Sequelize.DECIMAL
        },
        adjusted_total: {
          type: Sequelize.DECIMAL
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: purchase_items');
    } else {
      console.log('   ✓ Table exists: purchase_items - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('purchase_items');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: purchase_items.id');
        await queryInterface.addColumn('purchase_items', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('purchase_id')) {
        console.log('   + Adding missing column: purchase_items.purchase_id');
        await queryInterface.addColumn('purchase_items', 'purchase_id', {
purchase_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('product_id')) {
        console.log('   + Adding missing column: purchase_items.product_id');
        await queryInterface.addColumn('purchase_items', 'product_id', {
product_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('product_code')) {
        console.log('   + Adding missing column: purchase_items.product_code');
        await queryInterface.addColumn('purchase_items', 'product_code', {
product_code: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('product_name')) {
        console.log('   + Adding missing column: purchase_items.product_name');
        await queryInterface.addColumn('purchase_items', 'product_name', {
product_name: {
          type: Sequelize.STRING(255),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('unit_of_measurement')) {
        console.log('   + Adding missing column: purchase_items.unit_of_measurement');
        await queryInterface.addColumn('purchase_items', 'unit_of_measurement', {
unit_of_measurement: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('quantity')) {
        console.log('   + Adding missing column: purchase_items.quantity');
        await queryInterface.addColumn('purchase_items', 'quantity', {
quantity: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('unit_cost')) {
        console.log('   + Adding missing column: purchase_items.unit_cost');
        await queryInterface.addColumn('purchase_items', 'unit_cost', {
unit_cost: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('subtotal')) {
        console.log('   + Adding missing column: purchase_items.subtotal');
        await queryInterface.addColumn('purchase_items', 'subtotal', {
subtotal: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('tax')) {
        console.log('   + Adding missing column: purchase_items.tax');
        await queryInterface.addColumn('purchase_items', 'tax', {
tax: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('total')) {
        console.log('   + Adding missing column: purchase_items.total');
        await queryInterface.addColumn('purchase_items', 'total', {
total: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('adjusted_unit_cost')) {
        console.log('   + Adding missing column: purchase_items.adjusted_unit_cost');
        await queryInterface.addColumn('purchase_items', 'adjusted_unit_cost', {
adjusted_unit_cost: {
          type: Sequelize.DECIMAL
        }        });
      }
      if (!existingColumns.includes('adjusted_total')) {
        console.log('   + Adding missing column: purchase_items.adjusted_total');
        await queryInterface.addColumn('purchase_items', 'adjusted_total', {
adjusted_total: {
          type: Sequelize.DECIMAL
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: purchase_items.created_at');
        await queryInterface.addColumn('purchase_items', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: purchase_items.updated_at');
        await queryInterface.addColumn('purchase_items', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: purchases
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('purchases')) {
      console.log('   📋 Creating table: purchases');
      await queryInterface.createTable('purchases', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        registration_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        registration_date: {
          type: Sequelize.DATE,
          allowNull: false
        },
        date: {
          type: Sequelize.DATE,
          allowNull: false
        },
        supplier_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        supplier_rnc: {
          type: Sequelize.STRING(50)
        },
        ncf: {
          type: Sequelize.STRING(50)
        },
        purchase_type: {
          type: Sequelize.STRING(100),
          allowNull: false,
          defaultValue: 'Merchandise for sale or consumption'
        },
        payment_type: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        payment_status: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'Unpaid'
        },
        product_total: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        additional_expenses: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        },
        total: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        paid_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        },
        balance_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        },
        total_with_associated: {
          type: Sequelize.DECIMAL
        },
        status: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        bank_account_id: {
          type: Sequelize.INTEGER
        },
        card_id: {
          type: Sequelize.INTEGER
        },
        cheque_number: {
          type: Sequelize.STRING(100)
        },
        cheque_date: {
          type: Sequelize.DATE
        },
        transfer_number: {
          type: Sequelize.STRING(100)
        },
        transfer_date: {
          type: Sequelize.DATE
        },
        payment_reference: {
          type: Sequelize.STRING(100)
        },
        voucher_date: {
          type: Sequelize.DATE
        },
        transaction_type: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'GOODS'
        },
        request_id: {
          type: Sequelize.UUID
        },
        client_session_id: {
          type: Sequelize.STRING(100)
        },
        submission_timestamp: {
          type: Sequelize.DATE
        },
        deletion_status: {
          type: Sequelize.STRING,
          defaultValue: 'NONE'
        },
        deleted_at: {
          type: Sequelize.DATE
        },
        deleted_by: {
          type: Sequelize.INTEGER
        },
        deletion_reason_code: {
          type: Sequelize.STRING(50)
        },
        deletion_memo: {
          type: Sequelize.TEXT
        },
        deletion_approval_id: {
          type: Sequelize.INTEGER
        },
        reversal_transaction_id: {
          type: Sequelize.INTEGER
        },
        is_reversal: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        },
        original_transaction_id: {
          type: Sequelize.INTEGER
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        expense_category_id: {
          type: Sequelize.INTEGER
        },
        expense_type_id: {
          type: Sequelize.INTEGER
        }
      });
      console.log('   ✅ Table created: purchases');
    } else {
      console.log('   ✓ Table exists: purchases - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('purchases');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: purchases.id');
        await queryInterface.addColumn('purchases', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('registration_number')) {
        console.log('   + Adding missing column: purchases.registration_number');
        await queryInterface.addColumn('purchases', 'registration_number', {
registration_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('registration_date')) {
        console.log('   + Adding missing column: purchases.registration_date');
        await queryInterface.addColumn('purchases', 'registration_date', {
registration_date: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('date')) {
        console.log('   + Adding missing column: purchases.date');
        await queryInterface.addColumn('purchases', 'date', {
date: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('supplier_id')) {
        console.log('   + Adding missing column: purchases.supplier_id');
        await queryInterface.addColumn('purchases', 'supplier_id', {
supplier_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('supplier_rnc')) {
        console.log('   + Adding missing column: purchases.supplier_rnc');
        await queryInterface.addColumn('purchases', 'supplier_rnc', {
supplier_rnc: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('ncf')) {
        console.log('   + Adding missing column: purchases.ncf');
        await queryInterface.addColumn('purchases', 'ncf', {
ncf: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('purchase_type')) {
        console.log('   + Adding missing column: purchases.purchase_type');
        await queryInterface.addColumn('purchases', 'purchase_type', {
purchase_type: {
          type: Sequelize.STRING(100),
          allowNull: false,
          defaultValue: 'Merchandise for sale or consumption'
        }        });
      }
      if (!existingColumns.includes('payment_type')) {
        console.log('   + Adding missing column: purchases.payment_type');
        await queryInterface.addColumn('purchases', 'payment_type', {
payment_type: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('payment_status')) {
        console.log('   + Adding missing column: purchases.payment_status');
        await queryInterface.addColumn('purchases', 'payment_status', {
payment_status: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'Unpaid'
        }        });
      }
      if (!existingColumns.includes('product_total')) {
        console.log('   + Adding missing column: purchases.product_total');
        await queryInterface.addColumn('purchases', 'product_total', {
product_total: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('additional_expenses')) {
        console.log('   + Adding missing column: purchases.additional_expenses');
        await queryInterface.addColumn('purchases', 'additional_expenses', {
additional_expenses: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('total')) {
        console.log('   + Adding missing column: purchases.total');
        await queryInterface.addColumn('purchases', 'total', {
total: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('paid_amount')) {
        console.log('   + Adding missing column: purchases.paid_amount');
        await queryInterface.addColumn('purchases', 'paid_amount', {
paid_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('balance_amount')) {
        console.log('   + Adding missing column: purchases.balance_amount');
        await queryInterface.addColumn('purchases', 'balance_amount', {
balance_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('total_with_associated')) {
        console.log('   + Adding missing column: purchases.total_with_associated');
        await queryInterface.addColumn('purchases', 'total_with_associated', {
total_with_associated: {
          type: Sequelize.DECIMAL
        }        });
      }
      if (!existingColumns.includes('status')) {
        console.log('   + Adding missing column: purchases.status');
        await queryInterface.addColumn('purchases', 'status', {
status: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('bank_account_id')) {
        console.log('   + Adding missing column: purchases.bank_account_id');
        await queryInterface.addColumn('purchases', 'bank_account_id', {
bank_account_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('card_id')) {
        console.log('   + Adding missing column: purchases.card_id');
        await queryInterface.addColumn('purchases', 'card_id', {
card_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('cheque_number')) {
        console.log('   + Adding missing column: purchases.cheque_number');
        await queryInterface.addColumn('purchases', 'cheque_number', {
cheque_number: {
          type: Sequelize.STRING(100)
        }        });
      }
      if (!existingColumns.includes('cheque_date')) {
        console.log('   + Adding missing column: purchases.cheque_date');
        await queryInterface.addColumn('purchases', 'cheque_date', {
cheque_date: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('transfer_number')) {
        console.log('   + Adding missing column: purchases.transfer_number');
        await queryInterface.addColumn('purchases', 'transfer_number', {
transfer_number: {
          type: Sequelize.STRING(100)
        }        });
      }
      if (!existingColumns.includes('transfer_date')) {
        console.log('   + Adding missing column: purchases.transfer_date');
        await queryInterface.addColumn('purchases', 'transfer_date', {
transfer_date: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('payment_reference')) {
        console.log('   + Adding missing column: purchases.payment_reference');
        await queryInterface.addColumn('purchases', 'payment_reference', {
payment_reference: {
          type: Sequelize.STRING(100)
        }        });
      }
      if (!existingColumns.includes('voucher_date')) {
        console.log('   + Adding missing column: purchases.voucher_date');
        await queryInterface.addColumn('purchases', 'voucher_date', {
voucher_date: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('transaction_type')) {
        console.log('   + Adding missing column: purchases.transaction_type');
        await queryInterface.addColumn('purchases', 'transaction_type', {
transaction_type: {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'GOODS'
        }        });
      }
      if (!existingColumns.includes('request_id')) {
        console.log('   + Adding missing column: purchases.request_id');
        await queryInterface.addColumn('purchases', 'request_id', {
request_id: {
          type: Sequelize.UUID
        }        });
      }
      if (!existingColumns.includes('client_session_id')) {
        console.log('   + Adding missing column: purchases.client_session_id');
        await queryInterface.addColumn('purchases', 'client_session_id', {
client_session_id: {
          type: Sequelize.STRING(100)
        }        });
      }
      if (!existingColumns.includes('submission_timestamp')) {
        console.log('   + Adding missing column: purchases.submission_timestamp');
        await queryInterface.addColumn('purchases', 'submission_timestamp', {
submission_timestamp: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('deletion_status')) {
        console.log('   + Adding missing column: purchases.deletion_status');
        await queryInterface.addColumn('purchases', 'deletion_status', {
deletion_status: {
          type: Sequelize.STRING,
          defaultValue: 'NONE'
        }        });
      }
      if (!existingColumns.includes('deleted_at')) {
        console.log('   + Adding missing column: purchases.deleted_at');
        await queryInterface.addColumn('purchases', 'deleted_at', {
deleted_at: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('deleted_by')) {
        console.log('   + Adding missing column: purchases.deleted_by');
        await queryInterface.addColumn('purchases', 'deleted_by', {
deleted_by: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('deletion_reason_code')) {
        console.log('   + Adding missing column: purchases.deletion_reason_code');
        await queryInterface.addColumn('purchases', 'deletion_reason_code', {
deletion_reason_code: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('deletion_memo')) {
        console.log('   + Adding missing column: purchases.deletion_memo');
        await queryInterface.addColumn('purchases', 'deletion_memo', {
deletion_memo: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('deletion_approval_id')) {
        console.log('   + Adding missing column: purchases.deletion_approval_id');
        await queryInterface.addColumn('purchases', 'deletion_approval_id', {
deletion_approval_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('reversal_transaction_id')) {
        console.log('   + Adding missing column: purchases.reversal_transaction_id');
        await queryInterface.addColumn('purchases', 'reversal_transaction_id', {
reversal_transaction_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('is_reversal')) {
        console.log('   + Adding missing column: purchases.is_reversal');
        await queryInterface.addColumn('purchases', 'is_reversal', {
is_reversal: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        }        });
      }
      if (!existingColumns.includes('original_transaction_id')) {
        console.log('   + Adding missing column: purchases.original_transaction_id');
        await queryInterface.addColumn('purchases', 'original_transaction_id', {
original_transaction_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: purchases.created_at');
        await queryInterface.addColumn('purchases', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: purchases.updated_at');
        await queryInterface.addColumn('purchases', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('expense_category_id')) {
        console.log('   + Adding missing column: purchases.expense_category_id');
        await queryInterface.addColumn('purchases', 'expense_category_id', {
expense_category_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('expense_type_id')) {
        console.log('   + Adding missing column: purchases.expense_type_id');
        await queryInterface.addColumn('purchases', 'expense_type_id', {
expense_type_id: {
          type: Sequelize.INTEGER
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: report_export_logs
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('report_export_logs')) {
      console.log('   📋 Creating table: report_export_logs');
      await queryInterface.createTable('report_export_logs', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        report_type: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        report_name: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        export_format: {
          type: Sequelize.STRING(20),
          allowNull: false
        },
        file_path: {
          type: Sequelize.TEXT
        },
        file_size: {
          type: Sequelize.INTEGER
        },
        parameters: {
          type: Sequelize.JSONB
        },
        user_id: {
          type: Sequelize.INTEGER
        },
        status: {
          type: Sequelize.STRING(50),
          defaultValue: 'PENDING'
        },
        error_message: {
          type: Sequelize.TEXT
        },
        started_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        completed_at: {
          type: Sequelize.DATE
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });
      console.log('   ✅ Table created: report_export_logs');
    } else {
      console.log('   ✓ Table exists: report_export_logs - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('report_export_logs');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: report_export_logs.id');
        await queryInterface.addColumn('report_export_logs', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('report_type')) {
        console.log('   + Adding missing column: report_export_logs.report_type');
        await queryInterface.addColumn('report_export_logs', 'report_type', {
report_type: {
          type: Sequelize.STRING(100),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('report_name')) {
        console.log('   + Adding missing column: report_export_logs.report_name');
        await queryInterface.addColumn('report_export_logs', 'report_name', {
report_name: {
          type: Sequelize.STRING(255),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('export_format')) {
        console.log('   + Adding missing column: report_export_logs.export_format');
        await queryInterface.addColumn('report_export_logs', 'export_format', {
export_format: {
          type: Sequelize.STRING(20),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('file_path')) {
        console.log('   + Adding missing column: report_export_logs.file_path');
        await queryInterface.addColumn('report_export_logs', 'file_path', {
file_path: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('file_size')) {
        console.log('   + Adding missing column: report_export_logs.file_size');
        await queryInterface.addColumn('report_export_logs', 'file_size', {
file_size: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('parameters')) {
        console.log('   + Adding missing column: report_export_logs.parameters');
        await queryInterface.addColumn('report_export_logs', 'parameters', {
parameters: {
          type: Sequelize.JSONB
        }        });
      }
      if (!existingColumns.includes('user_id')) {
        console.log('   + Adding missing column: report_export_logs.user_id');
        await queryInterface.addColumn('report_export_logs', 'user_id', {
user_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('status')) {
        console.log('   + Adding missing column: report_export_logs.status');
        await queryInterface.addColumn('report_export_logs', 'status', {
status: {
          type: Sequelize.STRING(50),
          defaultValue: 'PENDING'
        }        });
      }
      if (!existingColumns.includes('error_message')) {
        console.log('   + Adding missing column: report_export_logs.error_message');
        await queryInterface.addColumn('report_export_logs', 'error_message', {
error_message: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('started_at')) {
        console.log('   + Adding missing column: report_export_logs.started_at');
        await queryInterface.addColumn('report_export_logs', 'started_at', {
started_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }        });
      }
      if (!existingColumns.includes('completed_at')) {
        console.log('   + Adding missing column: report_export_logs.completed_at');
        await queryInterface.addColumn('report_export_logs', 'completed_at', {
completed_at: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: report_export_logs.created_at');
        await queryInterface.addColumn('report_export_logs', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: report_export_logs.updated_at');
        await queryInterface.addColumn('report_export_logs', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: sale_items
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('sale_items')) {
      console.log('   📋 Creating table: sale_items');
      await queryInterface.createTable('sale_items', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        sale_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        product_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        product_code: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        product_name: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        unit_of_measurement: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        quantity: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        unit_price: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        subtotal: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        tax: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        total: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        cost_of_goods_sold: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        gross_margin: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: sale_items');
    } else {
      console.log('   ✓ Table exists: sale_items - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('sale_items');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: sale_items.id');
        await queryInterface.addColumn('sale_items', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('sale_id')) {
        console.log('   + Adding missing column: sale_items.sale_id');
        await queryInterface.addColumn('sale_items', 'sale_id', {
sale_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('product_id')) {
        console.log('   + Adding missing column: sale_items.product_id');
        await queryInterface.addColumn('sale_items', 'product_id', {
product_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('product_code')) {
        console.log('   + Adding missing column: sale_items.product_code');
        await queryInterface.addColumn('sale_items', 'product_code', {
product_code: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('product_name')) {
        console.log('   + Adding missing column: sale_items.product_name');
        await queryInterface.addColumn('sale_items', 'product_name', {
product_name: {
          type: Sequelize.STRING(255),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('unit_of_measurement')) {
        console.log('   + Adding missing column: sale_items.unit_of_measurement');
        await queryInterface.addColumn('sale_items', 'unit_of_measurement', {
unit_of_measurement: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('quantity')) {
        console.log('   + Adding missing column: sale_items.quantity');
        await queryInterface.addColumn('sale_items', 'quantity', {
quantity: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('unit_price')) {
        console.log('   + Adding missing column: sale_items.unit_price');
        await queryInterface.addColumn('sale_items', 'unit_price', {
unit_price: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('subtotal')) {
        console.log('   + Adding missing column: sale_items.subtotal');
        await queryInterface.addColumn('sale_items', 'subtotal', {
subtotal: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('tax')) {
        console.log('   + Adding missing column: sale_items.tax');
        await queryInterface.addColumn('sale_items', 'tax', {
tax: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('total')) {
        console.log('   + Adding missing column: sale_items.total');
        await queryInterface.addColumn('sale_items', 'total', {
total: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('cost_of_goods_sold')) {
        console.log('   + Adding missing column: sale_items.cost_of_goods_sold');
        await queryInterface.addColumn('sale_items', 'cost_of_goods_sold', {
cost_of_goods_sold: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('gross_margin')) {
        console.log('   + Adding missing column: sale_items.gross_margin');
        await queryInterface.addColumn('sale_items', 'gross_margin', {
gross_margin: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: sale_items.created_at');
        await queryInterface.addColumn('sale_items', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: sale_items.updated_at');
        await queryInterface.addColumn('sale_items', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: sales
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('sales')) {
      console.log('   📋 Creating table: sales');
      await queryInterface.createTable('sales', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        registration_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        document_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        registration_date: {
          type: Sequelize.DATE,
          allowNull: false
        },
        date: {
          type: Sequelize.DATE,
          allowNull: false
        },
        client_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        client_rnc: {
          type: Sequelize.STRING(50)
        },
        ncf: {
          type: Sequelize.STRING(50)
        },
        sale_type: {
          type: Sequelize.STRING(100),
          allowNull: false,
          defaultValue: 'Merchandise for sale'
        },
        payment_type: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        card_payment_network_id: {
          type: Sequelize.INTEGER
        },
        collection_status: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'Not Collected'
        },
        subtotal: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        tax: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        discount: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        },
        total: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        collected_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        },
        balance_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        },
        status: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        deletion_status: {
          type: Sequelize.STRING,
          defaultValue: 'NONE'
        },
        deleted_at: {
          type: Sequelize.DATE
        },
        deleted_by: {
          type: Sequelize.INTEGER
        },
        deletion_reason_code: {
          type: Sequelize.STRING(50)
        },
        deletion_memo: {
          type: Sequelize.TEXT
        },
        deletion_approval_id: {
          type: Sequelize.INTEGER
        },
        reversal_transaction_id: {
          type: Sequelize.INTEGER
        },
        is_reversal: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        },
        original_transaction_id: {
          type: Sequelize.INTEGER
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: sales');
    } else {
      console.log('   ✓ Table exists: sales - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('sales');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: sales.id');
        await queryInterface.addColumn('sales', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('registration_number')) {
        console.log('   + Adding missing column: sales.registration_number');
        await queryInterface.addColumn('sales', 'registration_number', {
registration_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('document_number')) {
        console.log('   + Adding missing column: sales.document_number');
        await queryInterface.addColumn('sales', 'document_number', {
document_number: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('registration_date')) {
        console.log('   + Adding missing column: sales.registration_date');
        await queryInterface.addColumn('sales', 'registration_date', {
registration_date: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('date')) {
        console.log('   + Adding missing column: sales.date');
        await queryInterface.addColumn('sales', 'date', {
date: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('client_id')) {
        console.log('   + Adding missing column: sales.client_id');
        await queryInterface.addColumn('sales', 'client_id', {
client_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('client_rnc')) {
        console.log('   + Adding missing column: sales.client_rnc');
        await queryInterface.addColumn('sales', 'client_rnc', {
client_rnc: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('ncf')) {
        console.log('   + Adding missing column: sales.ncf');
        await queryInterface.addColumn('sales', 'ncf', {
ncf: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('sale_type')) {
        console.log('   + Adding missing column: sales.sale_type');
        await queryInterface.addColumn('sales', 'sale_type', {
sale_type: {
          type: Sequelize.STRING(100),
          allowNull: false,
          defaultValue: 'Merchandise for sale'
        }        });
      }
      if (!existingColumns.includes('payment_type')) {
        console.log('   + Adding missing column: sales.payment_type');
        await queryInterface.addColumn('sales', 'payment_type', {
payment_type: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('card_payment_network_id')) {
        console.log('   + Adding missing column: sales.card_payment_network_id');
        await queryInterface.addColumn('sales', 'card_payment_network_id', {
card_payment_network_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('collection_status')) {
        console.log('   + Adding missing column: sales.collection_status');
        await queryInterface.addColumn('sales', 'collection_status', {
collection_status: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'Not Collected'
        }        });
      }
      if (!existingColumns.includes('subtotal')) {
        console.log('   + Adding missing column: sales.subtotal');
        await queryInterface.addColumn('sales', 'subtotal', {
subtotal: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('tax')) {
        console.log('   + Adding missing column: sales.tax');
        await queryInterface.addColumn('sales', 'tax', {
tax: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('discount')) {
        console.log('   + Adding missing column: sales.discount');
        await queryInterface.addColumn('sales', 'discount', {
discount: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('total')) {
        console.log('   + Adding missing column: sales.total');
        await queryInterface.addColumn('sales', 'total', {
total: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('collected_amount')) {
        console.log('   + Adding missing column: sales.collected_amount');
        await queryInterface.addColumn('sales', 'collected_amount', {
collected_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('balance_amount')) {
        console.log('   + Adding missing column: sales.balance_amount');
        await queryInterface.addColumn('sales', 'balance_amount', {
balance_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('status')) {
        console.log('   + Adding missing column: sales.status');
        await queryInterface.addColumn('sales', 'status', {
status: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('deletion_status')) {
        console.log('   + Adding missing column: sales.deletion_status');
        await queryInterface.addColumn('sales', 'deletion_status', {
deletion_status: {
          type: Sequelize.STRING,
          defaultValue: 'NONE'
        }        });
      }
      if (!existingColumns.includes('deleted_at')) {
        console.log('   + Adding missing column: sales.deleted_at');
        await queryInterface.addColumn('sales', 'deleted_at', {
deleted_at: {
          type: Sequelize.DATE
        }        });
      }
      if (!existingColumns.includes('deleted_by')) {
        console.log('   + Adding missing column: sales.deleted_by');
        await queryInterface.addColumn('sales', 'deleted_by', {
deleted_by: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('deletion_reason_code')) {
        console.log('   + Adding missing column: sales.deletion_reason_code');
        await queryInterface.addColumn('sales', 'deletion_reason_code', {
deletion_reason_code: {
          type: Sequelize.STRING(50)
        }        });
      }
      if (!existingColumns.includes('deletion_memo')) {
        console.log('   + Adding missing column: sales.deletion_memo');
        await queryInterface.addColumn('sales', 'deletion_memo', {
deletion_memo: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('deletion_approval_id')) {
        console.log('   + Adding missing column: sales.deletion_approval_id');
        await queryInterface.addColumn('sales', 'deletion_approval_id', {
deletion_approval_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('reversal_transaction_id')) {
        console.log('   + Adding missing column: sales.reversal_transaction_id');
        await queryInterface.addColumn('sales', 'reversal_transaction_id', {
reversal_transaction_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('is_reversal')) {
        console.log('   + Adding missing column: sales.is_reversal');
        await queryInterface.addColumn('sales', 'is_reversal', {
is_reversal: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        }        });
      }
      if (!existingColumns.includes('original_transaction_id')) {
        console.log('   + Adding missing column: sales.original_transaction_id');
        await queryInterface.addColumn('sales', 'original_transaction_id', {
original_transaction_id: {
          type: Sequelize.INTEGER
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: sales.created_at');
        await queryInterface.addColumn('sales', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: sales.updated_at');
        await queryInterface.addColumn('sales', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: supplier_credits
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('supplier_credits')) {
      console.log('   📋 Creating table: supplier_credits');
      await queryInterface.createTable('supplier_credits', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        supplier_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        supplier_rnc: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        supplier_name: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        payment_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        credit_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        used_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        },
        remaining_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        },
        registration_date: {
          type: Sequelize.DATE,
          allowNull: false
        },
        status: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'Active'
        },
        notes: {
          type: Sequelize.TEXT
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: supplier_credits');
    } else {
      console.log('   ✓ Table exists: supplier_credits - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('supplier_credits');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: supplier_credits.id');
        await queryInterface.addColumn('supplier_credits', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('supplier_id')) {
        console.log('   + Adding missing column: supplier_credits.supplier_id');
        await queryInterface.addColumn('supplier_credits', 'supplier_id', {
supplier_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('supplier_rnc')) {
        console.log('   + Adding missing column: supplier_credits.supplier_rnc');
        await queryInterface.addColumn('supplier_credits', 'supplier_rnc', {
supplier_rnc: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('supplier_name')) {
        console.log('   + Adding missing column: supplier_credits.supplier_name');
        await queryInterface.addColumn('supplier_credits', 'supplier_name', {
supplier_name: {
          type: Sequelize.STRING(255),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('payment_id')) {
        console.log('   + Adding missing column: supplier_credits.payment_id');
        await queryInterface.addColumn('supplier_credits', 'payment_id', {
payment_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('credit_amount')) {
        console.log('   + Adding missing column: supplier_credits.credit_amount');
        await queryInterface.addColumn('supplier_credits', 'credit_amount', {
credit_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('used_amount')) {
        console.log('   + Adding missing column: supplier_credits.used_amount');
        await queryInterface.addColumn('supplier_credits', 'used_amount', {
used_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('remaining_amount')) {
        console.log('   + Adding missing column: supplier_credits.remaining_amount');
        await queryInterface.addColumn('supplier_credits', 'remaining_amount', {
remaining_amount: {
          type: Sequelize.DECIMAL,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('registration_date')) {
        console.log('   + Adding missing column: supplier_credits.registration_date');
        await queryInterface.addColumn('supplier_credits', 'registration_date', {
registration_date: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('status')) {
        console.log('   + Adding missing column: supplier_credits.status');
        await queryInterface.addColumn('supplier_credits', 'status', {
status: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'Active'
        }        });
      }
      if (!existingColumns.includes('notes')) {
        console.log('   + Adding missing column: supplier_credits.notes');
        await queryInterface.addColumn('supplier_credits', 'notes', {
notes: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: supplier_credits.created_at');
        await queryInterface.addColumn('supplier_credits', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: supplier_credits.updated_at');
        await queryInterface.addColumn('supplier_credits', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: suppliers
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('suppliers')) {
      console.log('   📋 Creating table: suppliers');
      await queryInterface.createTable('suppliers', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        code: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        name: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        rnc: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        phone: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        email: {
          type: Sequelize.STRING(255)
        },
        address: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        supplier_type: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'LOCAL'
        },
        payment_terms: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'CASH'
        },
        current_balance: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        },
        status: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'ACTIVE'
        },
        contact_person: {
          type: Sequelize.STRING(255)
        },
        notes: {
          type: Sequelize.TEXT
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: suppliers');
    } else {
      console.log('   ✓ Table exists: suppliers - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('suppliers');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: suppliers.id');
        await queryInterface.addColumn('suppliers', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('code')) {
        console.log('   + Adding missing column: suppliers.code');
        await queryInterface.addColumn('suppliers', 'code', {
code: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('name')) {
        console.log('   + Adding missing column: suppliers.name');
        await queryInterface.addColumn('suppliers', 'name', {
name: {
          type: Sequelize.STRING(255),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('rnc')) {
        console.log('   + Adding missing column: suppliers.rnc');
        await queryInterface.addColumn('suppliers', 'rnc', {
rnc: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('phone')) {
        console.log('   + Adding missing column: suppliers.phone');
        await queryInterface.addColumn('suppliers', 'phone', {
phone: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('email')) {
        console.log('   + Adding missing column: suppliers.email');
        await queryInterface.addColumn('suppliers', 'email', {
email: {
          type: Sequelize.STRING(255)
        }        });
      }
      if (!existingColumns.includes('address')) {
        console.log('   + Adding missing column: suppliers.address');
        await queryInterface.addColumn('suppliers', 'address', {
address: {
          type: Sequelize.TEXT,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('supplier_type')) {
        console.log('   + Adding missing column: suppliers.supplier_type');
        await queryInterface.addColumn('suppliers', 'supplier_type', {
supplier_type: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'LOCAL'
        }        });
      }
      if (!existingColumns.includes('payment_terms')) {
        console.log('   + Adding missing column: suppliers.payment_terms');
        await queryInterface.addColumn('suppliers', 'payment_terms', {
payment_terms: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'CASH'
        }        });
      }
      if (!existingColumns.includes('current_balance')) {
        console.log('   + Adding missing column: suppliers.current_balance');
        await queryInterface.addColumn('suppliers', 'current_balance', {
current_balance: {
          type: Sequelize.DECIMAL,
          allowNull: false,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('status')) {
        console.log('   + Adding missing column: suppliers.status');
        await queryInterface.addColumn('suppliers', 'status', {
status: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'ACTIVE'
        }        });
      }
      if (!existingColumns.includes('contact_person')) {
        console.log('   + Adding missing column: suppliers.contact_person');
        await queryInterface.addColumn('suppliers', 'contact_person', {
contact_person: {
          type: Sequelize.STRING(255)
        }        });
      }
      if (!existingColumns.includes('notes')) {
        console.log('   + Adding missing column: suppliers.notes');
        await queryInterface.addColumn('suppliers', 'notes', {
notes: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: suppliers.created_at');
        await queryInterface.addColumn('suppliers', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: suppliers.updated_at');
        await queryInterface.addColumn('suppliers', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: transaction_audit_trail
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('transaction_audit_trail')) {
      console.log('   📋 Creating table: transaction_audit_trail');
      await queryInterface.createTable('transaction_audit_trail', {
        id: {
          type: Sequelize.BIGINT,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        audit_hash: {
          type: Sequelize.STRING(64),
          allowNull: false
        },
        previous_hash: {
          type: Sequelize.STRING(64)
        },
        entity_type: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        entity_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        action_type: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        action_data: {
          type: Sequelize.JSON,
          allowNull: false
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        ip_address: {
          type: Sequelize.STRING(45)
        },
        user_agent: {
          type: Sequelize.TEXT
        },
        approval_id: {
          type: Sequelize.INTEGER
        }
      });
      console.log('   ✅ Table created: transaction_audit_trail');
    } else {
      console.log('   ✓ Table exists: transaction_audit_trail - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('transaction_audit_trail');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: transaction_audit_trail.id');
        await queryInterface.addColumn('transaction_audit_trail', 'id', {
id: {
          type: Sequelize.BIGINT,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('audit_hash')) {
        console.log('   + Adding missing column: transaction_audit_trail.audit_hash');
        await queryInterface.addColumn('transaction_audit_trail', 'audit_hash', {
audit_hash: {
          type: Sequelize.STRING(64),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('previous_hash')) {
        console.log('   + Adding missing column: transaction_audit_trail.previous_hash');
        await queryInterface.addColumn('transaction_audit_trail', 'previous_hash', {
previous_hash: {
          type: Sequelize.STRING(64)
        }        });
      }
      if (!existingColumns.includes('entity_type')) {
        console.log('   + Adding missing column: transaction_audit_trail.entity_type');
        await queryInterface.addColumn('transaction_audit_trail', 'entity_type', {
entity_type: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('entity_id')) {
        console.log('   + Adding missing column: transaction_audit_trail.entity_id');
        await queryInterface.addColumn('transaction_audit_trail', 'entity_id', {
entity_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('action_type')) {
        console.log('   + Adding missing column: transaction_audit_trail.action_type');
        await queryInterface.addColumn('transaction_audit_trail', 'action_type', {
action_type: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('action_data')) {
        console.log('   + Adding missing column: transaction_audit_trail.action_data');
        await queryInterface.addColumn('transaction_audit_trail', 'action_data', {
action_data: {
          type: Sequelize.JSON,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('user_id')) {
        console.log('   + Adding missing column: transaction_audit_trail.user_id');
        await queryInterface.addColumn('transaction_audit_trail', 'user_id', {
user_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('ip_address')) {
        console.log('   + Adding missing column: transaction_audit_trail.ip_address');
        await queryInterface.addColumn('transaction_audit_trail', 'ip_address', {
ip_address: {
          type: Sequelize.STRING(45)
        }        });
      }
      if (!existingColumns.includes('user_agent')) {
        console.log('   + Adding missing column: transaction_audit_trail.user_agent');
        await queryInterface.addColumn('transaction_audit_trail', 'user_agent', {
user_agent: {
          type: Sequelize.TEXT
        }        });
      }
      if (!existingColumns.includes('approval_id')) {
        console.log('   + Adding missing column: transaction_audit_trail.approval_id');
        await queryInterface.addColumn('transaction_audit_trail', 'approval_id', {
approval_id: {
          type: Sequelize.INTEGER
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: transaction_deletion_reasons
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('transaction_deletion_reasons')) {
      console.log('   📋 Creating table: transaction_deletion_reasons');
      await queryInterface.createTable('transaction_deletion_reasons', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        reason_code: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        reason_name: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        requires_memo: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        },
        is_standard: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          defaultValue: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: transaction_deletion_reasons');
    } else {
      console.log('   ✓ Table exists: transaction_deletion_reasons - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('transaction_deletion_reasons');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: transaction_deletion_reasons.id');
        await queryInterface.addColumn('transaction_deletion_reasons', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('reason_code')) {
        console.log('   + Adding missing column: transaction_deletion_reasons.reason_code');
        await queryInterface.addColumn('transaction_deletion_reasons', 'reason_code', {
reason_code: {
          type: Sequelize.STRING(50),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('reason_name')) {
        console.log('   + Adding missing column: transaction_deletion_reasons.reason_name');
        await queryInterface.addColumn('transaction_deletion_reasons', 'reason_name', {
reason_name: {
          type: Sequelize.STRING(100),
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('requires_memo')) {
        console.log('   + Adding missing column: transaction_deletion_reasons.requires_memo');
        await queryInterface.addColumn('transaction_deletion_reasons', 'requires_memo', {
requires_memo: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        }        });
      }
      if (!existingColumns.includes('is_standard')) {
        console.log('   + Adding missing column: transaction_deletion_reasons.is_standard');
        await queryInterface.addColumn('transaction_deletion_reasons', 'is_standard', {
is_standard: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        }        });
      }
      if (!existingColumns.includes('is_active')) {
        console.log('   + Adding missing column: transaction_deletion_reasons.is_active');
        await queryInterface.addColumn('transaction_deletion_reasons', 'is_active', {
is_active: {
          type: Sequelize.BOOLEAN,
          defaultValue: true
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: transaction_deletion_reasons.created_at');
        await queryInterface.addColumn('transaction_deletion_reasons', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: transaction_deletion_reasons.updated_at');
        await queryInterface.addColumn('transaction_deletion_reasons', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Table: user_roles
    // ═══════════════════════════════════════════════════════════
    if (!existingTables.includes('user_roles')) {
      console.log('   📋 Creating table: user_roles');
      await queryInterface.createTable('user_roles', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        role_name: {
          type: Sequelize.STRING,
          allowNull: false
        },
        approval_limit: {
          type: Sequelize.DECIMAL,
          defaultValue: 0
        },
        can_delegate: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          defaultValue: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });
      console.log('   ✅ Table created: user_roles');
    } else {
      console.log('   ✓ Table exists: user_roles - checking columns...');
      
      // Check and add missing columns
      const tableDesc = await queryInterface.describeTable('user_roles');
      const existingColumns = Object.keys(tableDesc);
      
      if (!existingColumns.includes('id')) {
        console.log('   + Adding missing column: user_roles.id');
        await queryInterface.addColumn('user_roles', 'id', {
id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }        });
      }
      if (!existingColumns.includes('user_id')) {
        console.log('   + Adding missing column: user_roles.user_id');
        await queryInterface.addColumn('user_roles', 'user_id', {
user_id: {
          type: Sequelize.INTEGER,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('role_name')) {
        console.log('   + Adding missing column: user_roles.role_name');
        await queryInterface.addColumn('user_roles', 'role_name', {
role_name: {
          type: Sequelize.STRING,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('approval_limit')) {
        console.log('   + Adding missing column: user_roles.approval_limit');
        await queryInterface.addColumn('user_roles', 'approval_limit', {
approval_limit: {
          type: Sequelize.DECIMAL,
          defaultValue: 0
        }        });
      }
      if (!existingColumns.includes('can_delegate')) {
        console.log('   + Adding missing column: user_roles.can_delegate');
        await queryInterface.addColumn('user_roles', 'can_delegate', {
can_delegate: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        }        });
      }
      if (!existingColumns.includes('is_active')) {
        console.log('   + Adding missing column: user_roles.is_active');
        await queryInterface.addColumn('user_roles', 'is_active', {
is_active: {
          type: Sequelize.BOOLEAN,
          defaultValue: true
        }        });
      }
      if (!existingColumns.includes('created_at')) {
        console.log('   + Adding missing column: user_roles.created_at');
        await queryInterface.addColumn('user_roles', 'created_at', {
created_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
      if (!existingColumns.includes('updated_at')) {
        console.log('   + Adding missing column: user_roles.updated_at');
        await queryInterface.addColumn('user_roles', 'updated_at', {
updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }        });
      }
    }

    console.log('\n✅ Baseline migration complete - all tables and columns verified');
  },

  down: async (queryInterface, Sequelize) => {
    // Baseline migration - no rollback
    console.log('⚠️  Baseline migration cannot be rolled back');
  }
};

