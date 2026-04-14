-- Add slug column to organizations for SEO-friendly seller URLs
-- Zero-downtime: nullable column + backfill + partial unique index + auto-gen trigger

-- 1. Add nullable column (instant on Postgres)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slug VARCHAR(255);

-- 2. Function to generate a unique organization slug (mirrors generate_product_slug)
CREATE OR REPLACE FUNCTION generate_organization_slug(org_name TEXT, org_id UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 1;
BEGIN
    base_slug := LOWER(TRIM(REGEXP_REPLACE(COALESCE(org_name, ''), '[^a-zA-Z0-9\s]', '', 'g')));
    base_slug := REGEXP_REPLACE(base_slug, '\s+', '-', 'g');
    base_slug := TRIM(base_slug, '-');

    IF LENGTH(base_slug) > 50 THEN
        base_slug := LEFT(base_slug, 50);
        base_slug := TRIM(base_slug, '-');
    END IF;

    IF base_slug IS NULL OR base_slug = '' THEN
        base_slug := 'seller';
    END IF;

    final_slug := base_slug;

    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM organizations
            WHERE slug = final_slug
            AND (org_id IS NULL OR id != org_id)
        ) THEN
            RETURN final_slug;
        END IF;

        counter := counter + 1;
        final_slug := base_slug || '-' || counter;

        IF counter > 1000 THEN
            final_slug := base_slug || '-' || EXTRACT(EPOCH FROM NOW())::INTEGER;
            RETURN final_slug;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. Backfill existing seller organizations
UPDATE organizations
SET slug = generate_organization_slug(name, id)
WHERE slug IS NULL AND account_type = 'seller';

-- 4. Partial unique index (only where slug is set, so buyer orgs don't need one)
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug
    ON organizations(slug)
    WHERE slug IS NOT NULL;

-- 5. BEFORE INSERT trigger: auto-generate slug for new seller orgs
CREATE OR REPLACE FUNCTION set_organization_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL AND NEW.account_type = 'seller' THEN
        NEW.slug := generate_organization_slug(NEW.name, NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_organization_slug ON organizations;
CREATE TRIGGER trg_organization_slug
    BEFORE INSERT ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION set_organization_slug();

COMMENT ON COLUMN organizations.slug IS 'URL-safe slug for SEO-friendly seller profile pages. Frozen after creation to preserve backlinks.';
