-- Migration Script: Rename Product Fields
-- costPrice → unitCost
-- salePrice → subtotal
-- Amount → quantity

-- Step 1: Rename columns in products table
ALTER TABLE products RENAME COLUMN "costPrice" TO "unitCost";
ALTER TABLE products RENAME COLUMN "salePrice" TO "subtotal";
ALTER TABLE products RENAME COLUMN "Amount" TO "quantity";

-- Step 2: Rename column in sale_items table
ALTER TABLE sale_items RENAME COLUMN "salePrice" TO "unitPrice";

-- Done! All field names are now consistent.
