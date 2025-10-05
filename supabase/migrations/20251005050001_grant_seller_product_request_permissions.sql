-- Add seller product request permissions (Step 2: Insert and grant permissions)
-- This must run after the enum values have been committed

-- Insert permissions into system_permissions table
INSERT INTO system_permissions (name, display_name, description, category) VALUES
('view_product_requests', 'View Product Requests', 'View buyer product requests (RFQs)', 'procurement'),
('submit_product_quotes', 'Submit Product Quotes', 'Submit quotes in response to product requests', 'procurement')
ON CONFLICT (name) DO NOTHING;

-- Grant permissions to sales_manager role for seller organizations
INSERT INTO role_system_permissions (role_id, permission_id)
SELECT r.id, sp.id 
FROM organization_roles r
JOIN organizations o ON r.organization_id = o.id
JOIN system_permissions sp ON sp.name IN ('view_product_requests', 'submit_product_quotes')
WHERE o.account_type = 'seller' 
AND r.name = 'sales_manager'
AND sp.is_active = true
ON CONFLICT DO NOTHING;

-- Grant permissions to owner role for seller organizations
INSERT INTO role_system_permissions (role_id, permission_id)
SELECT r.id, sp.id 
FROM organization_roles r
JOIN organizations o ON r.organization_id = o.id
JOIN system_permissions sp ON sp.name IN ('view_product_requests', 'submit_product_quotes')
WHERE o.account_type = 'seller' 
AND r.name = 'owner'
AND sp.is_active = true
ON CONFLICT DO NOTHING;

