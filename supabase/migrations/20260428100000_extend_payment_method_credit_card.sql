-- Extend orders.payment_method to allow 'credit_card' alongside the existing offline methods.
-- The original CHECK was added inline in 20260228100000_add_payment_method_to_orders.sql; Postgres
-- auto-named it orders_payment_method_check. We drop and re-add it with the wider value set.
-- Safe to run multiple times.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;

    ALTER TABLE orders
      ADD CONSTRAINT orders_payment_method_check
      CHECK (payment_method IN ('bank_transfer', 'cash_on_delivery', 'cheque_on_delivery', 'credit_card'));

    COMMENT ON COLUMN orders.payment_method IS
      'Payment method selected by the buyer at checkout: bank_transfer, cash_on_delivery, cheque_on_delivery, or credit_card';
  END IF;
END;
$$;
