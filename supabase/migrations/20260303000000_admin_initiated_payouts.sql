-- Admin-initiated payout flow
-- Adds columns to support admin-created payouts and receipt tracking

ALTER TABLE payout_requests
  ADD COLUMN IF NOT EXISTS initiated_by text NOT NULL DEFAULT 'seller'
    CHECK (initiated_by IN ('seller', 'admin')),
  ADD COLUMN IF NOT EXISTS receipt_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_email text;

COMMENT ON COLUMN payout_requests.initiated_by IS 'Who created this payout: seller (legacy request) or admin (biweekly payout)';
COMMENT ON COLUMN payout_requests.receipt_sent_at IS 'Timestamp when the payout receipt email/WA was last sent to the seller';
COMMENT ON COLUMN payout_requests.receipt_email IS 'Email address used for receipt delivery (audit trail)';
