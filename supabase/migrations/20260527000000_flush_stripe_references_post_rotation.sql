-- One-time data flush after a Stripe key rotation (or test↔live / account
-- switch) on the target environment.
--
-- Why: every cached Stripe ID we hold — `organizations.stripe_customer_id`
-- and `payment_methods.stripe_payment_method_id` — was minted under the
-- previous secret key. Under the new key those objects don't exist, so the
-- next request that touches them fails with `resource_missing`:
--   - POST /payment-methods/setup-intent → 500 "No such customer: cus_…"
--   - POST /buyers/orders (saved card)   → "Card declined (resource_missing):
--                                          No such PaymentMethod: pm_…"
--
-- The application code in payment-methods.service.ts now self-heals on the
-- fly (validates stored ids against Stripe, soft-detaches stale rows), so
-- this migration is *not* strictly required — but running it proactively
-- means buyers don't see a one-off error toast on their very next action.
--
-- Non-destructive at Stripe's side: customers/PMs created under the previous
-- key still exist in that account, we're only clearing our local pointers.
-- Soft-detach via `detached_at` matches the semantics from
-- 20260428100300_create_payment_methods.sql.
--
-- ⚠️  BLAST RADIUS — read before pushing to production:
--     This migration affects *every* org with a saved Stripe customer and
--     *every* active payment_methods row in the target DB. Only push it on
--     environments whose Stripe key was actually rotated. If you pushed it
--     to an environment whose key didn't change, nothing breaks — buyers
--     will simply be asked to re-add their cards on their next checkout.

-- 1. Soft-detach every active saved card so the storefront stops offering
--    stale PM ids at checkout.
UPDATE payment_methods
SET detached_at = NOW()
WHERE detached_at IS NULL;

-- 2. Clear stale Stripe customer pointers on every org. The next
--    `ensureStripeCustomer()` call per org will mint a fresh customer in
--    the current Stripe environment.
UPDATE organizations
SET stripe_customer_id = NULL
WHERE stripe_customer_id IS NOT NULL;
