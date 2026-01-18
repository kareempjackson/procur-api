-- Add payout method preference to organizations (seller payout settings)
-- Current supported values: cash | cheque
-- Bank connection will be added later; keep schema flexible with TEXT + constraint.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS payout_method TEXT NOT NULL DEFAULT 'cash';

-- Backfill in case the column existed but had nulls
UPDATE organizations
SET payout_method = 'cash'
WHERE payout_method IS NULL OR payout_method = '';

-- Add a constraint (only if it doesn't already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_payout_method_check'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_payout_method_check
      CHECK (payout_method IN ('cash', 'cheque'));
  END IF;
END $$;


