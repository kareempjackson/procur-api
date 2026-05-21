-- Seed the 'process_refunds' permission row and grant it to existing admin roles.
--
-- This file MUST be separate from 20260428100700_add_process_refunds_permission.sql:
-- Postgres forbids referencing an enum value in the same transaction in which it was added.
-- Splitting the ALTER TYPE and the seed into two migration files puts them in separate
-- transactions when applied via `supabase db push`.
--
-- Safe to run multiple times via ON CONFLICT.

INSERT INTO system_permissions (name, display_name, description, category)
VALUES (
  'process_refunds',
  'Process Refunds',
  'Issue refunds to buyers including Stripe card refunds and Procur credit',
  'finance'
)
ON CONFLICT (name) DO NOTHING;

-- Grant to every role that already holds 'manage_payments' so existing admins don't get 403s
-- on day one. New orgs created after this migration receive it via the existing org-creation
-- trigger (which grants all is_active permissions to the admin role).
INSERT INTO role_system_permissions (role_id, permission_id)
SELECT DISTINCT rsp.role_id, sp_new.id
FROM role_system_permissions rsp
JOIN system_permissions sp_existing ON sp_existing.id = rsp.permission_id
CROSS JOIN system_permissions sp_new
WHERE sp_existing.name = 'manage_payments'
  AND sp_new.name = 'process_refunds'
ON CONFLICT DO NOTHING;
