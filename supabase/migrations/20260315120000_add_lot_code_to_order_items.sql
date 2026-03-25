-- Migration: Add lot_code and harvest_log_id to order_items for FSMA 204 traceability.
--
-- lot_code is DENORMALIZED (copied from harvest_logs at assignment time) to preserve
-- an immutable audit record even if the source harvest_log is later amended or deleted.
--
-- harvest_log_id is kept as a soft FK for lookup convenience (chain-of-custody queries)
-- but the lot_code column is the authoritative traceability record.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS lot_code        TEXT,
  ADD COLUMN IF NOT EXISTS harvest_log_id  UUID REFERENCES harvest_logs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_lot_code
  ON order_items(lot_code)
  WHERE lot_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_harvest_log_id
  ON order_items(harvest_log_id)
  WHERE harvest_log_id IS NOT NULL;

COMMENT ON COLUMN order_items.lot_code IS
  'FSMA 204 Traceability Lot Code. Denormalized copy of harvest_logs.lot_code at assignment time. Immutable audit record.';

COMMENT ON COLUMN order_items.harvest_log_id IS
  'Soft FK to harvest_logs for chain-of-custody queries. lot_code is the authoritative traceability field.';
