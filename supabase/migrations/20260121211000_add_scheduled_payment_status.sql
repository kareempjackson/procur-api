-- Add 'scheduled' to payment_status enum for order payout scheduling
-- This allows admins to mark orders as having scheduled payouts for sellers

ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'scheduled';

