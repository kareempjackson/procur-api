-- Add 'scheduled' to transaction_status enum for payout scheduling
-- This allows admins to mark farmer payouts as scheduled before actually paying

ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'scheduled';

