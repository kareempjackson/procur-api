-- FSMA 204 Phase 2: Receiving CTE Records
-- A receiving confirmation documents the receiving Critical Tracking Event (CTE).
-- Buyers complete this when goods arrive, capturing FSMA 204 KDEs.

CREATE TABLE IF NOT EXISTS receiving_confirmations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  buyer_org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  seller_org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- FSMA 204 KDEs — Receiving CTE
  received_date         DATE NOT NULL,
  received_by           UUID REFERENCES users(id),
  receiving_facility    TEXT,
  receiving_country     TEXT NOT NULL DEFAULT 'GD',

  -- Per-item receiving details (JSONB array)
  -- Each element: { order_item_id, lot_code, quantity_received, condition_score (1-5), notes }
  items                 JSONB NOT NULL DEFAULT '[]',

  -- Condition assessment
  overall_condition     INTEGER CHECK (overall_condition BETWEEN 1 AND 5),
  temperature_on_arrival NUMERIC,         -- Celsius
  temperature_compliant  BOOLEAN,

  -- Rejection tracking
  has_rejection         BOOLEAN NOT NULL DEFAULT false,
  rejection_reason      TEXT,
  rejected_quantity     NUMERIC,
  rejected_unit         TEXT,

  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One confirmation per buyer per order
  CONSTRAINT one_receiving_per_order UNIQUE (order_id, buyer_org_id)
);

CREATE INDEX idx_receiving_order      ON receiving_confirmations(order_id);
CREATE INDEX idx_receiving_buyer_org  ON receiving_confirmations(buyer_org_id);
CREATE INDEX idx_receiving_seller_org ON receiving_confirmations(seller_org_id);

-- Row Level Security
ALTER TABLE receiving_confirmations ENABLE ROW LEVEL SECURITY;

-- Buyer: full access to their own records
CREATE POLICY "receiving_buyer_all" ON receiving_confirmations
  FOR ALL
  USING (buyer_org_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Seller: read-only access to confirmations for their orders
CREATE POLICY "receiving_seller_read" ON receiving_confirmations
  FOR SELECT
  USING (seller_org_id = (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Admin: full access
CREATE POLICY "receiving_admin_all" ON receiving_confirmations
  FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND account_type = 'admin'));
