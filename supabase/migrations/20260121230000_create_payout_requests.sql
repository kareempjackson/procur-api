-- Create payout_requests table for sellers to request payouts
CREATE TABLE IF NOT EXISTS payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    amount_cents BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'XCD',
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending, approved, rejected, completed
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    processed_by UUID REFERENCES users(id),
    proof_url TEXT, -- Bank transfer proof
    rejection_reason TEXT,
    note TEXT, -- Optional note from seller
    admin_note TEXT, -- Optional note from admin
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_payout_requests_seller_org_id ON payout_requests(seller_org_id);
CREATE INDEX idx_payout_requests_status ON payout_requests(status);
CREATE INDEX idx_payout_requests_requested_at ON payout_requests(requested_at DESC);

-- RLS for payout_requests
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

-- Admins can manage all payout requests
CREATE POLICY admin_manage_payout_requests ON payout_requests
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

-- Sellers can view their own payout requests
CREATE POLICY seller_view_own_payout_requests ON payout_requests
  FOR SELECT
  TO authenticated
  USING (
    seller_org_id = (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- Sellers can insert their own payout requests
CREATE POLICY seller_insert_own_payout_requests ON payout_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    seller_org_id = (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- Function to update seller balance when payout is completed
CREATE OR REPLACE FUNCTION complete_payout_request(
    p_request_id UUID,
    p_admin_id UUID,
    p_proof_url TEXT DEFAULT NULL,
    p_admin_note TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_seller_org_id UUID;
    v_amount_cents BIGINT;
    v_currency VARCHAR(3);
    v_current_balance BIGINT;
BEGIN
    -- Get the payout request details
    SELECT seller_org_id, amount_cents, currency 
    INTO v_seller_org_id, v_amount_cents, v_currency
    FROM payout_requests 
    WHERE id = p_request_id AND status = 'approved';
    
    IF v_seller_org_id IS NULL THEN
        RAISE EXCEPTION 'Payout request not found or not in approved status';
    END IF;
    
    -- Get current balance
    SELECT available_amount_cents INTO v_current_balance 
    FROM seller_balances 
    WHERE seller_org_id = v_seller_org_id;
    
    IF v_current_balance IS NULL OR v_current_balance < v_amount_cents THEN
        RAISE EXCEPTION 'Insufficient balance for payout';
    END IF;
    
    -- Update payout request status
    UPDATE payout_requests 
    SET 
        status = 'completed',
        completed_at = NOW(),
        processed_by = p_admin_id,
        proof_url = COALESCE(p_proof_url, proof_url),
        admin_note = COALESCE(p_admin_note, admin_note),
        updated_at = NOW()
    WHERE id = p_request_id;
    
    -- Deduct from seller balance
    UPDATE seller_balances 
    SET 
        available_amount_cents = available_amount_cents - v_amount_cents,
        updated_at = NOW()
    WHERE seller_org_id = v_seller_org_id;
END;
$$ LANGUAGE plpgsql;

