-- Seed a platform super_admin user for Procur
-- Email: kareem+admin@ghostsavvy.com
-- Password: 123456789  (bcrypt hash below)

INSERT INTO users (
  email,
  password,
  fullname,
  country,
  role,
  individual_account_type,
  email_verified,
  is_active
) VALUES (
  'kareem+admin@ghostsavvy.com',
  '$2b$12$g/YErIfpAmv7jOQMNZnYA.nk49b03OIosBK1Zz/QUqDZWAblChzgi', -- bcrypt hash for '123456789'
  'Kareem Jackson',
  'Grenada',
  'super_admin',
  NULL,
  TRUE,
  TRUE
)
ON CONFLICT (email) DO UPDATE SET
  password = EXCLUDED.password,
  fullname = EXCLUDED.fullname,
  country = EXCLUDED.country,
  role = EXCLUDED.role,
  email_verified = EXCLUDED.email_verified,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();


