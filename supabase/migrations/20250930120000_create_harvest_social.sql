-- Harvest social features: comments and buyer requests on harvest updates

-- Comments on harvest updates by buyers
CREATE TABLE IF NOT EXISTS harvest_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  harvest_id UUID NOT NULL REFERENCES harvest_requests(id) ON DELETE CASCADE,
  buyer_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  buyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_harvest_comments_harvest ON harvest_comments(harvest_id);
CREATE INDEX IF NOT EXISTS idx_harvest_comments_created_at ON harvest_comments(created_at);

-- Buyer requests against a specific harvest update
CREATE TABLE IF NOT EXISTS harvest_buyer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  harvest_id UUID NOT NULL REFERENCES harvest_requests(id) ON DELETE CASCADE,
  seller_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  buyer_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  buyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  requested_quantity NUMERIC NOT NULL,
  unit VARCHAR(50) NOT NULL,
  requested_date DATE,
  notes TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending | acknowledged_yes | acknowledged_no
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES users(id),
  seller_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_harvest_buyer_requests_harvest ON harvest_buyer_requests(harvest_id);
CREATE INDEX IF NOT EXISTS idx_harvest_buyer_requests_seller ON harvest_buyer_requests(seller_org_id);
CREATE INDEX IF NOT EXISTS idx_harvest_buyer_requests_buyer ON harvest_buyer_requests(buyer_org_id);
CREATE INDEX IF NOT EXISTS idx_harvest_buyer_requests_created_at ON harvest_buyer_requests(created_at);

-- Optional: counters on harvest_requests for quick display
ALTER TABLE harvest_requests
  ADD COLUMN IF NOT EXISTS comments_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requests_count INTEGER NOT NULL DEFAULT 0;

-- Triggers to maintain counters
CREATE OR REPLACE FUNCTION increment_harvest_comments_count() RETURNS TRIGGER AS $$
BEGIN
  UPDATE harvest_requests SET comments_count = comments_count + 1 WHERE id = NEW.harvest_id;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_harvest_comments_count() RETURNS TRIGGER AS $$
BEGIN
  UPDATE harvest_requests SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.harvest_id;
  RETURN OLD;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inc_harvest_comments ON harvest_comments;
CREATE TRIGGER trg_inc_harvest_comments AFTER INSERT ON harvest_comments
FOR EACH ROW EXECUTE FUNCTION increment_harvest_comments_count();

DROP TRIGGER IF EXISTS trg_dec_harvest_comments ON harvest_comments;
CREATE TRIGGER trg_dec_harvest_comments AFTER DELETE ON harvest_comments
FOR EACH ROW EXECUTE FUNCTION decrement_harvest_comments_count();

CREATE OR REPLACE FUNCTION increment_harvest_requests_count() RETURNS TRIGGER AS $$
BEGIN
  UPDATE harvest_requests SET requests_count = requests_count + 1 WHERE id = NEW.harvest_id;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_harvest_requests_count() RETURNS TRIGGER AS $$
BEGIN
  UPDATE harvest_requests SET requests_count = GREATEST(requests_count - 1, 0) WHERE id = OLD.harvest_id;
  RETURN OLD;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inc_harvest_buyer_requests ON harvest_buyer_requests;
CREATE TRIGGER trg_inc_harvest_buyer_requests AFTER INSERT ON harvest_buyer_requests
FOR EACH ROW EXECUTE FUNCTION increment_harvest_requests_count();

DROP TRIGGER IF EXISTS trg_dec_harvest_buyer_requests ON harvest_buyer_requests;
CREATE TRIGGER trg_dec_harvest_buyer_requests AFTER DELETE ON harvest_buyer_requests
FOR EACH ROW EXECUTE FUNCTION decrement_harvest_requests_count();


