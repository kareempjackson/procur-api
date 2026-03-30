-- Migration: Create country_interest table
-- Description: Tracks users who want Procur to expand to their country (submitted via assistant bot)
-- Date: 2026-03-30

CREATE TABLE IF NOT EXISTS country_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate submissions from same email for same country
  CONSTRAINT unique_country_email UNIQUE (country, email)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_country_interest_country ON country_interest(country);
CREATE INDEX IF NOT EXISTS idx_country_interest_created_at ON country_interest(created_at DESC);

-- RLS
ALTER TABLE country_interest ENABLE ROW LEVEL SECURITY;

-- Allow public inserts (API uses service role, but this documents intent)
CREATE POLICY country_interest_public_insert ON country_interest
  FOR INSERT
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE country_interest IS 'Tracks interest in Procur expanding to new countries';
COMMENT ON COLUMN country_interest.country IS 'Country name submitted by visitor';
COMMENT ON COLUMN country_interest.email IS 'Email to notify when Procur launches in that country';

ANALYZE country_interest;
