-- Add government-specific permissions to system_permission enum
ALTER TYPE system_permission ADD VALUE 'manage_government_tables';
ALTER TYPE system_permission ADD VALUE 'view_government_data';
ALTER TYPE system_permission ADD VALUE 'create_government_charts';
ALTER TYPE system_permission ADD VALUE 'manage_government_reports';
ALTER TYPE system_permission ADD VALUE 'edit_seller_data';
ALTER TYPE system_permission ADD VALUE 'manage_government_analytics';
ALTER TYPE system_permission ADD VALUE 'export_government_data';
ALTER TYPE system_permission ADD VALUE 'manage_role_permissions';

-- Create enums for flexible system
CREATE TYPE field_type AS ENUM (
  'text',
  'number',
  'date',
  'boolean',
  'select',
  'multi_select',
  'email',
  'phone',
  'url',
  'currency',
  'percentage',
  'rating',
  'file',
  'relation'
);

CREATE TYPE chart_type AS ENUM (
  'line',
  'bar',
  'pie',
  'area',
  'scatter',
  'table',
  'metric',
  'map'
);

CREATE TYPE report_status AS ENUM (
  'draft',
  'generating',
  'completed',
  'failed'
);

-- Government tables (like Notion databases/Airtable bases)
CREATE TABLE government_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  government_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(50), -- emoji or icon name
  color VARCHAR(7), -- hex color
  
  -- Data source configuration
  data_sources JSONB NOT NULL DEFAULT '[]', -- Array of data source configs
  
  -- Table configuration
  fields JSONB NOT NULL DEFAULT '[]', -- Array of field definitions
  views JSONB NOT NULL DEFAULT '[]', -- Array of view configurations (filters, sorts, etc.)
  
  -- Permissions and access
  is_public BOOLEAN DEFAULT false,
  allowed_users JSONB DEFAULT '[]', -- Array of user IDs with access
  
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure government organizations only
  CONSTRAINT check_government_org CHECK (
    (SELECT account_type FROM organizations WHERE id = government_org_id) = 'government'
  )
);

-- Government charts (visualizations)
CREATE TABLE government_charts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  government_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  table_id UUID REFERENCES government_tables(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  description TEXT,
  chart_type chart_type NOT NULL,
  
  -- Chart configuration
  config JSONB NOT NULL DEFAULT '{}', -- Chart-specific configuration
  data_config JSONB NOT NULL DEFAULT '{}', -- Data aggregation and filtering
  
  -- Layout and styling
  width INTEGER DEFAULT 6, -- Grid width (1-12)
  height INTEGER DEFAULT 4, -- Grid height
  position JSONB DEFAULT '{"x": 0, "y": 0}',
  
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure government organizations only
  CONSTRAINT check_government_org CHECK (
    (SELECT account_type FROM organizations WHERE id = government_org_id) = 'government'
  )
);

-- Government reports
CREATE TABLE government_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  government_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Report configuration
  tables JSONB NOT NULL DEFAULT '[]', -- Array of table IDs to include
  charts JSONB NOT NULL DEFAULT '[]', -- Array of chart IDs to include
  filters JSONB DEFAULT '{}', -- Global filters for the report
  template JSONB DEFAULT '{}', -- Report template configuration
  
  -- Generation settings
  format VARCHAR(20) DEFAULT 'pdf', -- pdf, xlsx, csv
  schedule JSONB, -- Scheduling configuration
  status report_status DEFAULT 'draft',
  
  -- Generated files
  file_url TEXT,
  generated_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure government organizations only
  CONSTRAINT check_government_org CHECK (
    (SELECT account_type FROM organizations WHERE id = government_org_id) = 'government'
  )
);

-- Create indexes for better performance
CREATE INDEX idx_government_tables_org_id ON government_tables(government_org_id);
CREATE INDEX idx_government_charts_org_id ON government_charts(government_org_id);
CREATE INDEX idx_government_charts_table_id ON government_charts(table_id);
CREATE INDEX idx_government_reports_org_id ON government_reports(government_org_id);
CREATE INDEX idx_government_reports_status ON government_reports(status);

-- Create a function to get available data sources for government organizations
CREATE OR REPLACE FUNCTION get_government_data_sources(gov_org_id UUID)
RETURNS JSONB AS $$
DECLARE
  gov_country TEXT;
  data_sources JSONB := '[]'::JSONB;
