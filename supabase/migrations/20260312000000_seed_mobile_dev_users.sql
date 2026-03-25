-- Ensure mobile dev login users exist with real bcrypt-hashed passwords
-- Password for both users: password123
-- Hash verified with bcryptjs (same library the API uses)
-- $2b$10$uEWMFHkapY3MOrKIGbji2eDMpib0DEm.y7OjGJFocB7oBcewLOvfW

-- ==================== UPSERT DEV ORGANIZATIONS ====================

-- Seller org: Green Valley Farms
INSERT INTO organizations (
  id, name, business_name, account_type, business_type, address, country, phone_number,
  business_registration_number, tax_id, government_level, department, jurisdiction, status
) VALUES (
  '660e8400-e29b-41d4-a716-446655440003',
  'Green Valley Farms',
  'Green Valley Farms LLC',
  'seller',
  'farmers',
  '100 Farm Road, Cedar Rapids IA 52402',
  'United States',
  '+1-319-555-0200',
  'BUS-GVF-001',
  'TAX-GVF-001',
  NULL, NULL, NULL,
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- Buyer org: Fine Dining Restaurant Group
INSERT INTO organizations (
  id, name, business_name, account_type, business_type, address, country, phone_number,
  business_registration_number, tax_id, government_level, department, jurisdiction, status
) VALUES (
  '660e8400-e29b-41d4-a716-446655440007',
  'Fine Dining Restaurant Group',
  'Fine Dining Group LLC',
  'buyer',
  'restaurants',
  '400 Culinary Ave, New York NY 10001',
  'United States',
  '+1-212-555-0500',
  'BUS-FDG-001',
  'TAX-FDG-001',
  NULL, NULL, NULL,
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- ==================== UPSERT DEV USERS ====================

-- Seller dev user: john@greenfarms.com
INSERT INTO users (
  id, email, password, fullname, phone_number, profile_img, personal_address, country,
  role, individual_account_type, email_verified, is_active
) VALUES (
  '550e8400-e29b-41d4-a716-446655440004',
  'john@greenfarms.com',
  '$2b$10$uEWMFHkapY3MOrKIGbji2eDMpib0DEm.y7OjGJFocB7oBcewLOvfW',
  'John Smith',
  '+1-555-0201',
  NULL,
  '100 Farm Road, Iowa',
  'United States',
  'user',
  NULL,
  true,
  true
)
ON CONFLICT (id) DO UPDATE SET
  password = '$2b$10$uEWMFHkapY3MOrKIGbji2eDMpib0DEm.y7OjGJFocB7oBcewLOvfW',
  email_verified = true,
  is_active = true;

-- Also handle conflict on email in case ID differs
UPDATE users SET
  password = '$2b$10$uEWMFHkapY3MOrKIGbji2eDMpib0DEm.y7OjGJFocB7oBcewLOvfW',
  email_verified = true,
  is_active = true
WHERE email = 'john@greenfarms.com'
  AND id != '550e8400-e29b-41d4-a716-446655440004';

-- Buyer dev user: chef@finedining.com
INSERT INTO users (
  id, email, password, fullname, phone_number, profile_img, personal_address, country,
  role, individual_account_type, email_verified, is_active
) VALUES (
  '550e8400-e29b-41d4-a716-446655440008',
  'chef@finedining.com',
  '$2b$10$uEWMFHkapY3MOrKIGbji2eDMpib0DEm.y7OjGJFocB7oBcewLOvfW',
  'Antoine Dubois',
  '+1-555-0501',
  NULL,
  '400 Culinary Ave, New York',
  'United States',
  'user',
  NULL,
  true,
  true
)
ON CONFLICT (id) DO UPDATE SET
  password = '$2b$10$uEWMFHkapY3MOrKIGbji2eDMpib0DEm.y7OjGJFocB7oBcewLOvfW',
  email_verified = true,
  is_active = true;

-- Also handle conflict on email in case ID differs
UPDATE users SET
  password = '$2b$10$uEWMFHkapY3MOrKIGbji2eDMpib0DEm.y7OjGJFocB7oBcewLOvfW',
  email_verified = true,
  is_active = true
WHERE email = 'chef@finedining.com'
  AND id != '550e8400-e29b-41d4-a716-446655440008';

-- ==================== ENSURE ORGANIZATION MEMBERSHIPS EXIST ====================

-- Seller: john@greenfarms.com → Green Valley Farms
INSERT INTO organization_users (organization_id, user_id, role_id, is_active, joined_at)
SELECT
  '660e8400-e29b-41d4-a716-446655440003',
  u.id,
  r.id,
  true,
  NOW() - INTERVAL '30 days'
FROM users u, organization_roles r
WHERE u.email = 'john@greenfarms.com'
  AND r.organization_id = '660e8400-e29b-41d4-a716-446655440003'
  AND r.name = 'admin'
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Buyer: chef@finedining.com → Fine Dining Restaurant Group
INSERT INTO organization_users (organization_id, user_id, role_id, is_active, joined_at)
SELECT
  '660e8400-e29b-41d4-a716-446655440007',
  u.id,
  r.id,
  true,
  NOW() - INTERVAL '30 days'
FROM users u, organization_roles r
WHERE u.email = 'chef@finedining.com'
  AND r.organization_id = '660e8400-e29b-41d4-a716-446655440007'
  AND r.name = 'admin'
ON CONFLICT (organization_id, user_id) DO NOTHING;
