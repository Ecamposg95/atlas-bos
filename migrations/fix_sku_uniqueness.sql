-- Migration Script: Fix SKU Uniqueness Constraint
-- This script updates the product_variants table to enforce SKU uniqueness per organization
-- instead of globally, which is required for proper multi-tenant isolation.

-- Step 1: Drop the existing global unique index on SKU
DROP INDEX IF EXISTS ix_product_variants_sku;

-- Step 2: Create a new composite unique index on (organization_id, sku)
-- This index only applies to non-deleted records (WHERE deleted_at IS NULL)
-- allowing the same SKU to be reused after soft-deletion
CREATE UNIQUE INDEX ix_product_variants_org_sku 
ON product_variants(organization_id, sku) 
WHERE deleted_at IS NULL;

-- Step 3: (Optional) Create a regular index on SKU for search performance
CREATE INDEX ix_product_variants_sku_search ON product_variants(sku);
