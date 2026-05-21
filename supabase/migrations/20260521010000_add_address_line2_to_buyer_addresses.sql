-- The buyer-side checkout form has always had an "Apt / suite" / "Información adicional" input,
-- but the column never existed. The frontend was sending address_line2 in the create payload
-- and the global ValidationPipe (forbidNonWhitelisted: true) was rejecting every save with a
-- generic "property address_line2 should not exist" array — which the frontend rendered as
-- "Please fill in all required address fields", masking the real cause.
--
-- This adds the missing column so address_line2 finally round-trips end to end.
-- Safe to run multiple times.

DO $$
BEGIN
  ALTER TABLE buyer_addresses
    ADD COLUMN IF NOT EXISTS address_line2 TEXT;

  COMMENT ON COLUMN buyer_addresses.address_line2 IS
    'Optional secondary line: apt/unit/floor for delivery, "información adicional" (Local 3, barrio…) for Colombia. Free-text, nullable.';
END;
$$;
