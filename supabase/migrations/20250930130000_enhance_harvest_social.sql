-- Enhance harvest_requests for social feed features

-- Add social feed fields to harvest_requests
ALTER TABLE harvest_requests
  ADD COLUMN IF NOT EXISTS content TEXT, -- Main post content/description
  ADD COLUMN IF NOT EXISTS images TEXT[], -- Array of image URLs
  ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(32) NOT NULL DEFAULT 'public', -- public | followers | private
  ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'active', -- active | archived | deleted
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Create index for status and visibility
CREATE INDEX IF NOT EXISTS idx_harvest_requests_status ON harvest_requests(status);
CREATE INDEX IF NOT EXISTS idx_harvest_requests_visibility ON harvest_requests(visibility);

-- Create harvest_likes table for social likes feature
CREATE TABLE IF NOT EXISTS harvest_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  harvest_id UUID NOT NULL REFERENCES harvest_requests(id) ON DELETE CASCADE,
  buyer_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  buyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(harvest_id, buyer_org_id) -- One like per organization per harvest
);

CREATE INDEX IF NOT EXISTS idx_harvest_likes_harvest ON harvest_likes(harvest_id);
CREATE INDEX IF NOT EXISTS idx_harvest_likes_buyer_org ON harvest_likes(buyer_org_id);
CREATE INDEX IF NOT EXISTS idx_harvest_likes_created_at ON harvest_likes(created_at);

-- Triggers to maintain likes counter
CREATE OR REPLACE FUNCTION increment_harvest_likes_count() RETURNS TRIGGER AS $$
BEGIN
  UPDATE harvest_requests SET likes_count = likes_count + 1 WHERE id = NEW.harvest_id;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_harvest_likes_count() RETURNS TRIGGER AS $$
BEGIN
  UPDATE harvest_requests SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.harvest_id;
  RETURN OLD;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inc_harvest_likes ON harvest_likes;
CREATE TRIGGER trg_inc_harvest_likes AFTER INSERT ON harvest_likes
FOR EACH ROW EXECUTE FUNCTION increment_harvest_likes_count();

DROP TRIGGER IF EXISTS trg_dec_harvest_likes ON harvest_likes;
CREATE TRIGGER trg_dec_harvest_likes AFTER DELETE ON harvest_likes
FOR EACH ROW EXECUTE FUNCTION decrement_harvest_likes_count();

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_harvest_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_harvest_updated_at ON harvest_requests;
CREATE TRIGGER trg_update_harvest_updated_at BEFORE UPDATE ON harvest_requests
FOR EACH ROW EXECUTE FUNCTION update_harvest_updated_at();

