-- Migration: Seed Product Requests Data
-- Description: Sample RFQ data for testing
-- Date: 2025-10-05

-- Insert sample product requests with schema compatibility
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_requests' AND column_name = 'budget_min'
  ) THEN
    INSERT INTO product_requests (
      id,
      buyer_org_id,
      buyer_user_id,
      product_name,
      product_type,
      category,
      description,
      quantity,
      unit_of_measurement,
      date_needed,
      budget_min,
      budget_max,
      currency,
      status,
      expires_at,
      created_at
    )
    SELECT
      gen_random_uuid(),
      buyer_org.id,
      buyer_user.id,
      product_name,
      product_type,
      category,
      description,
      quantity,
      unit_of_measurement::measurement_unit,
      date_needed::date,
      budget_min,
      budget_max,
      currency,
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM pg_enum e 
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'request_status' AND e.enumlabel = status
        ) THEN status::request_status
        ELSE 'draft'::request_status
      END,
      expires_at::timestamp,
      created_at::timestamp
    FROM (
      SELECT 
        'Organic Cherry Tomatoes' as product_name,
        'Fresh' as product_type,
        'Vegetables' as category,
        'Looking for premium organic cherry tomatoes, GAP certified. Must be fresh and vine-ripened.' as description,
        500 as quantity,
        'kg' as unit_of_measurement,
        '2025-10-25' as date_needed,
        2500 as budget_min,
        3000 as budget_max,
        'USD' as currency,
        'active' as status,
        '2025-10-20 00:00:00' as expires_at,
        '2025-10-01 10:00:00' as created_at
      UNION ALL
      SELECT 
        'Fresh Mangoes (Alphonso)',
        'Fresh',
        'Fruits',
        'Premium Alphonso mangoes for restaurant use. Must be ripe and sweet.',
        200,
        'kg',
        '2025-10-20',
        1200,
        1500,
        'USD',
        'completed',
        '2025-10-15 00:00:00',
        '2025-09-28 09:00:00'
      UNION ALL
      SELECT 
        'Sweet Potatoes',
        'Fresh',
        'Vegetables',
        'Looking for high-quality sweet potatoes for our restaurant chain.',
        1000,
        'kg',
        '2025-11-05',
        800,
        1200,
        'USD',
        'active',
        '2025-10-30 00:00:00',
        '2025-10-03 14:00:00'
      UNION ALL
      SELECT 
        'Scotch Bonnet Peppers',
        'Fresh',
        'Spices',
        'Hot scotch bonnet peppers needed for hot sauce production.',
        300,
        'kg',
        '2025-10-18',
        600,
        900,
        'USD',
        'active',
        '2025-10-15 00:00:00',
        '2025-10-05 08:00:00'
      UNION ALL
      SELECT 
        'Fresh Coconuts',
        'Fresh',
        'Fruits',
        'Mature coconuts with water. For beverage production.',
        2000,
        'piece',
        '2025-10-30',
        1000,
        1500,
        'USD',
        'active',
        '2025-10-25 00:00:00',
        '2025-10-02 11:00:00'
      UNION ALL
      SELECT 
        'Organic Lettuce',
        'Fresh',
        'Vegetables',
        'Organic romaine and butter lettuce for salad bars.',
        150,
        'kg',
        '2025-09-15',
        300,
        500,
        'USD',
        'expired',
        '2025-09-10 00:00:00',
        '2025-08-25 13:00:00'
    ) as requests
    CROSS JOIN (
      SELECT id, name FROM organizations WHERE account_type = 'buyer' LIMIT 1
    ) as buyer_org
    CROSS JOIN (
      SELECT id FROM users WHERE email LIKE '%buyer%' LIMIT 1
    ) as buyer_user;
  ELSE
    INSERT INTO product_requests (
      id,
      buyer_org_id,
      buyer_user_id,
      product_name,
      product_type,
      category,
      description,
      quantity,
      unit_of_measurement,
      date_needed,
      budget_range,
      status,
      expires_at,
      created_at
    )
    SELECT
      gen_random_uuid(),
      buyer_org.id,
      buyer_user.id,
      product_name,
      product_type,
      category,
      description,
      quantity,
      unit_of_measurement::measurement_unit,
      date_needed::date,
      jsonb_build_object('min', budget_min, 'max', budget_max, 'currency', currency),
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM pg_enum e 
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'request_status' AND e.enumlabel = status
        ) THEN status::request_status
        ELSE 'draft'::request_status
      END,
      expires_at::timestamp,
      created_at::timestamp
    FROM (
  SELECT 
    'Organic Cherry Tomatoes' as product_name,
    'Fresh' as product_type,
    'Vegetables' as category,
    'Looking for premium organic cherry tomatoes, GAP certified. Must be fresh and vine-ripened.' as description,
    500 as quantity,
    'kg' as unit_of_measurement,
    '2025-10-25' as date_needed,
    2500 as budget_min,
    3000 as budget_max,
    'USD' as currency,
    'active' as status,
    '2025-10-20 00:00:00' as expires_at,
    '2025-10-01 10:00:00' as created_at
  UNION ALL
  SELECT 
    'Fresh Mangoes (Alphonso)',
    'Fresh',
    'Fruits',
    'Premium Alphonso mangoes for restaurant use. Must be ripe and sweet.',
    200,
    'kg',
    '2025-10-20',
    1200,
    1500,
    'USD',
    'completed',
    '2025-10-15 00:00:00',
    '2025-09-28 09:00:00'
  UNION ALL
  SELECT 
    'Sweet Potatoes',
    'Fresh',
    'Vegetables',
    'Looking for high-quality sweet potatoes for our restaurant chain.',
    1000,
    'kg',
    '2025-11-05',
    800,
    1200,
    'USD',
    'active',
    '2025-10-30 00:00:00',
    '2025-10-03 14:00:00'
  UNION ALL
  SELECT 
    'Scotch Bonnet Peppers',
    'Fresh',
    'Spices',
    'Hot scotch bonnet peppers needed for hot sauce production.',
    300,
    'kg',
    '2025-10-18',
    600,
    900,
    'USD',
    'active',
    '2025-10-15 00:00:00',
    '2025-10-05 08:00:00'
  UNION ALL
  SELECT 
    'Fresh Coconuts',
    'Fresh',
    'Fruits',
    'Mature coconuts with water. For beverage production.',
    2000,
    'piece',
    '2025-10-30',
    1000,
    1500,
    'USD',
    'active',
    '2025-10-25 00:00:00',
    '2025-10-02 11:00:00'
  UNION ALL
  SELECT 
    'Organic Lettuce',
    'Fresh',
    'Vegetables',
    'Organic romaine and butter lettuce for salad bars.',
    150,
    'kg',
    '2025-09-15',
    300,
    500,
    'USD',
    'expired',
    '2025-09-10 00:00:00',
    '2025-08-25 13:00:00'
) as requests
CROSS JOIN (
      SELECT id, name FROM organizations WHERE account_type = 'buyer' LIMIT 1
) as buyer_org
CROSS JOIN (
      SELECT id FROM users WHERE email LIKE '%buyer%' LIMIT 1
) as buyer_user;
  END IF;
