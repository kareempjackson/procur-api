-- Agroprocessor business types + validation / default-role updates.
-- Paired with 20260417100000 which adds the 'agroprocessor' account_type value.

-- 1. Business type enum for agroprocessors.
DO $$ BEGIN
  CREATE TYPE agroprocessor_business_type AS ENUM (
    'general',
    'food_processor',
    'beverage_producer',
    'co_packer',
    'dairy_processor',
    'meat_processor'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE agroprocessor_business_type IS
  'Business types available for agroprocessor organizations';

-- 2. Widen validate_business_type() to recognize agroprocessor.
CREATE OR REPLACE FUNCTION validate_business_type()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.business_type IS NOT NULL THEN
    IF NEW.account_type = 'buyer' THEN
      IF NEW.business_type NOT IN ('general', 'hotels', 'restaurants', 'supermarkets', 'exporters') THEN
        RAISE EXCEPTION 'Invalid business_type "%" for buyer account. Valid types: general, hotels, restaurants, supermarkets, exporters', NEW.business_type;
      END IF;
    ELSIF NEW.account_type = 'seller' THEN
      IF NEW.business_type NOT IN ('general', 'farmers', 'manufacturers', 'fishermen') THEN
        RAISE EXCEPTION 'Invalid business_type "%" for seller account. Valid types: general, farmers, manufacturers, fishermen', NEW.business_type;
      END IF;
    ELSIF NEW.account_type = 'agroprocessor' THEN
      IF NEW.business_type NOT IN ('general', 'food_processor', 'beverage_producer', 'co_packer', 'dairy_processor', 'meat_processor') THEN
        RAISE EXCEPTION 'Invalid business_type "%" for agroprocessor account. Valid types: general, food_processor, beverage_producer, co_packer, dairy_processor, meat_processor', NEW.business_type;
      END IF;
    ELSIF NEW.account_type IN ('government', 'driver', 'qa') THEN
      IF NEW.business_type IS NOT NULL AND NEW.business_type != 'general' THEN
        RAISE EXCEPTION 'business_type should be null or "general" for account_type "%"', NEW.account_type;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Extend default-role creation to cover agroprocessor.
-- Agroprocessors receive both a sourcing_manager role (buyer-like permissions)
-- and a sales_manager role (seller-like permissions) in addition to the
-- universal admin + staff roles.
CREATE OR REPLACE FUNCTION create_default_roles_for_organization()
RETURNS TRIGGER AS $$
DECLARE
    admin_role_id UUID;
    staff_role_id UUID;
    inspector_role_id UUID;
    officer_role_id UUID;
    sourcing_role_id UUID;
    sales_role_id UUID;
BEGIN
    INSERT INTO organization_roles (organization_id, name, display_name, description, is_admin, is_default)
    VALUES (NEW.id, 'admin', 'Administrator', 'Full access to organization management', true, false)
    RETURNING id INTO admin_role_id;

    INSERT INTO organization_roles (organization_id, name, display_name, description, is_admin, is_default)
    VALUES (NEW.id, 'staff', 'Staff', 'Standard staff member access', false, true)
    RETURNING id INTO staff_role_id;

    INSERT INTO role_system_permissions (role_id, permission_id)
    SELECT admin_role_id, id FROM system_permissions WHERE is_active = true;

    INSERT INTO role_system_permissions (role_id, permission_id)
    SELECT staff_role_id, id FROM system_permissions
    WHERE name IN ('view_users', 'view_procurement', 'view_reports', 'view_organization', 'view_inventory')
    AND is_active = true;

    CASE NEW.account_type
        WHEN 'government' THEN
            INSERT INTO organization_roles (organization_id, name, display_name, description, is_admin, is_default)
            VALUES (NEW.id, 'inspector', 'Inspector', 'Conduct inspections and regulatory oversight', false, false)
            RETURNING id INTO inspector_role_id;

            INSERT INTO organization_roles (organization_id, name, display_name, description, is_admin, is_default)
            VALUES (NEW.id, 'procurement_officer', 'Procurement Officer', 'Manage procurement processes', false, false)
            RETURNING id INTO officer_role_id;

            INSERT INTO role_system_permissions (role_id, permission_id)
            SELECT inspector_role_id, id FROM system_permissions
            WHERE name IN ('conduct_inspections', 'regulatory_oversight', 'compliance_monitoring', 'view_reports', 'view_audit_logs', 'manage_seller_accounts')
            AND is_active = true;

            INSERT INTO role_system_permissions (role_id, permission_id)
            SELECT officer_role_id, id FROM system_permissions
            WHERE name IN ('create_rfp', 'approve_purchases', 'view_procurement', 'manage_vendors', 'create_purchase_orders')
            AND is_active = true;

        WHEN 'buyer' THEN
            INSERT INTO organization_roles (organization_id, name, display_name, description, is_admin, is_default)
            VALUES (NEW.id, 'buyer_manager', 'Buyer Manager', 'Manage purchasing and vendor relationships', false, false)
            RETURNING id INTO officer_role_id;

            INSERT INTO role_system_permissions (role_id, permission_id)
            SELECT officer_role_id, id FROM system_permissions
            WHERE name IN ('create_rfp', 'approve_purchases', 'manage_vendors', 'view_procurement', 'manage_inventory')
            AND is_active = true;

        WHEN 'seller' THEN
            INSERT INTO organization_roles (organization_id, name, display_name, description, is_admin, is_default)
            VALUES (NEW.id, 'sales_manager', 'Sales Manager', 'Manage sales and customer relationships', false, false)
            RETURNING id INTO officer_role_id;

            INSERT INTO role_system_permissions (role_id, permission_id)
            SELECT officer_role_id, id FROM system_permissions
            WHERE name IN ('view_procurement', 'manage_inventory', 'track_shipments', 'quality_control', 'view_reports')
            AND is_active = true;

        WHEN 'agroprocessor' THEN
            INSERT INTO organization_roles (organization_id, name, display_name, description, is_admin, is_default)
            VALUES (NEW.id, 'sourcing_manager', 'Sourcing Manager', 'Manage raw-material procurement', false, false)
            RETURNING id INTO sourcing_role_id;

            INSERT INTO organization_roles (organization_id, name, display_name, description, is_admin, is_default)
            VALUES (NEW.id, 'sales_manager', 'Sales Manager', 'Manage finished-goods sales', false, false)
            RETURNING id INTO sales_role_id;

            INSERT INTO role_system_permissions (role_id, permission_id)
            SELECT sourcing_role_id, id FROM system_permissions
            WHERE name IN ('create_rfp', 'approve_purchases', 'manage_vendors', 'view_procurement', 'manage_inventory')
            AND is_active = true;

            INSERT INTO role_system_permissions (role_id, permission_id)
            SELECT sales_role_id, id FROM system_permissions
            WHERE name IN ('view_procurement', 'manage_inventory', 'track_shipments', 'quality_control', 'view_reports')
            AND is_active = true;

        ELSE
            NULL;
    END CASE;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
