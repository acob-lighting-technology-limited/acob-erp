-- ============================================
-- Standardize Department Names
-- Update "Administrative" to "Admin & HR"
-- Remove "Others" department
-- ============================================

-- Update profiles table
UPDATE profiles
SET department = 'Admin & HR'
WHERE department = 'Administrative';

-- Remove "Others" from profiles (you might want to reassign these manually)
-- For now, we'll set them to NULL so they can be reassigned
UPDATE profiles
SET department = NULL
WHERE department = 'Others';

-- Update lead_departments array in profiles
UPDATE profiles
SET lead_departments = array_replace(lead_departments, 'Administrative', 'Admin & HR')
WHERE 'Administrative' = ANY(lead_departments);

-- Remove 'Others' from lead_departments
UPDATE profiles
SET lead_departments = array_remove(lead_departments, 'Others')
WHERE 'Others' = ANY(lead_departments);

-- Update tasks table
UPDATE tasks
SET department = 'Admin & HR'
WHERE department = 'Administrative';

UPDATE tasks
SET department = NULL
WHERE department = 'Others';

-- Update asset_assignments table
UPDATE asset_assignments
SET department = 'Admin & HR'
WHERE department = 'Administrative';

UPDATE asset_assignments
SET department = NULL
WHERE department = 'Others';

-- Update assets table
UPDATE assets
SET department = 'Admin & HR'
WHERE department = 'Administrative';

UPDATE assets
SET department = NULL
WHERE department = 'Others';

-- Update device_assignments table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'device_assignments') THEN
    UPDATE device_assignments
    SET department = 'Admin & HR'
    WHERE department = 'Administrative';

    UPDATE device_assignments
    SET department = NULL
    WHERE department = 'Others';
  END IF;
END $$;

-- Update devices table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'devices') THEN
    UPDATE devices
    SET department = 'Admin & HR'
    WHERE department = 'Administrative';

    UPDATE devices
    SET department = NULL
    WHERE department = 'Others';
  END IF;
END $$;

-- Show summary of changes
DO $$
DECLARE
  admin_hr_count INTEGER;
  null_dept_count INTEGER;
BEGIN
  RAISE NOTICE '=== Department Standardization Complete ===';

  SELECT COUNT(*) INTO admin_hr_count
  FROM profiles
  WHERE department = 'Admin & HR';

  SELECT COUNT(*) INTO null_dept_count
  FROM profiles
  WHERE department IS NULL;

  RAISE NOTICE 'Profiles with "Admin & HR": %', admin_hr_count;
  RAISE NOTICE 'Profiles with NULL department (need manual assignment): %', null_dept_count;
END $$;
