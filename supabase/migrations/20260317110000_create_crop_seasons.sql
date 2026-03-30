-- FSMA 204 Phase 3: Crop Seasonal Calendar
-- Sellers record typical planting and harvest months per crop.
-- Used to generate the seasonal availability calendar and demand forecasts.

CREATE TABLE IF NOT EXISTS crop_seasons (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  crop                      TEXT NOT NULL,
  variety                   TEXT,

  -- Planting window (optional — not all crops are manually planted)
  plant_month_start         INTEGER CHECK (plant_month_start BETWEEN 1 AND 12),
  plant_month_end           INTEGER CHECK (plant_month_end BETWEEN 1 AND 12),

  -- Harvest window (required)
  harvest_month_start       INTEGER NOT NULL CHECK (harvest_month_start BETWEEN 1 AND 12),
  harvest_month_end         INTEGER NOT NULL CHECK (harvest_month_end BETWEEN 1 AND 12),

  -- Yield estimate
  typical_yield_kg_per_acre NUMERIC,

  notes                     TEXT,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One season record per crop+variety per org (expression-based unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_crop_seasons_unique_crop
  ON crop_seasons (org_id, crop, COALESCE(variety, ''));

CREATE INDEX idx_crop_seasons_org ON crop_seasons(org_id);

-- Row Level Security
ALTER TABLE crop_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seasons_seller_all" ON crop_seasons
  FOR ALL
  USING (org_id IN (SELECT organization_id FROM organization_users WHERE user_id = auth.uid()));

CREATE POLICY "seasons_admin_all" ON crop_seasons
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Public read — buyers can see seasonal availability calendars on marketplace
CREATE POLICY "seasons_public_read" ON crop_seasons
  FOR SELECT USING (true);
