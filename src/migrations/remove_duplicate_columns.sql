-- Migration: Remove Duplicate Columns from card_payment_networks
-- Description: Remove card_type and is_customer_card if they were accidentally created
-- Date: 2026-04-04
-- Database: PostgreSQL

-- Step 1: Remove card_type column (if it exists as duplicate)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'card_payment_networks' 
        AND column_name = 'card_type'
    ) THEN
        ALTER TABLE card_payment_networks DROP COLUMN card_type;
        RAISE NOTICE 'Dropped card_type column from card_payment_networks';
    ELSE
        RAISE NOTICE 'Column card_type does not exist in card_payment_networks';
    END IF;
END $$;

-- Step 2: Remove is_customer_card column (if it exists)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'card_payment_networks' 
        AND column_name = 'is_customer_card'
    ) THEN
        ALTER TABLE card_payment_networks DROP COLUMN is_customer_card;
        RAISE NOTICE 'Dropped is_customer_card column from card_payment_networks';
    ELSE
        RAISE NOTICE 'Column is_customer_card does not exist in card_payment_networks';
    END IF;
END $$;

-- Step 3: Drop indexes if they exist
DROP INDEX IF EXISTS idx_card_type_customer;

-- Verification: Show current columns
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'card_payment_networks' 
-- ORDER BY ordinal_position;