END $$;

-- Insert sample quotes for active requests
WITH seller_orgs AS (
  SELECT id, name FROM organizations WHERE account_type = 'seller' LIMIT 5
),
seller_users AS (
  SELECT DISTINCT ON (ou.organization_id) 
    ou.organization_id, 
    ou.user_id 
  FROM organization_users ou
  INNER JOIN organizations o ON o.id = ou.organization_id
  WHERE o.account_type = 'seller'
),
active_requests AS (
  SELECT id, product_name, quantity, unit_of_measurement
  FROM product_requests
  WHERE status = 'active'
  LIMIT 3
),
fallback_seller_user AS (
  SELECT COALESCE(
    (SELECT ou.user_id 
     FROM organization_users ou 
     JOIN organizations o ON o.id = ou.organization_id 
     WHERE o.account_type = 'seller' 
     LIMIT 1),
    (SELECT id FROM users LIMIT 1)
  ) AS user_id
)
INSERT INTO request_quotes (
  id,
  request_id,
  seller_org_id,
  seller_user_id,
  unit_price,
  total_price,
  currency,
  available_quantity,
  delivery_date,
  notes,
  status,
  created_at
)
SELECT
  gen_random_uuid(),
  ar.id,
  so.id,
  COALESCE(su.user_id, fsu.user_id),
  CASE 
    WHEN ar.product_name LIKE '%Tomatoes%' THEN 5.50 + (random() * 0.5)
    WHEN ar.product_name LIKE '%Mangoes%' THEN 6.75 + (random() * 0.5)
    WHEN ar.product_name LIKE '%Potatoes%' THEN 1.00 + (random() * 0.3)
    WHEN ar.product_name LIKE '%Peppers%' THEN 2.50 + (random() * 0.5)
    WHEN ar.product_name LIKE '%Coconuts%' THEN 0.75 + (random() * 0.25)
    ELSE 5.00
  END as unit_price,
  CASE 
    WHEN ar.product_name LIKE '%Tomatoes%' THEN (5.50 + (random() * 0.5)) * ar.quantity
    WHEN ar.product_name LIKE '%Mangoes%' THEN (6.75 + (random() * 0.5)) * ar.quantity
    WHEN ar.product_name LIKE '%Potatoes%' THEN (1.00 + (random() * 0.3)) * ar.quantity
    WHEN ar.product_name LIKE '%Peppers%' THEN (2.50 + (random() * 0.5)) * ar.quantity
    WHEN ar.product_name LIKE '%Coconuts%' THEN (0.75 + (random() * 0.25)) * ar.quantity
    ELSE 5.00 * ar.quantity
  END as total_price,
  'USD',
  ar.quantity * (0.8 + random() * 0.4), -- 80-120% of requested quantity
  CURRENT_DATE + interval '3 days' + (random() * interval '7 days'),
  CASE 
    WHEN random() < 0.5 THEN 'Premium quality, GAP certified. Can deliver on schedule.'
    ELSE 'High quality product available. Flexible delivery terms.'
  END,
  'pending',
  NOW() - (random() * interval '2 days')
FROM active_requests ar
CROSS JOIN seller_orgs so
LEFT JOIN seller_users su ON su.organization_id = so.id
CROSS JOIN fallback_seller_user fsu
LIMIT 12;

-- Update response counts (triggers should handle this, but just in case)
UPDATE product_requests pr
SET response_count = (
  SELECT COUNT(*)
  FROM request_quotes rq
  WHERE rq.request_id = pr.id
)
WHERE status = 'active';

-- Add an accepted quote for the completed request
UPDATE request_quotes
SET status = 'accepted'
WHERE request_id IN (
  SELECT id FROM product_requests WHERE status::text = 'completed' LIMIT 1
)
AND id = (
  SELECT id FROM request_quotes
  WHERE request_id IN (
    SELECT id FROM product_requests WHERE status::text = 'completed' LIMIT 1
  )
  ORDER BY total_price ASC
  LIMIT 1
);

-- Analyze tables
ANALYZE product_requests;
ANALYZE request_quotes;

