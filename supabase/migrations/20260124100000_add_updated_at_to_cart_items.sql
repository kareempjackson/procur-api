-- =============================================
-- Add updated_at column to cart_items if missing
-- Fixes: "record \"new\" has no field \"updated_at\""
-- =============================================

-- Add updated_at column to cart_items if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'cart_items' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE cart_items ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    
    -- Backfill updated_at with added_at for existing rows
    UPDATE cart_items SET updated_at = COALESCE(added_at, CURRENT_TIMESTAMP) WHERE updated_at IS NULL;
  END IF;
END $$;

-- Ensure the trigger function exists
CREATE OR REPLACE FUNCTION update_cart_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS cart_items_updated_at ON cart_items;
CREATE TRIGGER cart_items_updated_at
  BEFORE UPDATE ON cart_items
  FOR EACH ROW
  EXECUTE FUNCTION update_cart_items_updated_at();

