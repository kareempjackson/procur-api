-- Promote invoice_number to a real column. generateOrderInvoicePdf already reads order.invoice_number
-- but the column did not exist (silent fallback to order_number). Backfill matches that fallback so
-- existing PDFs remain stable. Future order inserts in BuyersService.createOrder write this explicitly.
--
-- NOT unique: a multi-seller cart produces one parent order row + N child rows that all share the
-- same order_number / invoice_number (one buyer-facing invoice per cart). We index it for fast lookup
-- but cannot enforce uniqueness across rows.
--
-- Safe to run multiple times.

DO $$
BEGIN
  ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS invoice_number TEXT;

  -- Backfill existing rows to preserve pre-migration invoice numbering.
  UPDATE orders
  SET invoice_number = order_number
  WHERE invoice_number IS NULL;

  -- Drop any pre-existing unique variant (from a failed earlier run of this migration).
  DROP INDEX IF EXISTS idx_orders_invoice_number;

  CREATE INDEX IF NOT EXISTS idx_orders_invoice_number
    ON orders(invoice_number)
    WHERE invoice_number IS NOT NULL;

  COMMENT ON COLUMN orders.invoice_number IS
    'Stable invoice identifier surfaced on invoice and credit-note PDFs. Multi-seller carts share one invoice_number across parent+child rows (matches order_number). Defaults to order_number; can diverge if invoice numbering rules change later.';
END;
$$;
