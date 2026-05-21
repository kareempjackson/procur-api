-- Add the 'process_refunds' value to the system_permission enum.
--
-- This MUST run in its own migration (its own transaction), separate from any INSERT that
-- references the new value. Postgres rejects in-transaction use of an enum value that was
-- added earlier in the same transaction (SQLSTATE 55P04). The seed + grant rows live in
-- 20260428100701_seed_process_refunds_permission.sql.
--
-- Safe to run multiple times via IF NOT EXISTS.

ALTER TYPE public.system_permission ADD VALUE IF NOT EXISTS 'process_refunds';
