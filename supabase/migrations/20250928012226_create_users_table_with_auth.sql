-- Create enums for system-level permissions and categories
CREATE TYPE permission_category AS ENUM (
  'user_management',
  'procurement', 
  'reporting',
  'audit',
  'government',
  'organization',
  'inventory',
  'finance',
  'compliance',
  'custom'
);

CREATE TYPE system_permission AS ENUM (
  -- User Management
  'manage_users',
  'invite_users', 
  'view_users',
  'manage_roles',
  'deactivate_users',
  
  -- Procurement
  'create_rfp',
  'approve_purchases',
  'view_procurement',
  'manage_vendors',
  'create_purchase_orders',
  'approve_contracts',
  
  -- Reporting & Analytics
  'view_reports',
  'export_data',
  'view_audit_logs',
  'create_reports',
  'view_analytics',
  
  -- Government Specific
  'conduct_inspections',
  'issue_permits',
  'regulatory_oversight',
  'policy_management',
  'compliance_monitoring',
  'license_management',
  'manage_seller_accounts',
  
  -- Organization Management
  'manage_organization',
  'view_organization',
  'manage_settings',
  'manage_billing',
  
  -- Inventory Management
  'manage_inventory',
  'view_inventory',
  'track_shipments',
  'quality_control',
  
  -- Finance
  'manage_payments',
  'view_financial_reports',
  'approve_invoices',
  'manage_budgets'
);

CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');
CREATE TYPE account_type AS ENUM ('buyer', 'government', 'seller', 'driver', 'qa');
CREATE TYPE organization_status AS ENUM ('active', 'suspended', 'pending_verification');
CREATE TYPE permission_status AS ENUM ('pending', 'approved', 'denied', 'revoked');

-- Users table (MOVED TO TOP - must be created before other tables reference it)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  fullname VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20),
  profile_img TEXT,
  user_identification_img TEXT,
  personal_address TEXT,
  country VARCHAR(100),
  
  -- System-level role (for platform administration)
  role user_role DEFAULT 'user',
  
  -- Individual users (drivers, QA, etc.) - those not part of organizations
  individual_account_type account_type,
  
  -- Email verification
  email_verified BOOLEAN DEFAULT false,
  email_verification_token VARCHAR(255),
  email_verification_expires TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  business_name VARCHAR(255),
  account_type account_type NOT NULL,
  business_type VARCHAR(255),
  address TEXT,
  country VARCHAR(100),
  phone_number VARCHAR(20),
  business_registration_number VARCHAR(100),
  tax_id VARCHAR(100),
  farmers_id TEXT,
  payment_details JSONB,
  logo_url TEXT,
  
  -- Government specific fields
  government_level VARCHAR(100), -- 'federal', 'state', 'local', 'municipal'
  department VARCHAR(255), -- 'agriculture', 'commerce', 'health', etc.
  jurisdiction TEXT, -- geographical area of authority
  
  status organization_status DEFAULT 'pending_verification',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System permissions table (predefined permissions)
CREATE TABLE system_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name system_permission UNIQUE NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  category permission_category NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organization roles table
CREATE TABLE organization_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  is_admin BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(organization_id, name)
);

-- Custom permissions table (organization-specific permissions)
CREATE TABLE custom_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- custom permission name
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  category permission_category NOT NULL,
  created_by UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(organization_id, name)
);

-- Role system permissions junction table
CREATE TABLE role_system_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES organization_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES system_permissions(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(role_id, permission_id)
);

-- Role custom permissions junction table  
CREATE TABLE role_custom_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES organization_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES custom_permissions(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(role_id, permission_id)
);

-- Organization membership
CREATE TABLE organization_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES organization_roles(id) ON DELETE RESTRICT,
  is_active BOOLEAN DEFAULT true,
  invited_by UUID REFERENCES users(id),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(organization_id, user_id)
);

-- Invitations table
CREATE TABLE organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES organization_roles(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  invited_by UUID NOT NULL REFERENCES users(id),
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(organization_id, email)
);

-- Government-Seller Account Management Permissions
-- This table tracks which government organizations have permission to manage specific seller organizations
CREATE TABLE government_seller_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  government_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  seller_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  permission_type VARCHAR(100) NOT NULL, -- 'full_access', 'inspection_only', 'compliance_monitoring', etc.
  status permission_status DEFAULT 'pending',
  
  -- Permission details
  granted_by UUID REFERENCES users(id), -- Seller admin who granted permission
  approved_by UUID REFERENCES users(id), -- Government official who requested/approved
  reason TEXT, -- Why this permission was requested/granted
  
  -- Time constraints
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE, -- Optional expiration date
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(government_org_id, seller_org_id, permission_type),
  
  -- Simple constraint - organizations must be different
  CONSTRAINT check_different_orgs CHECK (government_org_id != seller_org_id)
);

