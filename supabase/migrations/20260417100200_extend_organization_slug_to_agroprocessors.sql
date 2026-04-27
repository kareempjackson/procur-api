-- Extend organization slug generation to cover agroprocessor orgs.
-- Agroprocessors need a slug to power /store/[slug] public storefront URLs.

-- 1. Backfill existing agroprocessor organizations (no-op if none yet).
UPDATE organizations
SET slug = generate_organization_slug(name, id)
WHERE slug IS NULL AND account_type = 'agroprocessor';

-- 2. Widen the BEFORE INSERT trigger to also slug agroprocessors.
CREATE OR REPLACE FUNCTION set_organization_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL AND NEW.account_type IN ('seller', 'agroprocessor') THEN
        NEW.slug := generate_organization_slug(NEW.name, NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
