-- Storefront customization: per-organization Shopify-lite page builder.
-- Scope v1: agroprocessor-only (enforced at API layer, not DB).
--
-- Three tables:
--   organization_storefronts        — one row per org (theme, draft + published JSON)
--   storefront_collections          — curated product groupings for storefront sections
--   storefront_collection_products  — manual collection → product pivot

-- ============================================================================
-- 1. organization_storefronts
-- ============================================================================
CREATE TABLE IF NOT EXISTS organization_storefronts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL UNIQUE
        REFERENCES organizations(id) ON DELETE CASCADE,

    -- Template determines how sections are visually rendered.
    template TEXT NOT NULL DEFAULT 'market'
        CHECK (template IN ('market', 'harvest', 'modern')),

    -- Theme tokens. Example:
    -- {
    --   "primary_color": "#2d4a3e",
    --   "accent_color":  "#d4783c",
    --   "font_pairing":  "urbanist_urbanist",
    --   "layout_density": "comfortable",
    --   "button_style":  "rounded"
    -- }
    theme JSONB NOT NULL DEFAULT jsonb_build_object(
        'primary_color',  '#2d4a3e',
        'accent_color',   '#d4783c',
        'font_pairing',   'urbanist_urbanist',
        'layout_density', 'comfortable',
        'button_style',   'rounded'
    ),

    -- Ordered array of StorefrontSection objects. Each section:
    -- { id, type, order, enabled, settings: {...}, content: {...} }
    draft_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
    published_sections JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- SEO / publish metadata
    seo_title TEXT,
    seo_description TEXT,
    seo_image_url TEXT,

    published_at TIMESTAMP WITH TIME ZONE,

    -- Optimistic locking for concurrent editor tabs.
    version INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organization_storefronts_org_id
    ON organization_storefronts(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_storefronts_published
    ON organization_storefronts(published_at)
    WHERE published_at IS NOT NULL;

CREATE TRIGGER trg_organization_storefronts_updated_at
    BEFORE UPDATE ON organization_storefronts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE organization_storefronts IS
    'Per-org storefront customization (theme, draft + published section JSON).';
COMMENT ON COLUMN organization_storefronts.version IS
    'Optimistic-lock counter; increments on every draft write.';

-- ============================================================================
-- 2. storefront_collections
-- ============================================================================
CREATE TABLE IF NOT EXISTS storefront_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL
        REFERENCES organizations(id) ON DELETE CASCADE,

    name VARCHAR(120) NOT NULL,
    slug VARCHAR(140) NOT NULL,
    description TEXT,

    -- Manual: user hand-picks products (see storefront_collection_products).
    -- Smart:  products are derived by filter_rules at render time.
    is_manual BOOLEAN NOT NULL DEFAULT true,

    -- Example filter_rules for smart collections:
    -- { "categories": ["juices"], "tags": ["organic"], "is_featured": true }
    filter_rules JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Cover image shown in the collection_grid section card.
    cover_image_url TEXT,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_storefront_collections_org_id
    ON storefront_collections(organization_id);

CREATE TRIGGER trg_storefront_collections_updated_at
    BEFORE UPDATE ON storefront_collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE storefront_collections IS
    'Curated product groupings surfaced via the collection_grid storefront section.';

-- ============================================================================
-- 3. storefront_collection_products (manual membership)
-- ============================================================================
CREATE TABLE IF NOT EXISTS storefront_collection_products (
    collection_id UUID NOT NULL
        REFERENCES storefront_collections(id) ON DELETE CASCADE,
    product_id UUID NOT NULL
        REFERENCES products(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    PRIMARY KEY (collection_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_storefront_collection_products_collection
    ON storefront_collection_products(collection_id, position);
CREATE INDEX IF NOT EXISTS idx_storefront_collection_products_product
    ON storefront_collection_products(product_id);

COMMENT ON TABLE storefront_collection_products IS
    'Manual collection membership (ordered). Smart collections derive products via filter_rules instead.';

-- ============================================================================
-- 4. Per-product storefront visibility toggle.
-- Defaults to true so agroprocessors adopting storefronts don't lose their
-- existing catalog on first publish.
-- ============================================================================
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS is_storefront_visible BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN products.is_storefront_visible IS
    'When false, product is excluded from public storefront rendering regardless of section references.';

-- ============================================================================
-- 5. Slug blocklist — reject reserved words at creation time.
-- Enforced at the org slug trigger plus application layer. Listed here so any
-- DBA inspecting the schema sees the canonical list.
--   marketplace, admin, api, auth, store, seller, buyer, agroprocessor,
--   government, driver, qa, signup, login, help, dashboard, settings
-- (Enforcement: the NestJS storefronts service rejects these during slug
--  selection and on organization create if the auto-generated slug collides.)
-- ============================================================================
