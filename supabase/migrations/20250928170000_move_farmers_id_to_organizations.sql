-- Migration: Move farmers_id from users to organizations as TEXT
-- Safe to run multiple times due to IF EXISTS / IF NOT EXISTS guards

-- 1) Add column to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS farmers_id TEXT;

-- 2) Migrate existing data from users -> organizations (if any)
--    Uses any linked user record's farmers_id for its organization
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'farmers_id'
  ) THEN
    UPDATE organizations o
    SET farmers_id = s.farmers_id
    FROM (
      SELECT ou.organization_id, MAX(u.farmers_id) AS farmers_id
      FROM organization_users ou
      JOIN users u ON u.id = ou.user_id
      WHERE u.farmers_id IS NOT NULL AND u.farmers_id <> ''
      GROUP BY ou.organization_id
    ) AS s
    WHERE o.id = s.organization_id
      AND (o.farmers_id IS NULL OR o.farmers_id = '');
  END IF;
END $$;

-- 3) Drop column from users
ALTER TABLE users
  DROP COLUMN IF EXISTS farmers_id;


