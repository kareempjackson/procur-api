-- Direct-deposit clearing flow: inspection fields + secure farmer bank info

-- 1) Orders: inspection / admin approval metadata
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS inspection_status VARCHAR(32),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by_admin_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approval_notes TEXT;

-- 2) Farmer bank info vault (encrypted)
CREATE TABLE IF NOT EXISTS farmer_bank_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  encrypted_account_number TEXT NOT NULL,
  encrypted_account_name TEXT NOT NULL,
  encrypted_bank_name TEXT NOT NULL,
  encrypted_bank_branch TEXT,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure one active bank record per farmer org
CREATE UNIQUE INDEX IF NOT EXISTS idx_farmer_bank_info_org
  ON farmer_bank_info(farmer_org_id);

-- Reuse generic updated_at trigger if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE TRIGGER update_farmer_bank_info_updated_at
    BEFORE UPDATE ON farmer_bank_info
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$ LANGUAGE plpgsql;


