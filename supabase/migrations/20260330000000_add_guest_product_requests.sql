-- Migration: Add guest product request support
-- Description: Adds guest columns and relaxes NOT NULL constraints on buyer IDs
--              so unauthenticated visitors can submit product requests via the bot.
-- Date: 2026-03-30

-- ==================== ALTER TABLE: Make buyer IDs nullable for guests ====================

ALTER TABLE product_requests
  ALTER COLUMN buyer_org_id DROP NOT NULL,
  ALTER COLUMN buyer_user_id DROP NOT NULL;

-- ==================== ADD GUEST COLUMNS ====================

ALTER TABLE product_requests
  ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS guest_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS guest_email VARCHAR(255);

-- ==================== RELAX unit_of_measurement type for guest free-text input ====================

-- Guest bot sends free-text units (e.g. "lbs", "bags") rather than the strict enum.
-- Change from measurement_unit enum to varchar so both flows work.
ALTER TABLE product_requests
  ALTER COLUMN unit_of_measurement TYPE VARCHAR(50) USING unit_of_measurement::TEXT;

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_product_requests_is_guest
  ON product_requests(is_guest)
  WHERE is_guest = TRUE;

CREATE INDEX IF NOT EXISTS idx_product_requests_guest_email
  ON product_requests(guest_email)
  WHERE guest_email IS NOT NULL;

-- ==================== CONSTRAINTS ====================

-- Ensure guest requests have contact info, authenticated requests have buyer IDs
ALTER TABLE product_requests
  ADD CONSTRAINT guest_or_authenticated CHECK (
    (is_guest = FALSE AND buyer_org_id IS NOT NULL AND buyer_user_id IS NOT NULL)
    OR
    (is_guest = TRUE AND guest_name IS NOT NULL AND guest_email IS NOT NULL)
  );

-- ==================== RLS POLICIES ====================

-- Allow unauthenticated inserts for guest requests (API uses service role,
-- but this policy documents intent and allows direct Supabase client usage)
CREATE POLICY product_requests_guest_insert ON product_requests
  FOR INSERT
  WITH CHECK (is_guest = TRUE AND guest_name IS NOT NULL AND guest_email IS NOT NULL);

-- Admin can view all requests including guest ones (via service role)
-- No additional RLS needed since the NestJS API bypasses RLS with the service key.

-- ==================== COMMENTS ====================

COMMENT ON COLUMN product_requests.is_guest IS 'True if submitted by an unauthenticated visitor via the assistant bot';
COMMENT ON COLUMN product_requests.guest_name IS 'Name provided by guest visitor';
COMMENT ON COLUMN product_requests.guest_email IS 'Email for following up with guest visitor';
