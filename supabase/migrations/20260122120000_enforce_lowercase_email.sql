-- Migration: Enforce lowercase email addresses
-- This migration:
-- 1. Normalizes all existing emails to lowercase
-- 2. Handles duplicate emails by keeping the most recently created account
-- 3. Creates a unique index on LOWER(email) to prevent case-insensitive duplicates
-- 4. Adds a trigger to automatically lowercase emails on insert/update

-- Step 1: Log and resolve duplicates
-- For each set of duplicate emails (case-insensitive), keep the most recently created
-- account active and deactivate the others
DO $$
DECLARE
    dup_record RECORD;
    keeper_id UUID;
    duplicate_count INT;
BEGIN
    -- Find emails that would be duplicates after lowercasing
    FOR dup_record IN
        SELECT LOWER(email) as lower_email, COUNT(*) as cnt
        FROM users
        GROUP BY LOWER(email)
        HAVING COUNT(*) > 1
    LOOP
        RAISE NOTICE 'Resolving duplicate email: % (% occurrences)', 
            dup_record.lower_email, dup_record.cnt;
        
        -- Find the most recently created user with this email (to keep)
        SELECT id INTO keeper_id
        FROM users
        WHERE LOWER(email) = dup_record.lower_email
        ORDER BY created_at DESC
        LIMIT 1;
        
        -- Deactivate all other users with this email
        UPDATE users
        SET is_active = false,
            email = CONCAT(email, '_duplicate_', id)
        WHERE LOWER(email) = dup_record.lower_email
          AND id != keeper_id;
        
        GET DIAGNOSTICS duplicate_count = ROW_COUNT;
        RAISE NOTICE 'Deactivated and renamed % duplicate account(s) for %', 
            duplicate_count, dup_record.lower_email;
    END LOOP;
END $$;

-- Step 2: Normalize all existing emails to lowercase
UPDATE users 
SET email = LOWER(TRIM(email)) 
WHERE email IS DISTINCT FROM LOWER(TRIM(email));

-- Step 3: Create a unique index on lowercase email
-- This prevents future case-insensitive duplicates at the database level
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique_idx 
ON users (LOWER(email));

-- Step 4: Create a trigger function to automatically lowercase emails
CREATE OR REPLACE FUNCTION lowercase_email()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email IS NOT NULL THEN
        NEW.email := LOWER(TRIM(NEW.email));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create the trigger
DROP TRIGGER IF EXISTS users_lowercase_email_trigger ON users;
CREATE TRIGGER users_lowercase_email_trigger
    BEFORE INSERT OR UPDATE OF email ON users
    FOR EACH ROW
    EXECUTE FUNCTION lowercase_email();

-- Add a comment explaining the constraint
COMMENT ON INDEX users_email_lower_unique_idx IS 'Enforces case-insensitive email uniqueness';
