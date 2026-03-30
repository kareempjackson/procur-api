-- Seed government dev login user: admin@agriculture.gov
-- Password: password123 (same as other dev users)
-- Hash: $2b$10$uEWMFHkapY3MOrKIGbji2eDMpib0DEm.y7OjGJFocB7oBcewLOvfW

-- ==================== GOVERNMENT DEV ORGANIZATION ====================

INSERT INTO organizations (
  id, name, business_name, account_type, business_type, address, country, phone_number,
  business_registration_number, tax_id, government_level, department, jurisdiction, status
) VALUES (
  '660e8400-e29b-41d4-a716-446655440100',
  'Grenada Ministry of Agriculture (Dev)',
  'Ministry of Agriculture Grenada',
  'government',
  'general',
  'Botanical Gardens, Tanteen, St. Georges',
  'Grenada',
  '+1-473-440-2700',
  'GOV-GRD-DEV-001',
  'TAX-GOV-DEV-001',
  'national',
  'agriculture',
  'Grenada',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- ==================== GOVERNMENT DEV USER ====================

INSERT INTO users (
  id, email, password, fullname, phone_number, profile_img, personal_address, country,
  role, individual_account_type, email_verified, is_active
) VALUES (
  '550e8400-e29b-41d4-a716-446655440100',
  'admin@agriculture.gov',
  '$2b$10$uEWMFHkapY3MOrKIGbji2eDMpib0DEm.y7OjGJFocB7oBcewLOvfW',
  'Gov Admin (Dev)',
  '+1-473-440-2700',
  NULL,
  'Botanical Gardens, Tanteen, St. Georges',
  'Grenada',
  'admin',
  NULL,
  true,
  true
)
ON CONFLICT (id) DO UPDATE SET
  password = '$2b$10$uEWMFHkapY3MOrKIGbji2eDMpib0DEm.y7OjGJFocB7oBcewLOvfW',
  email_verified = true,
  is_active = true;

-- Handle conflict on email in case ID differs
UPDATE users SET
  password = '$2b$10$uEWMFHkapY3MOrKIGbji2eDMpib0DEm.y7OjGJFocB7oBcewLOvfW',
  email_verified = true,
  is_active = true
WHERE email = 'admin@agriculture.gov'
  AND id != '550e8400-e29b-41d4-a716-446655440100';

-- ==================== LINK USER TO ORGANIZATION ====================

INSERT INTO organization_users (organization_id, user_id, role_id, is_active, joined_at)
SELECT
  '660e8400-e29b-41d4-a716-446655440100',
  u.id,
  r.id,
  true,
  NOW() - INTERVAL '30 days'
FROM users u, organization_roles r
WHERE u.email = 'admin@agriculture.gov'
  AND r.organization_id = '660e8400-e29b-41d4-a716-446655440100'
  AND r.name = 'admin'
ON CONFLICT (organization_id, user_id) DO NOTHING;
