-- FSMA 204 Phase 2: Packing CTE Records
-- A packing record documents the packing Critical Tracking Event (CTE) for a harvest batch.
-- It is linked to a harvest_log and captures the Key Data Elements (KDEs) required by FSMA 204.

CREATE TABLE IF NOT EXISTS packing_records (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  harvest_log_id           UUID NOT NULL REFERENCES harvest_logs(id) ON DELETE CASCADE,
  seller_org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- FSMA 204 KDEs — Packing CTE
  packing_date             DATE NOT NULL,
  packing_facility_name    TEXT NOT NULL,
  packing_facility_address TEXT,
  packing_facility_country TEXT NOT NULL DEFAULT 'GD',
  quantity_packed          NUMERIC,
  unit                     TEXT,

  -- Export / shipping context
  ship_to_country          TEXT,
  transport_mode           TEXT,          -- 'air' | 'sea' | 'road'
  carrier_name             TEXT,
  bill_of_lading           TEXT,
  expected_ship_date       DATE,

  notes                    TEXT,
  responsible_party        UUID REFERENCES users(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_packing_records_harvest_log ON packing_records(harvest_log_id);
CREATE INDEX idx_packing_records_seller_org  ON packing_records(seller_org_id);

-- Row Level Security
ALTER TABLE packing_records ENABLE ROW LEVEL SECURITY;

-- Seller: full access to their own records
CREATE POLICY "packing_seller_select" ON packing_records
  FOR SELECT
  USING (seller_org_id IN (SELECT organization_id FROM organization_users WHERE user_id = auth.uid()));

CREATE POLICY "packing_seller_insert" ON packing_records
  FOR INSERT
  WITH CHECK (seller_org_id IN (SELECT organization_id FROM organization_users WHERE user_id = auth.uid()));

CREATE POLICY "packing_seller_update" ON packing_records
  FOR UPDATE
  USING (seller_org_id IN (SELECT organization_id FROM organization_users WHERE user_id = auth.uid()));

CREATE POLICY "packing_seller_delete" ON packing_records
  FOR DELETE
  USING (seller_org_id IN (SELECT organization_id FROM organization_users WHERE user_id = auth.uid()));

-- Admin: full access
CREATE POLICY "packing_admin_all" ON packing_records
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Public read — needed for chain-of-custody QR lookup (service-role client bypasses RLS)
-- Expose limited data via API, not directly to anon clients
