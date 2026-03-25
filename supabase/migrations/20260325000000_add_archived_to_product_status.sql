-- Add 'archived' value to product_status enum (used for soft-delete of seller products)
ALTER TYPE product_status ADD VALUE IF NOT EXISTS 'archived';
