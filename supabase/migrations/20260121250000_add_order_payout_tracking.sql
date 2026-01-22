-- Add payout tracking fields to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payout_status VARCHAR(32) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS paid_out_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS paid_out_by UUID REFERENCES users(id);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_orders_payout_status ON orders(payout_status);
CREATE INDEX IF NOT EXISTS idx_orders_seller_payout ON orders(seller_org_id, payout_status);

-- Comment on columns
COMMENT ON COLUMN orders.payout_status IS 'Status of payout to seller: pending, paid';
COMMENT ON COLUMN orders.paid_out_at IS 'When the seller was paid out for this order';
COMMENT ON COLUMN orders.paid_out_by IS 'Admin who processed the payout';