BEGIN
  -- Get the government organization's country
  SELECT country INTO gov_country 
  FROM organizations 
  WHERE id = gov_org_id AND account_type = 'government';
  
  IF gov_country IS NULL THEN
    RAISE EXCEPTION 'Government organization not found or has no country specified';
  END IF;
  
  -- Build available data sources
  data_sources := data_sources || jsonb_build_object(
    'id', 'sellers',
    'name', 'Sellers',
    'description', 'All seller organizations in ' || gov_country,
    'table', 'organizations',
    'filters', jsonb_build_object('account_type', 'seller', 'country', gov_country)
  );
  
  data_sources := data_sources || jsonb_build_object(
    'id', 'farmers',
    'name', 'Farmers',
    'description', 'Farmer organizations in ' || gov_country,
    'table', 'organizations',
    'filters', jsonb_build_object('account_type', 'seller', 'business_type', 'farmers', 'country', gov_country)
  );
  
  data_sources := data_sources || jsonb_build_object(
    'id', 'products',
    'name', 'Products',
    'description', 'All products from sellers in ' || gov_country,
    'table', 'products',
    'joins', jsonb_build_array(
      jsonb_build_object(
        'table', 'organizations',
        'on', 'products.seller_org_id = organizations.id',
        'filters', jsonb_build_object('country', gov_country)
      )
    )
  );
  
  data_sources := data_sources || jsonb_build_object(
    'id', 'orders',
    'name', 'Orders',
    'description', 'All orders in ' || gov_country,
    'table', 'orders',
    'joins', jsonb_build_array(
      jsonb_build_object(
        'table', 'organizations',
        'on', 'orders.seller_org_id = organizations.id',
        'filters', jsonb_build_object('country', gov_country)
      )
    )
  );
  
  data_sources := data_sources || jsonb_build_object(
    'id', 'users',
    'name', 'Users',
    'description', 'All users in ' || gov_country,
    'table', 'users',
    'filters', jsonb_build_object('country', gov_country)
  );
  
  RETURN data_sources;
END;
$$ LANGUAGE plpgsql;

-- Add government-specific role permissions
-- These will be automatically assigned when government roles are created

-- Insert system permissions for government roles
INSERT INTO role_system_permissions (role_id, permission_name, granted_by, granted_at)
SELECT 
  r.id,
  'view_government_data',
  NULL,
  NOW()
FROM organization_roles r
JOIN organizations o ON r.organization_id = o.id
WHERE o.account_type = 'government' 
  AND r.name IN ('admin', 'staff', 'inspector', 'procurement_officer')
ON CONFLICT (role_id, permission_name) DO NOTHING;

-- Admin can manage everything including role permissions
INSERT INTO role_system_permissions (role_id, permission_name, granted_by, granted_at)
SELECT 
  r.id,
  unnest(ARRAY[
    'manage_government_tables', 
    'create_government_charts', 
    'manage_government_reports', 
    'manage_government_analytics', 
    'export_government_data',
    'edit_seller_data',
    'manage_role_permissions'
  ]),
  NULL,
  NOW()
FROM organization_roles r
JOIN organizations o ON r.organization_id = o.id
WHERE o.account_type = 'government' 
  AND r.name = 'admin'
ON CONFLICT (role_id, permission_name) DO NOTHING;

-- Procurement officers can manage tables, charts, and reports
INSERT INTO role_system_permissions (role_id, permission_name, granted_by, granted_at)
SELECT 
  r.id,
  unnest(ARRAY['manage_government_tables', 'create_government_charts', 'manage_government_reports', 'manage_government_analytics', 'export_government_data']),
  NULL,
  NOW()
FROM organization_roles r
JOIN organizations o ON r.organization_id = o.id
WHERE o.account_type = 'government' 
  AND r.name = 'procurement_officer'
ON CONFLICT (role_id, permission_name) DO NOTHING;

-- Inspectors can edit seller data
INSERT INTO role_system_permissions (role_id, permission_name, granted_by, granted_at)
SELECT 
  r.id,
  'edit_seller_data',
  NULL,
  NOW()
FROM organization_roles r
JOIN organizations o ON r.organization_id = o.id
WHERE o.account_type = 'government' 
  AND r.name = 'inspector'
ON CONFLICT (role_id, permission_name) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE government_tables IS 'Flexible tables created by government organizations (like Notion databases)';
COMMENT ON TABLE government_charts IS 'Charts and visualizations for government data';
COMMENT ON TABLE government_reports IS 'Generated reports combining tables and charts';
COMMENT ON FUNCTION get_government_data_sources(UUID) IS 'Returns available data sources for a government organization based on their country';
