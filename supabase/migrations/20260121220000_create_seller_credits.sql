-- Clean up any partial state from failed migration attempts
DO $$ 
BEGIN
  -- Drop policies if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'seller_credit_transactions') THEN
    DROP POLICY IF EXISTS seller_view_own_credit_transactions ON seller_credit_transactions;
    DROP POLICY IF EXISTS admin_all_seller_credit_transactions ON seller_credit_transactions;
  END IF;
END $$;

DROP FUNCTION IF EXISTS adjust_seller_credit(UUID, BIGINT, VARCHAR, VARCHAR, TEXT, VARCHAR, UUID, UUID);
DROP TABLE IF EXISTS seller_credit_transactions;

-- Add credits column to seller_balances
ALTER TABLE seller_balances
ADD COLUMN IF NOT EXISTS credit_amount_cents BIGINT NOT NULL DEFAULT 0;

-- Create seller credit transactions table to track history
CREATE TABLE IF NOT EXISTS seller_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_org_id UUID NOT NULL REFERENCES organizations(id),
  amount_cents BIGINT NOT NULL, -- positive for credits, negative for debits
  balance_after_cents BIGINT NOT NULL, -- running balance after this transaction
  type VARCHAR(32) NOT NULL, -- 'credit' or 'debit'
  reason VARCHAR(255) NOT NULL, -- e.g., 'change_owed', 'overpayment', 'adjustment', 'payout_deduction'
  note TEXT,
  reference VARCHAR(128), -- optional external reference
  order_id UUID REFERENCES orders(id), -- optional link to an order
  created_by UUID REFERENCES users(id), -- admin who created this
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_seller_credit_transactions_seller_org_id 
  ON seller_credit_transactions(seller_org_id);
CREATE INDEX IF NOT EXISTS idx_seller_credit_transactions_created_at 
  ON seller_credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seller_credit_transactions_order_id 
  ON seller_credit_transactions(order_id) WHERE order_id IS NOT NULL;

-- Enable RLS
ALTER TABLE seller_credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can do everything
CREATE POLICY admin_all_seller_credit_transactions ON seller_credit_transactions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role = 'admin'
    )
  );

-- Sellers can view their own credit transactions
CREATE POLICY seller_view_own_credit_transactions ON seller_credit_transactions
  FOR SELECT
  TO authenticated
  USING (
    seller_org_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

-- Function to add/adjust seller credit
CREATE OR REPLACE FUNCTION adjust_seller_credit(
  p_seller_org_id UUID,
  p_amount_cents BIGINT,
  p_type VARCHAR(32),
  p_reason VARCHAR(255),
  p_note TEXT DEFAULT NULL,
  p_reference VARCHAR(128) DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_admin_user_id UUID DEFAULT NULL
)
RETURNS TABLE(transaction_id UUID, new_balance_cents BIGINT) AS $$
DECLARE
  v_new_balance BIGINT;
  v_tx_id UUID;
BEGIN
  -- Upsert seller balance
  INSERT INTO seller_balances (seller_org_id, credit_amount_cents)
  VALUES (p_seller_org_id, p_amount_cents)
  ON CONFLICT (seller_org_id)
  DO UPDATE SET
    credit_amount_cents = seller_balances.credit_amount_cents + p_amount_cents,
    updated_at = NOW();
  
  -- Get new balance
  SELECT credit_amount_cents INTO v_new_balance
  FROM seller_balances
  WHERE seller_org_id = p_seller_org_id;
  
  -- Insert transaction record
  INSERT INTO seller_credit_transactions (
    seller_org_id,
    amount_cents,
    balance_after_cents,
    type,
    reason,
    note,
    reference,
    order_id,
    created_by
  ) VALUES (
    p_seller_org_id,
    p_amount_cents,
    v_new_balance,
    p_type,
    p_reason,
    p_note,
    p_reference,
    p_order_id,
    p_admin_user_id
  )
  RETURNING id INTO v_tx_id;
  
  RETURN QUERY SELECT v_tx_id, v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (the function has internal permission checks)
GRANT EXECUTE ON FUNCTION adjust_seller_credit TO authenticated;

COMMENT ON TABLE seller_credit_transactions IS 'Tracks all credit adjustments for seller accounts';
COMMENT ON COLUMN seller_credit_transactions.amount_cents IS 'Positive for credits added, negative for debits/deductions';
COMMENT ON COLUMN seller_credit_transactions.type IS 'Either credit (adding) or debit (subtracting)';
COMMENT ON COLUMN seller_credit_transactions.reason IS 'Reason code: change_owed, overpayment, adjustment, payout_deduction, etc.';

