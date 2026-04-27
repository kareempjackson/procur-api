-- Seed a development-only agroprocessor user + organization.
-- Mirrors the existing seed pattern in 20250928160000_seed_database.sql so
-- the /auth/dev-signin endpoint can issue tokens as this user in non-prod.
--
-- Login email: processor@harvestkitchen.com
-- Org:         Harvest Kitchen Co.
--
-- The password hash is a placeholder — /auth/dev-signin bypasses the
-- password check. This user cannot sign in via the regular /auth/signin.

-- ==================== USER ====================

INSERT INTO users (
  id, email, password, fullname, phone_number, profile_img, personal_address,
  country, role, individual_account_type, email_verified, is_active
) VALUES (
  '550e8400-e29b-41d4-a716-446655440020',
  'processor@harvestkitchen.com',
  '$2b$10$hash20',
  'Harvey Preston',
  '+1-473-555-1100',
  'https://example.com/profiles/harvey.jpg',
  '12 Waterfront Row, St. George''s, Grenada',
  'Grenada',
  'user',
  NULL,
  true,
  true
)
ON CONFLICT (email) DO NOTHING;

-- ==================== ORGANIZATION ====================

-- Create the agroprocessor org. The BEFORE INSERT trigger on organizations
-- (set_organization_slug) auto-generates a slug, and the AFTER INSERT
-- trigger (create_default_roles_for_organization) creates admin, staff,
-- sourcing_manager, and sales_manager roles.
INSERT INTO organizations (
  id, name, business_name, account_type, business_type,
  address, country, phone_number,
  business_registration_number, tax_id,
  status
) VALUES (
  '660e8400-e29b-41d4-a716-446655440020',
  'Harvest Kitchen Co.',
  'Harvest Kitchen Processing Ltd',
  'agroprocessor',
  'food_processor',
  '12 Waterfront Row, St. George''s',
  'Grenada',
  '+1-473-555-1100',
  'BUS-HKC-001',
  'TAX-HKC-001',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- ==================== MEMBERSHIP ====================

-- Link the seed user to the org as admin. The admin role is auto-created
-- by the create_default_roles_for_organization() trigger on org insert.
INSERT INTO organization_users (organization_id, user_id, role_id, is_active, joined_at)
SELECT
  '660e8400-e29b-41d4-a716-446655440020',
  '550e8400-e29b-41d4-a716-446655440020',
  r.id,
  true,
  NOW() - INTERVAL '30 days'
FROM organization_roles r
WHERE r.organization_id = '660e8400-e29b-41d4-a716-446655440020'
  AND r.name = 'admin'
ON CONFLICT (organization_id, user_id) DO NOTHING;

COMMENT ON TABLE organizations IS
  'Organizations table. Dev user processor@harvestkitchen.com belongs to org 660e8400-...440020 (agroprocessor).';
