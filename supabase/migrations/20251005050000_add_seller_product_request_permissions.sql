-- Add seller product request permissions (Step 1: Add enum values)
-- These permissions allow sellers to view and respond to buyer product requests (RFQs)
-- Note: Enum values must be added in a separate transaction before use

-- Check if enum values already exist, if not add them
DO $$ 
BEGIN
    -- Add view_product_requests to enum if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'view_product_requests' 
        AND enumtypid = 'system_permission'::regtype
    ) THEN
        ALTER TYPE system_permission ADD VALUE 'view_product_requests';
    END IF;
    
    -- Add submit_product_quotes to enum if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'submit_product_quotes' 
        AND enumtypid = 'system_permission'::regtype
    ) THEN
        ALTER TYPE system_permission ADD VALUE 'submit_product_quotes';
    END IF;
END $$;