-- Audit log for government actions on seller accounts
CREATE TABLE government_seller_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_id UUID NOT NULL REFERENCES government_seller_permissions(id) ON DELETE CASCADE,
  government_user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(100) NOT NULL, -- 'view_profile', 'update_info', 'suspend_account', etc.
  target_table VARCHAR(100), -- Which table was affected
  target_record_id UUID, -- ID of the affected record
  old_values JSONB, -- Previous values (for updates)
  new_values JSONB, -- New values (for updates)
  reason TEXT, -- Reason for the action
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger function to validate government-seller permissions
CREATE OR REPLACE FUNCTION validate_government_seller_permission()
RETURNS TRIGGER AS $$
BEGIN
  -- Check that government_org_id is actually a government organization
  IF NOT EXISTS (
    SELECT 1 FROM organizations 
    WHERE id = NEW.government_org_id AND account_type = 'government'
  ) THEN
    RAISE EXCEPTION 'Government organization ID must reference a government type organization';
  END IF;
  
  -- Check that seller_org_id is actually a seller organization
  IF NOT EXISTS (
    SELECT 1 FROM organizations 
    WHERE id = NEW.seller_org_id AND account_type = 'seller'
  ) THEN
    RAISE EXCEPTION 'Seller organization ID must reference a seller type organization';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for validation
CREATE TRIGGER validate_government_seller_permission_trigger
  BEFORE INSERT OR UPDATE ON government_seller_permissions
  FOR EACH ROW EXECUTE FUNCTION validate_government_seller_permission();

-- Insert system permissions
INSERT INTO system_permissions (name, display_name, description, category) VALUES
-- User Management
('manage_users', 'Manage Users', 'Create, edit, and deactivate organization users', 'user_management'),
('invite_users', 'Invite Users', 'Send invitations to new users', 'user_management'),
('view_users', 'View Users', 'View organization user list and details', 'user_management'),
('manage_roles', 'Manage Roles', 'Create and edit organization roles and permissions', 'user_management'),
('deactivate_users', 'Deactivate Users', 'Deactivate user accounts', 'user_management'),

-- Procurement
('create_rfp', 'Create RFP', 'Create requests for proposals', 'procurement'),
('approve_purchases', 'Approve Purchases', 'Approve purchase orders and contracts', 'procurement'),
('view_procurement', 'View Procurement', 'View procurement activities and status', 'procurement'),
('manage_vendors', 'Manage Vendors', 'Add, edit, and manage vendor information', 'procurement'),
('create_purchase_orders', 'Create Purchase Orders', 'Create and manage purchase orders', 'procurement'),
('approve_contracts', 'Approve Contracts', 'Review and approve contracts', 'procurement'),

-- Reporting & Analytics
('view_reports', 'View Reports', 'Access organization reports and analytics', 'reporting'),
('export_data', 'Export Data', 'Export organization data and reports', 'reporting'),
('view_audit_logs', 'View Audit Logs', 'Access system audit logs and user activities', 'audit'),
('create_reports', 'Create Reports', 'Create custom reports and dashboards', 'reporting'),
('view_analytics', 'View Analytics', 'Access advanced analytics and insights', 'reporting'),

-- Government Specific
('conduct_inspections', 'Conduct Inspections', 'Perform regulatory inspections', 'government'),
('issue_permits', 'Issue Permits', 'Issue and manage permits and licenses', 'government'),
('regulatory_oversight', 'Regulatory Oversight', 'Monitor compliance and enforce regulations', 'government'),
('policy_management', 'Policy Management', 'Create and manage policies and regulations', 'government'),
('compliance_monitoring', 'Compliance Monitoring', 'Monitor and track compliance status', 'compliance'),
('license_management', 'License Management', 'Manage licenses and certifications', 'government'),
('manage_seller_accounts', 'Manage Seller Accounts', 'Manage and oversee seller organization accounts', 'government'),

-- Organization Management
('manage_organization', 'Manage Organization', 'Edit organization settings and information', 'organization'),
('view_organization', 'View Organization', 'View organization information and settings', 'organization'),
('manage_settings', 'Manage Settings', 'Configure organization settings and preferences', 'organization'),
('manage_billing', 'Manage Billing', 'Handle billing and subscription management', 'finance'),

-- Inventory Management
('manage_inventory', 'Manage Inventory', 'Add, edit, and manage inventory items', 'inventory'),
('view_inventory', 'View Inventory', 'View inventory levels and details', 'inventory'),
('track_shipments', 'Track Shipments', 'Monitor shipment status and logistics', 'inventory'),
('quality_control', 'Quality Control', 'Perform quality checks and assessments', 'inventory'),

