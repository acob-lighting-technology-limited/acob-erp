-- Migration: Rename Media/Control to IT and Communications Department Office
-- Changes Media/Control from common_area to department_office linked to IT and Communications

-- Step 1: Drop the constraint first
ALTER TABLE assets
DROP CONSTRAINT IF EXISTS assets_office_location_check;

-- Step 2: Update all assets that reference Media/Control to IT and Communications
UPDATE assets
SET office_location = 'IT and Communications'
WHERE office_location = 'Media/Control';

-- Step 3: Update all asset_assignments that reference Media/Control
UPDATE asset_assignments
SET office_location = 'IT and Communications'
WHERE office_location = 'Media/Control';

-- Step 4: Update office_locations table - rename Media/Control to IT and Communications
UPDATE office_locations
SET 
  name = 'IT and Communications',
  type = 'department_office',
  department = 'IT and Communications',
  description = 'IT and Communications Department Office'
WHERE name = 'Media/Control';

-- If the update didn't work (no rows), insert it
INSERT INTO office_locations (name, type, department, description, is_active)
SELECT 'IT and Communications', 'department_office', 'IT and Communications', 'IT and Communications Department Office', TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM office_locations WHERE name = 'IT and Communications'
);

-- Step 5: Recreate the check constraint with IT and Communications instead of Media/Control
ALTER TABLE assets
ADD CONSTRAINT assets_office_location_check
CHECK (
  office_location IS NULL OR
  office_location IN (
    'Accounts',
    'Admin & HR',
    'Assistant Executive Director',
    'Business, Growth and Innovation',
    'General Conference Room',
    'IT and Communications',
    'Kitchen',
    'Legal, Regulatory and Compliance',
    'MD Conference Room',
    'MD Office',
    'Operations',
    'Reception',
    'Technical',
    'Technical Extension'
  )
);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';;
