-- Recalculate seller balances from delivered orders
-- This migration fixes any seller balances that weren't credited when orders were delivered

-- First, let's calculate the correct balances from all delivered orders
WITH delivered_order_totals AS (
    SELECT 
        seller_org_id,
        SUM(ROUND(total_amount * 100)::BIGINT) as total_cents,
        MAX(currency) as currency
    FROM orders 
    WHERE status = 'delivered' 
    AND seller_org_id IS NOT NULL
    GROUP BY seller_org_id
)
-- Update or insert seller balances
INSERT INTO seller_balances (seller_org_id, available_amount_cents, pending_amount_cents, credit_amount_cents, currency, updated_at)
SELECT 
    dot.seller_org_id,
    dot.total_cents,
    0,
    COALESCE(sb.credit_amount_cents, 0),
    COALESCE(dot.currency, 'XCD'),
    NOW()
FROM delivered_order_totals dot
LEFT JOIN seller_balances sb ON sb.seller_org_id = dot.seller_org_id
ON CONFLICT (seller_org_id) 
DO UPDATE SET 
    available_amount_cents = EXCLUDED.available_amount_cents,
    updated_at = NOW();

