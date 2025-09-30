-- Add buyer-specific permissions to system_permission enum
-- These must be added in a separate transaction before they can be used

ALTER TYPE system_permission ADD VALUE 'browse_marketplace';
ALTER TYPE system_permission ADD VALUE 'manage_cart';
ALTER TYPE system_permission ADD VALUE 'place_orders';
ALTER TYPE system_permission ADD VALUE 'view_buyer_orders';
ALTER TYPE system_permission ADD VALUE 'cancel_orders';
ALTER TYPE system_permission ADD VALUE 'create_product_requests';
ALTER TYPE system_permission ADD VALUE 'manage_product_requests';
ALTER TYPE system_permission ADD VALUE 'view_buyer_transactions';
ALTER TYPE system_permission ADD VALUE 'manage_buyer_profile';
ALTER TYPE system_permission ADD VALUE 'manage_favorites';
ALTER TYPE system_permission ADD VALUE 'review_orders';
ALTER TYPE system_permission ADD VALUE 'manage_addresses';
