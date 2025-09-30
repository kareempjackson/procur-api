-- Create table for harvest requests/updates by sellers
CREATE TABLE IF NOT EXISTS harvest_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  crop VARCHAR(255) NOT NULL,
  expected_harvest_window VARCHAR(255),
  quantity NUMERIC,
  unit VARCHAR(50),
  notes TEXT,
  next_planting_crop VARCHAR(255),
  next_planting_date DATE,
  next_planting_area VARCHAR(255),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_harvest_requests_seller_org ON harvest_requests(seller_org_id);
CREATE INDEX IF NOT EXISTS idx_harvest_requests_created_at ON harvest_requests(created_at);

