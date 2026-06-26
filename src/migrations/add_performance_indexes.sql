-- Performance Optimization Indexes for Purchase Creation
-- These indexes significantly reduce query time for frequently accessed data

-- Index for registration number lookup (used in generateRegistrationNumberAtomic)
CREATE INDEX IF NOT EXISTS idx_purchases_registration_number 
ON purchases (registration_number DESC) 
WHERE registration_number LIKE 'CP%';

-- Composite index for bank account balance lookups
CREATE INDEX IF NOT EXISTS idx_bank_registers_account_balance 
ON bank_registers (bank_account_id, id DESC);

-- Index for account balances with fiscal period
CREATE INDEX IF NOT EXISTS idx_account_balances_account_period 
ON account_balances (account_id, fiscal_period_id) 
WHERE fiscal_period_id IS NULL;

-- Index for chart of accounts lookup by code
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_code_active 
ON chart_of_accounts (account_code) 
WHERE is_active = true;

-- Composite index for general ledger entry date lookups
CREATE INDEX IF NOT EXISTS idx_general_ledger_entry_date 
ON general_ledger (entry_date DESC, id DESC);

-- Index for supplier lookups by name
CREATE INDEX IF NOT EXISTS idx_suppliers_name 
ON suppliers (name) 
WHERE status = 'ACTIVE';

-- Index for product lookups by ID
CREATE INDEX IF NOT EXISTS idx_products_id 
ON products (id) 
WHERE status = 'ACTIVE';

-- Partial index for bank accounts (only active)
CREATE INDEX IF NOT EXISTS idx_bank_accounts_active 
ON bank_accounts (id, balance) 
WHERE status = 'ACTIVE';

-- Index for purchase items by purchase_id
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id 
ON purchase_items (purchase_id);

-- Index for associated invoices by purchase_id
CREATE INDEX IF NOT EXISTS idx_associated_invoices_purchase_id 
ON associated_invoices (purchase_id);

-- Create sequence for GL entry number generation (faster than SELECT MAX)
CREATE SEQUENCE IF NOT EXISTS gl_entry_sequence_2026 START 1;
CREATE SEQUENCE IF NOT EXISTS gl_entry_sequence_2025 START 1;
CREATE SEQUENCE IF NOT EXISTS gl_entry_sequence_2024 START 1;

-- Function to get or create the current year's sequence
CREATE OR REPLACE FUNCTION get_gl_entry_sequence()
RETURNS BIGINT AS $$
DECLARE
  current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  sequence_name TEXT := 'gl_entry_sequence_' || current_year;
BEGIN
  -- Ensure sequence exists
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I START 1', sequence_name);
  
  -- Get next value
  RETURN nextval(sequence_name);
END;
$$ LANGUAGE plpgsql;

-- Materialized view for chart of accounts cache (database-level caching)
-- This provides fast access to frequently accessed account data
CREATE MATERIALIZED VIEW IF NOT EXISTS chart_of_accounts_cache_mv AS
SELECT 
  id,
  account_code,
  account_name,
  account_type,
  account_sub_type,
  parent_account_id,
  level,
  is_active,
  is_system_account,
  normal_balance,
  description,
  created_at,
  updated_at
FROM chart_of_accounts
WHERE is_active = true;

-- Create unique index on materialized view (required for REFRESH)
CREATE UNIQUE INDEX IF NOT EXISTS idx_chart_accounts_mv_id 
ON chart_of_accounts_cache_mv (id);

-- Create index on account_code for fast lookups
CREATE INDEX IF NOT EXISTS idx_chart_accounts_mv_code 
ON chart_of_accounts_cache_mv (account_code);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_chart_accounts_cache()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY chart_of_accounts_cache_mv;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh every 5 minutes (using pg_cron extension if available)
-- SELECT cron.schedule('refresh-chart-accounts', '*/5 * * * *', 'SELECT refresh_chart_accounts_cache()');

-- Create trigger to automatically refresh cache when chart_of_accounts changes
CREATE OR REPLACE FUNCTION trigger_refresh_chart_accounts()
RETURNS TRIGGER AS $$
BEGIN
  -- Refresh materialized view asynchronously (don't block the transaction)
  -- Note: REFRESH CONCURRENTLY cannot be called in a trigger
  -- Instead, we'll mark it as dirty and refresh via a scheduled job
  PERFORM pg_notify('chart_accounts_dirty', '');
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on chart_of_accounts
DROP TRIGGER IF EXISTS tr_chart_accounts_refresh ON chart_of_accounts;
CREATE TRIGGER tr_chart_accounts_refresh
AFTER INSERT OR UPDATE OR DELETE ON chart_of_accounts
FOR EACH STATEMENT
EXECUTE FUNCTION trigger_refresh_chart_accounts();

-- Database-level query cache configuration
-- Increase shared_buffers for better caching (requires PostgreSQL restart)
-- ALTER SYSTEM SET shared_buffers = '256MB';
-- ALTER SYSTEM SET effective_cache_size = '1GB';
-- ALTER SYSTEM SET work_mem = '16MB';

-- Enable query plan caching
-- ALTER SYSTEM SET plan_cache_mode = 'force_generic_plan';

COMMENT ON INDEX idx_purchases_registration_number IS 'Optimizes registration number generation for purchases';
COMMENT ON INDEX idx_bank_registers_account_balance IS 'Optimizes bank balance lookups in batch operations';
COMMENT ON INDEX idx_account_balances_account_period IS 'Optimizes account balance updates for GL posting';
COMMENT ON INDEX idx_chart_of_accounts_code_active IS 'Optimizes chart of accounts lookups with caching';
COMMENT ON MATERIALIZED VIEW chart_of_accounts_cache_mv IS 'Database-level cache for frequently accessed chart of accounts data';
