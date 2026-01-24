-- Aggregated view of seller-uploaded products for the admin panel
-- Groups by admin_product_id when present; otherwise groups by (name + unit + category)

CREATE OR REPLACE VIEW admin_uploaded_products_aggregate AS
SELECT
  COALESCE(
    ap.id::text,
    lower(p.name) || '|' || p.unit_of_measurement::text || '|' || COALESCE(p.category, '')
  ) AS id,
  COALESCE(ap.name, p.name) AS name,
  COALESCE(ap.category, p.category) AS category,
  COALESCE(ap.unit, p.unit_of_measurement::text) AS unit_of_measurement,
  CASE
    WHEN COUNT(DISTINCT p.currency) = 1 THEN MIN(p.currency)
    ELSE 'MIXED'
  END AS currency,
  SUM(COALESCE(p.stock_quantity, 0))::int AS total_stock_quantity,
  COUNT(DISTINCT p.seller_org_id)::int AS seller_count,
  MIN(COALESCE(p.sale_price, p.base_price)) AS min_price,
  MAX(COALESCE(p.sale_price, p.base_price)) AS max_price,
  AVG(COALESCE(p.sale_price, p.base_price)) AS avg_price
FROM products p
LEFT JOIN admin_products ap ON ap.id = p.admin_product_id
GROUP BY
  COALESCE(
    ap.id::text,
    lower(p.name) || '|' || p.unit_of_measurement::text || '|' || COALESCE(p.category, '')
  ),
  COALESCE(ap.name, p.name),
  COALESCE(ap.category, p.category),
  COALESCE(ap.unit, p.unit_of_measurement::text);