-- Finance
('manage_payments', 'Manage Payments', 'Process and manage payments', 'finance'),
('view_financial_reports', 'View Financial Reports', 'Access financial reports and statements', 'finance'),
('approve_invoices', 'Approve Invoices', 'Review and approve invoices', 'finance'),
('manage_budgets', 'Manage Budgets', 'Create and manage organizational budgets', 'finance');

-- Function to create default roles for new organizations
CREATE OR REPLACE FUNCTION create_default_roles_for_organization()
RETURNS TRIGGER AS $$
DECLARE
    admin_role_id UUID;
    staff_role_id UUID;
    inspector_role_id UUID;
    officer_role_id UUID;
BEGIN
    -- Create admin role
    INSERT INTO organization_roles (organization_id, name, display_name, description, is_admin, is_default)
    VALUES (NEW.id, 'admin', 'Administrator', 'Full access to organization management', true, false)
    RETURNING id INTO admin_role_id;
    
    -- Create staff role
    INSERT INTO organization_roles (organization_id, name, display_name, description, is_admin, is_default)
    VALUES (NEW.id, 'staff', 'Staff', 'Standard staff member access', false, true)
    RETURNING id INTO staff_role_id;
    
    -- Grant all system permissions to admin role
    INSERT INTO role_system_permissions (role_id, permission_id)
    SELECT admin_role_id, id FROM system_permissions WHERE is_active = true;
    
    -- Grant basic permissions to staff role
    INSERT INTO role_system_permissions (role_id, permission_id)
    SELECT staff_role_id, id FROM system_permissions 
    WHERE name IN ('view_users', 'view_procurement', 'view_reports', 'view_organization', 'view_inventory')
    AND is_active = true;
    
    -- Create account-type specific roles
    CASE NEW.account_type
        WHEN 'government' THEN
            -- Inspector role
            INSERT INTO organization_roles (organization_id, name, display_name, description, is_admin, is_default)
            VALUES (NEW.id, 'inspector', 'Inspector', 'Conduct inspections and regulatory oversight', false, false)
            RETURNING id INTO inspector_role_id;
            
            -- Procurement Officer role
            INSERT INTO organization_roles (organization_id, name, display_name, description, is_admin, is_default)
            VALUES (NEW.id, 'procurement_officer', 'Procurement Officer', 'Manage procurement processes', false, false)
            RETURNING id INTO officer_role_id;
            
            -- Grant permissions to inspector (including seller account management)
            INSERT INTO role_system_permissions (role_id, permission_id)
            SELECT inspector_role_id, id FROM system_permissions 
            WHERE name IN ('conduct_inspections', 'regulatory_oversight', 'compliance_monitoring', 'view_reports', 'view_audit_logs', 'manage_seller_accounts')
            AND is_active = true;
            
            -- Grant permissions to procurement officer
            INSERT INTO role_system_permissions (role_id, permission_id)
            SELECT officer_role_id, id FROM system_permissions 
            WHERE name IN ('create_rfp', 'approve_purchases', 'view_procurement', 'manage_vendors', 'create_purchase_orders')
            AND is_active = true;
            
        WHEN 'buyer' THEN
            -- Buyer Manager role
            INSERT INTO organization_roles (organization_id, name, display_name, description, is_admin, is_default)
            VALUES (NEW.id, 'buyer_manager', 'Buyer Manager', 'Manage purchasing and vendor relationships', false, false)
            RETURNING id INTO officer_role_id;
            
            INSERT INTO role_system_permissions (role_id, permission_id)
            SELECT officer_role_id, id FROM system_permissions 
            WHERE name IN ('create_rfp', 'approve_purchases', 'manage_vendors', 'view_procurement', 'manage_inventory')
            AND is_active = true;
            
        WHEN 'seller' THEN
            -- Sales Manager role
            INSERT INTO organization_roles (organization_id, name, display_name, description, is_admin, is_default)
            VALUES (NEW.id, 'sales_manager', 'Sales Manager', 'Manage sales and customer relationships', false, false)
            RETURNING id INTO officer_role_id;
            
            INSERT INTO role_system_permissions (role_id, permission_id)
            SELECT officer_role_id, id FROM system_permissions 
            WHERE name IN ('view_procurement', 'manage_inventory', 'track_shipments', 'quality_control', 'view_reports')
            AND is_active = true;
    END CASE;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default roles
CREATE TRIGGER create_default_roles_trigger
    AFTER INSERT ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION create_default_roles_for_organization();

