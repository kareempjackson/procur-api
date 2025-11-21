-- Add farm verification flags to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS farmers_id_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS farm_verified BOOLEAN NOT NULL DEFAULT false;


