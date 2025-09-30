-- Add seller-specific permissions to system_permission enum
-- These must be added in a separate transaction before they can be used

ALTER TYPE system_permission ADD VALUE 'manage_products';
ALTER TYPE system_permission ADD VALUE 'view_products';
ALTER TYPE system_permission ADD VALUE 'manage_posts';
ALTER TYPE system_permission ADD VALUE 'view_posts';
ALTER TYPE system_permission ADD VALUE 'manage_orders';
ALTER TYPE system_permission ADD VALUE 'view_orders';
ALTER TYPE system_permission ADD VALUE 'accept_orders';
ALTER TYPE system_permission ADD VALUE 'view_transactions';
ALTER TYPE system_permission ADD VALUE 'manage_seller_analytics';
