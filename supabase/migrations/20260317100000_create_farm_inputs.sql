-- FSMA 204 Phase 3: Farm Input Tracking
-- Records every agricultural input (fertilizer, pesticide, herbicide, seed, irrigation)
-- applied to plots. The withdrawal_period_days field drives harvest safety warnings.

CREATE TABLE IF NOT EXISTS farm_inputs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plot_id                UUID REFERENCES farm_plots(id) ON DELETE SET NULL,

  -- Input classification
  input_type             TEXT NOT NULL CHECK (input_type IN (
                           'fertilizer', 'pesticide', 'herbicide', 'seed', 'irrigation', 'other'
                         )),
  product_name           TEXT NOT NULL,
  brand                  TEXT,
  active_ingredient      TEXT,          -- e.g. "Chlorpyrifos 48%" for regulatory compliance

  -- Application details
  application_date       DATE NOT NULL,
  quantity               NUMERIC,
  unit                   TEXT,          -- 'liters', 'kg', 'g', etc.

  -- Safety: days after application before safe to harvest
  -- Harvest log creation will warn if applied within this window
  withdrawal_period_days INTEGER NOT NULL DEFAULT 0,

  applied_by             UUID REFERENCES users(id),
  notes                  TEXT,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_farm_inputs_org_id   ON farm_inputs(org_id);
CREATE INDEX idx_farm_inputs_plot_id  ON farm_inputs(plot_id);
CREATE INDEX idx_farm_inputs_app_date ON farm_inputs(application_date);

-- Row Level Security
ALTER TABLE farm_inputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inputs_seller_all" ON farm_inputs
  FOR ALL
  USING (org_id IN (SELECT organization_id FROM organization_users WHERE user_id = auth.uid()));

CREATE POLICY "inputs_admin_all" ON farm_inputs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
