-- Migration: Create farm_profiles and farm_plots tables for FSMA 204 traceability.
--
-- farm_profiles: 1:1 with organizations (seller orgs only). Stores farm location,
--   acreage, primary crops, and certifications. Foundation of the FSMA 204 origin record.
--
-- farm_plots: Named growing areas within a farm (e.g. "North Field", "Greenhouse A").
--   Allows lot codes to be tied to a specific field, not just a farm.

-- ─── farm_profiles ───────────────────────────────────────────────────────────

CREATE TABLE farm_profiles (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  -- Location (FSMA 204 requires farm origin — GPS or parish/district)
  gps_lat         NUMERIC(10, 7),
  gps_lng         NUMERIC(10, 7),
  parish          TEXT,                   -- Caribbean-specific administrative area
  country         TEXT        NOT NULL DEFAULT 'AG',
  -- Farm attributes
  total_acreage   NUMERIC(8, 2),
  primary_crops   TEXT[],                 -- e.g. ARRAY['plantain', 'bok choi', 'pumpkin']
  -- Certifications stored as JSONB array: [{type, certifier, number, issued, expires, document_url}]
  certifications  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_farm_profiles_org_id ON farm_profiles(org_id);

COMMENT ON TABLE  farm_profiles IS 'Farm-level details for FSMA 204 origin records. One per seller organization.';
COMMENT ON COLUMN farm_profiles.certifications IS 'Array of certification objects: [{type, certifier, number, issued, expires, document_url}]';

-- ─── farm_plots ──────────────────────────────────────────────────────────────

CREATE TABLE farm_plots (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_profile_id UUID        NOT NULL REFERENCES farm_profiles(id) ON DELETE CASCADE,
  org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,   -- "North Field", "Greenhouse A", "Plot B"
  description     TEXT,
  area_acreage    NUMERIC(8, 2),
  gps_lat         NUMERIC(10, 7),
  gps_lng         NUMERIC(10, 7),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_farm_plots_farm_profile_id ON farm_plots(farm_profile_id);
CREATE INDEX idx_farm_plots_org_id          ON farm_plots(org_id);

COMMENT ON TABLE farm_plots IS 'Named growing areas within a farm. Used to tie harvest lots to a specific field.';

-- ─── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE farm_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_plots    ENABLE ROW LEVEL SECURITY;

-- Sellers: full access to their own records
CREATE POLICY farm_profiles_seller_own ON farm_profiles
  FOR ALL TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY farm_plots_seller_own ON farm_plots
  FOR ALL TO authenticated
  USING (
    org_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

-- Admins: full access
CREATE POLICY farm_profiles_admin ON farm_profiles
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY farm_plots_admin ON farm_plots
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Public read on farm_profiles (for marketplace product pages showing farm origin)
CREATE POLICY farm_profiles_public_read ON farm_profiles
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY farm_plots_public_read ON farm_plots
  FOR SELECT TO anon, authenticated
  USING (true);
