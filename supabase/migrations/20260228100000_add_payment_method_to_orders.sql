-- Add payment_method column to orders table
-- Tracks how the buyer intends to pay (bank transfer, cash on delivery, cheque on delivery)
-- Safe to run multiple times: skips if column already exists

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
      AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE orders
      ADD COLUMN payment_method text NOT NULL DEFAULT 'bank_transfer'
        CHECK (payment_method IN ('bank_transfer', 'cash_on_delivery', 'cheque_on_delivery'));

    COMMENT ON COLUMN orders.payment_method IS
      'Payment method selected by the buyer at checkout: bank_transfer, cash_on_delivery, or cheque_on_delivery';
  END IF;
END;
$$;
