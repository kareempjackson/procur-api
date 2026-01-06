-- Add marketplace visibility flag to organizations (seller-level hide/show)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_hidden_from_marketplace BOOLEAN NOT NULL DEFAULT false;


