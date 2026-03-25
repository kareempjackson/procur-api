-- Migration: Add tlc_org_code to organizations for Traceability Lot Code generation.
--
-- tlc_org_code is a stable 4-character uppercase abbreviation of the organization name,
-- used as the {ORG4} segment in every TLC this seller generates.
-- e.g. "Green Valley Farms" → "GREE", "River Run Agriculture" → "RIVR"
--
-- The code is auto-derived from the org name on the first harvest log creation
-- and stored here so it never changes even if the org name is later updated.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS tlc_org_code TEXT;

COMMENT ON COLUMN organizations.tlc_org_code IS
  '4-char uppercase TLC org abbreviation used in Traceability Lot Codes. Auto-derived from org name on first harvest log. Immutable after first set.';
