-- Add AGROPROCESSOR to the account_type enum.
-- An agroprocessor is a business that both sources raw agricultural inputs
-- and sells processed/finished goods (e.g. mango -> jam). It has dual
-- buyer + seller capabilities, delivered via JWT capabilities computed at
-- token issuance (see auth.service.ts).
--
-- This migration is intentionally isolated because newly added enum values
-- cannot be referenced within the same transaction they are added in.
-- Subsequent migration 20260417100100 updates the validate_business_type
-- trigger and default-role creation function to handle agroprocessor.

ALTER TYPE public.account_type ADD VALUE IF NOT EXISTS 'agroprocessor';