-- Function to get all permissions for a user (system + custom)
CREATE OR REPLACE FUNCTION get_user_permissions(user_uuid UUID, org_uuid UUID)
RETURNS TABLE(permission_name VARCHAR, permission_type VARCHAR, category permission_category) AS $$
BEGIN
    RETURN QUERY
    -- System permissions
    SELECT 
        sp.name::VARCHAR as permission_name,
        'system'::VARCHAR as permission_type,
        sp.category
    FROM system_permissions sp
    JOIN role_system_permissions rsp ON sp.id = rsp.permission_id
    JOIN organization_roles r ON rsp.role_id = r.id
    JOIN organization_users ou ON r.id = ou.role_id
    WHERE ou.user_id = user_uuid 
    AND ou.organization_id = org_uuid
    AND ou.is_active = true
    AND sp.is_active = true
    
    UNION
    
    -- Custom permissions
    SELECT 
        cp.name::VARCHAR as permission_name,
        'custom'::VARCHAR as permission_type,
        cp.category
    FROM custom_permissions cp
    JOIN role_custom_permissions rcp ON cp.id = rcp.permission_id
    JOIN organization_roles r ON rcp.role_id = r.id
    JOIN organization_users ou ON r.id = ou.role_id
    WHERE ou.user_id = user_uuid 
    AND ou.organization_id = org_uuid
    AND ou.is_active = true
    AND cp.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Function to check if government user can manage a seller organization
CREATE OR REPLACE FUNCTION can_government_manage_seller(
    gov_user_id UUID, 
    gov_org_id UUID, 
    seller_org_id UUID, 
    required_permission VARCHAR DEFAULT 'full_access'
)
RETURNS BOOLEAN AS $$
DECLARE
    has_permission BOOLEAN := false;
BEGIN
    -- Check if there's an active permission
    SELECT EXISTS(
        SELECT 1 FROM government_seller_permissions gsp
        WHERE gsp.government_org_id = gov_org_id
        AND gsp.seller_org_id = seller_org_id
        AND gsp.permission_type = required_permission
        AND gsp.status = 'approved'
        AND (gsp.valid_until IS NULL OR gsp.valid_until > NOW())
        AND gsp.valid_from <= NOW()
    ) INTO has_permission;
    
    RETURN has_permission;
END;
$$ LANGUAGE plpgsql;

-- Function to log government actions on seller accounts
CREATE OR REPLACE FUNCTION log_government_seller_action(
    p_permission_id UUID,
    p_government_user_id UUID,
    p_action VARCHAR,
    p_target_table VARCHAR DEFAULT NULL,
    p_target_record_id UUID DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO government_seller_audit_log (
        permission_id,
        government_user_id,
        action,
        target_table,
        target_record_id,
        old_values,
        new_values,
        reason
    ) VALUES (
        p_permission_id,
        p_government_user_id,
        p_action,
        p_target_table,
        p_target_record_id,
        p_old_values,
        p_new_values,
        p_reason
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_individual_account_type ON users(individual_account_type);
CREATE INDEX idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX idx_organizations_account_type ON organizations(account_type);
CREATE INDEX idx_organization_users_org_id ON organization_users(organization_id);
CREATE INDEX idx_organization_users_user_id ON organization_users(user_id);
CREATE INDEX idx_organization_roles_org_id ON organization_roles(organization_id);
CREATE INDEX idx_role_system_permissions_role_id ON role_system_permissions(role_id);
CREATE INDEX idx_role_custom_permissions_role_id ON role_custom_permissions(role_id);
CREATE INDEX idx_custom_permissions_org_id ON custom_permissions(organization_id);
CREATE INDEX idx_system_permissions_category ON system_permissions(category);
CREATE INDEX idx_custom_permissions_category ON custom_permissions(category);

-- Government-Seller permission indexes
CREATE INDEX idx_gov_seller_permissions_gov_org ON government_seller_permissions(government_org_id);
CREATE INDEX idx_gov_seller_permissions_seller_org ON government_seller_permissions(seller_org_id);
CREATE INDEX idx_gov_seller_permissions_status ON government_seller_permissions(status);
CREATE INDEX idx_gov_seller_audit_permission_id ON government_seller_audit_log(permission_id);
CREATE INDEX idx_gov_seller_audit_user_id ON government_seller_audit_log(government_user_id);
CREATE INDEX idx_gov_seller_audit_created_at ON government_seller_audit_log(created_at);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_roles_updated_at BEFORE UPDATE ON organization_roles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_permissions_updated_at BEFORE UPDATE ON custom_permissions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_government_seller_permissions_updated_at BEFORE UPDATE ON government_seller_permissions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();