-- Retrofit ON DELETE CASCADE on the financial / order FKs that reference
-- organizations(id) but were created without a delete behavior clause.
--
-- Why: the admin "hard delete seller" feature needs `DELETE FROM organizations
-- WHERE id = ?` to cascade through every dependent row. The five tables below
-- declare seller_org_id as NOT NULL with no ON DELETE clause, which means PG
-- defaults to NO ACTION (= RESTRICT) and the org delete blows up with
-- "violates foreign key constraint" on the first dependent row.
--
-- Tables touched (seller_org_id only — we don't change buyer_org_id behavior
-- in this pass since deleting buyers isn't in scope):
--   - orders
--   - transactions
--   - payment_links
--   - payout_batch_items
--   - seller_balances (PRIMARY KEY ref, special — same fix works)
--
-- All five constraints follow PG's auto-naming convention <table>_<column>_fkey.
-- DROP IF EXISTS keeps the migration safe if the names ever drift.
--
-- This change is purely additive in behavior: nothing changes until an admin
-- triggers a hard-delete. Existing soft-delete (suspend) is unaffected.

-- ============================================================================
-- orders.seller_org_id
-- ============================================================================
ALTER TABLE orders
    DROP CONSTRAINT IF EXISTS orders_seller_org_id_fkey;
ALTER TABLE orders
    ADD CONSTRAINT orders_seller_org_id_fkey
    FOREIGN KEY (seller_org_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- ============================================================================
-- transactions.seller_org_id
-- ============================================================================
ALTER TABLE transactions
    DROP CONSTRAINT IF EXISTS transactions_seller_org_id_fkey;
ALTER TABLE transactions
    ADD CONSTRAINT transactions_seller_org_id_fkey
    FOREIGN KEY (seller_org_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- ============================================================================
-- payment_links.seller_org_id
-- ============================================================================
ALTER TABLE payment_links
    DROP CONSTRAINT IF EXISTS payment_links_seller_org_id_fkey;
ALTER TABLE payment_links
    ADD CONSTRAINT payment_links_seller_org_id_fkey
    FOREIGN KEY (seller_org_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- ============================================================================
-- payout_batch_items.seller_org_id
-- ============================================================================
ALTER TABLE payout_batch_items
    DROP CONSTRAINT IF EXISTS payout_batch_items_seller_org_id_fkey;
ALTER TABLE payout_batch_items
    ADD CONSTRAINT payout_batch_items_seller_org_id_fkey
    FOREIGN KEY (seller_org_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- ============================================================================
-- seller_balances.seller_org_id (also the PRIMARY KEY)
-- ============================================================================
ALTER TABLE seller_balances
    DROP CONSTRAINT IF EXISTS seller_balances_seller_org_id_fkey;
ALTER TABLE seller_balances
    ADD CONSTRAINT seller_balances_seller_org_id_fkey
    FOREIGN KEY (seller_org_id) REFERENCES organizations(id) ON DELETE CASCADE;

COMMENT ON CONSTRAINT orders_seller_org_id_fkey ON orders IS
    'Cascades on seller deletion. Buyer-side seller deletion still requires admin action.';

-- ============================================================================
-- organization_status enum: add 'archived'
-- ============================================================================
-- Used by the "smart wipe" admin action: keeps the org row + audit trail
-- (orders, transactions stay intact) but anonymizes PII and hides the org
-- from every public surface. Distinct from 'suspended' which can be
-- reactivated by switching the seller back to 'active'.

ALTER TYPE organization_status ADD VALUE IF NOT EXISTS 'archived';

COMMENT ON TYPE organization_status IS
    'active = healthy seller; suspended = soft-delete (reversible); archived = smart-wipe (PII gone, kept for FK integrity); pending_verification = signup state.';
