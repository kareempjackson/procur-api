-- Create buyer credits system

-- Buyer balances table to track credit balances
CREATE TABLE IF NOT EXISTS buyer_balances (
  buyer_org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  credit_amount_cents BIGINT NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'XCD',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Buyer credit transactions table to track history
CREATE TABLE IF NOT EXISTS buyer_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL, -- positive for credits, negative for usage
  balance_after_cents BIGINT NOT NULL, -- running balance after this transaction
  type VARCHAR(32) NOT NULL, -- 'credit', 'usage', 'refund', 'adjustment'
  reason VARCHAR(255) NOT NULL, -- e.g., 'order_issue', 'goodwill', 'order_applied', 'refund'
  note TEXT,
  order_id UUID REFERENCES orders(id), -- optional link to an order
  created_by UUID REFERENCES users(id), -- admin who created this (null for auto-applied)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_buyer_credit_transactions_buyer_org_id 
  ON buyer_credit_transactions(buyer_org_id);
CREATE INDEX IF NOT EXISTS idx_buyer_credit_transactions_created_at 
  ON buyer_credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_buyer_balances_credit_amount 
  ON buyer_balances(credit_amount_cents) WHERE credit_amount_cents > 0;

-- Add credits_applied field to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS credits_applied_cents BIGINT DEFAULT 0;

COMMENT ON COLUMN orders.credits_applied_cents IS 'Amount of buyer credits applied to this order';

-- Function to adjust buyer credit
CREATE OR REPLACE FUNCTION adjust_buyer_credit(
  p_buyer_org_id UUID,
  p_amount_cents BIGINT,
  p_type VARCHAR,
  p_reason VARCHAR,
  p_note TEXT DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_admin_user_id UUID DEFAULT NULL
)
RETURNS TABLE(transaction_id UUID, new_balance_cents BIGINT) AS $$
DECLARE
  v_new_balance BIGINT;
  v_tx_id UUID;
BEGIN
  -- Upsert buyer balance
  INSERT INTO buyer_balances (buyer_org_id, credit_amount_cents)
  VALUES (p_buyer_org_id, p_amount_cents)
  ON CONFLICT (buyer_org_id)
  DO UPDATE SET
    credit_amount_cents = buyer_balances.credit_amount_cents + p_amount_cents,
    updated_at = NOW();
  
  -- Get new balance
  SELECT credit_amount_cents INTO v_new_balance
  FROM buyer_balances
  WHERE buyer_org_id = p_buyer_org_id;
  
  -- Insert transaction record
  INSERT INTO buyer_credit_transactions (
    buyer_org_id,
    amount_cents,
    balance_after_cents,
    type,
    reason,
    note,
    order_id,
    created_by
  ) VALUES (
    p_buyer_org_id,
    p_amount_cents,
    v_new_balance,
    p_type,
    p_reason,
    p_note,
    p_order_id,
    p_admin_user_id
  )
  RETURNING id INTO v_tx_id;
  
  RETURN QUERY SELECT v_tx_id, v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- RLS policies for buyer_balances
ALTER TABLE buyer_balances ENABLE ROW LEVEL SECURITY;

-- Admins can manage all buyer balances
CREATE POLICY admin_manage_buyer_balances ON buyer_balances
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Buyers can view their own balance
CREATE POLICY buyer_view_own_balance ON buyer_balances
  FOR SELECT
  TO authenticated
  USING (
    buyer_org_id = (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- RLS policies for buyer_credit_transactions
ALTER TABLE buyer_credit_transactions ENABLE ROW LEVEL SECURITY;

-- Admins can manage all transactions
CREATE POLICY admin_manage_buyer_credit_transactions ON buyer_credit_transactions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Buyers can view their own transactions
CREATE POLICY buyer_view_own_credit_transactions ON buyer_credit_transactions
  FOR SELECT
  TO authenticated
  USING (
    buyer_org_id = (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid() LIMIT 1
    )
  );

