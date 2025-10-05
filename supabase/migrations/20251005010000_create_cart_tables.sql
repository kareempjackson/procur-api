-- =============================================
-- Cart Tables Migration
-- Creates shopping_carts and cart_items tables
-- =============================================

-- Shopping Carts Table
CREATE TABLE IF NOT EXISTS shopping_carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  buyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(buyer_org_id, buyer_user_id)
);

-- Cart Items Table
CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id UUID NOT NULL REFERENCES shopping_carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
  added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(cart_id, product_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shopping_carts_buyer_org ON shopping_carts(buyer_org_id);
CREATE INDEX IF NOT EXISTS idx_shopping_carts_buyer_user ON shopping_carts(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_carts_status ON shopping_carts(status);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product ON cart_items(product_id);

-- Updated at trigger for shopping_carts
CREATE OR REPLACE FUNCTION update_shopping_carts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shopping_carts_updated_at ON shopping_carts;
CREATE TRIGGER shopping_carts_updated_at
  BEFORE UPDATE ON shopping_carts
  FOR EACH ROW
  EXECUTE FUNCTION update_shopping_carts_updated_at();

-- Updated at trigger for cart_items
CREATE OR REPLACE FUNCTION update_cart_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cart_items_updated_at ON cart_items;
CREATE TRIGGER cart_items_updated_at
  BEFORE UPDATE ON cart_items
  FOR EACH ROW
  EXECUTE FUNCTION update_cart_items_updated_at();

-- Trigger to update shopping_cart updated_at when cart_items change
CREATE OR REPLACE FUNCTION update_cart_on_item_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE shopping_carts SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.cart_id;
    RETURN OLD;
  ELSE
    UPDATE shopping_carts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.cart_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cart_items_change ON cart_items;
CREATE TRIGGER cart_items_change
  AFTER INSERT OR UPDATE OR DELETE ON cart_items
  FOR EACH ROW
  EXECUTE FUNCTION update_cart_on_item_change();

-- Function to get or create cart
CREATE OR REPLACE FUNCTION get_or_create_cart(
  p_buyer_org_id UUID,
  p_buyer_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_cart_id UUID;
BEGIN
  -- Try to get existing cart
  SELECT id INTO v_cart_id
  FROM shopping_carts
  WHERE buyer_org_id = p_buyer_org_id 
    AND buyer_user_id = p_buyer_user_id
    AND status = 'active';
  
  -- If no cart exists, create one
  IF v_cart_id IS NULL THEN
    INSERT INTO shopping_carts (buyer_org_id, buyer_user_id, status)
    VALUES (p_buyer_org_id, p_buyer_user_id, 'active')
    RETURNING id INTO v_cart_id;
  END IF;
  
  RETURN v_cart_id;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE shopping_carts IS 'Shopping carts for buyers';
COMMENT ON TABLE cart_items IS 'Items in shopping carts';
COMMENT ON FUNCTION get_or_create_cart IS 'Gets existing active cart or creates a new one';

