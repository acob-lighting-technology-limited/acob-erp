-- Migration: Rename Media/Control to IT and Communications Department Office
-- Changes Media/Control from common_area to department_office linked to IT and Communications

-- Step 1: Update office_locations table
-- First, if IT and Communications office doesn't exist, create it
INSERT INTO office_locations (name, type, department, description, is_active)
VALUES ('IT and Communications', 'department_office', 'IT and Communications', 'IT and Communications Department Office', TRUE)
ON CONFLICT (name) DO UPDATE
SET 
  type = 'department_office',
  department = 'IT and Communications',
  description = 'IT and Communications Department Office',
  is_active = TRUE;

-- Step 2: Update all assets that reference Media/Control to IT and Communications
UPDATE assets
SET office_location = 'IT and Communications'
WHERE office_location = 'Media/Control';

-- Step 3: Update all asset_assignments that reference Media/Control
UPDATE asset_assignments
SET office_location = 'IT and Communications'
WHERE office_location = 'Media/Control';

-- Step 4: Deactivate or delete the old Media/Control entry
UPDATE office_locations
SET is_active = FALSE
WHERE name = 'Media/Control';

-- Or delete it completely (uncomment if preferred):
-- DELETE FROM office_locations WHERE name = 'Media/Control';

-- Step 5: Update the check constraint to replace Media/Control with IT and Communications
ALTER TABLE assets
DROP CONSTRAINT IF EXISTS assets_office_location_check;

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
NOTIFY pgrst, 'reload schema';

