-- Core Data Model Improvements
-- 1. Add full_name computed column to profiles
-- 2. Migrate department from TEXT to foreign key
-- 3. Add site column to office_locations
-- 4. Mark deprecated device fields

-- =====================================================
-- 1. ADD FULL_NAME COMPUTED COLUMN
-- =====================================================

ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS full_name TEXT 
  GENERATED ALWAYS AS (
    TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
  ) STORED;

COMMENT ON COLUMN profiles.full_name IS 'Computed column combining first_name and last_name';

-- =====================================================
-- 2. MIGRATE DEPARTMENT TO FOREIGN KEY
-- =====================================================

-- Add new department_id column
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

-- Migrate existing data
UPDATE profiles p
SET department_id = d.id
FROM departments d
WHERE p.department = d.name;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_department_id ON profiles(department_id);

-- Mark old column as deprecated (keep for backward compatibility)
COMMENT ON COLUMN profiles.department IS 'DEPRECATED: Use department_id instead. Kept for backward compatibility.';

-- =====================================================
-- 3. ADD SITE COLUMN TO OFFICE_LOCATIONS
-- =====================================================

ALTER TABLE office_locations 
  ADD COLUMN IF NOT EXISTS site TEXT;

-- Set default site for existing records
UPDATE office_locations
SET site = 'Head Office'
WHERE site IS NULL;

COMMENT ON COLUMN office_locations.site IS 'Site location (e.g., Head Office, Branch Office, Remote Site)';

-- =====================================================
-- 4. MARK DEPRECATED DEVICE FIELDS
-- =====================================================

COMMENT ON COLUMN profiles.device_allocated IS 'DEPRECATED: Use assets table instead';
COMMENT ON COLUMN profiles.device_type IS 'DEPRECATED: Use assets table instead';
COMMENT ON COLUMN profiles.device_model IS 'DEPRECATED: Use assets table instead';
COMMENT ON COLUMN profiles.devices IS 'DEPRECATED: Use assets table instead';

-- =====================================================
-- 5. ADD INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON profiles(full_name);
CREATE INDEX IF NOT EXISTS idx_office_locations_site ON office_locations(site);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
