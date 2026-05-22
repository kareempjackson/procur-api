-- Multi-org users: a single Procur user can belong to both a buyer org AND a seller org.
-- `organization_users` already supports the many-to-many membership; what was missing is a
-- pointer on the user row to which org is "active" right now (drives the JWT context and
-- decides whether the UI renders the buyer or the seller experience after login). Without
-- this, login would always pick `organization_users[0]` and clobber the mode the user just
-- switched into.

DO $$
BEGIN
  ALTER TABLE users
    ADD COLUMN IF NOT EXISTS active_organization_id UUID
    REFERENCES organizations(id) ON DELETE SET NULL;

  COMMENT ON COLUMN users.active_organization_id IS
    'The organization the user is currently acting as. Updated by POST /auth/switch-organization; '
    'consulted on token issuance to decide which org context (buyer vs seller) the new JWT carries. '
    'NULL means "fall back to the first organization_users row" (legacy single-org behavior).';
END;
$$;
