-- ============================================
-- Add Office Location and Standardize Departments
-- ============================================

-- Add office_location column to assets table
ALTER TABLE assets
ADD COLUMN IF NOT EXISTS office_location TEXT;

-- Add office_location column to asset_assignments table
ALTER TABLE asset_assignments
ADD COLUMN IF NOT EXISTS office_location TEXT;

-- Create index for office_location
CREATE INDEX IF NOT EXISTS idx_assets_office_location ON assets(office_location);

-- Update existing office assignments to use the new office_location field
-- Move office-type departments to office_location
UPDATE assets
SET office_location = department,
    department = NULL
WHERE assignment_type = 'office' AND department IS NOT NULL;

UPDATE asset_assignments
SET office_location = department,
    department = NULL
WHERE assignment_type = 'office' AND department IS NOT NULL;

-- Standardize department names to the new list
-- Old department names will be mapped to new ones or removed

-- Clean up departments that are actually office locations
UPDATE assets
SET department = CASE
  WHEN department IN ('Reception', 'Kitchen', 'General Conference Room', 'MD Conference Room',
                      'MD Office', 'Media/Control', 'Assistant Executive Director', 'Technical Extension')
    THEN NULL
  WHEN department = 'Admin and HR' THEN 'Admin & HR'
  WHEN department = 'Legal and Compliance' THEN 'Legal, Regulatory and Compliance'
  WHEN department = 'Legal, Regulatory & Compliance' THEN 'Legal, Regulatory and Compliance'
  WHEN department = 'IT & Communications' THEN 'IT and Communications'
  WHEN department = 'Business Growth and Innovation' THEN 'Business, Growth and Innovation'
  WHEN department = 'Business, Growth & Innovation' THEN 'Business, Growth and Innovation'
  ELSE department
END
WHERE department IS NOT NULL;

-- Standardize departments in asset_assignments
UPDATE asset_assignments
SET department = CASE
  WHEN department IN ('Reception', 'Kitchen', 'General Conference Room', 'MD Conference Room',
                      'MD Office', 'Media/Control', 'Assistant Executive Director', 'Technical Extension')
    THEN NULL
  WHEN department = 'Admin and HR' THEN 'Admin & HR'
  WHEN department = 'Legal and Compliance' THEN 'Legal, Regulatory and Compliance'
  WHEN department = 'Legal, Regulatory & Compliance' THEN 'Legal, Regulatory and Compliance'
  WHEN department = 'IT & Communications' THEN 'IT and Communications'
  WHEN department = 'Business Growth and Innovation' THEN 'Business, Growth and Innovation'
  WHEN department = 'Business, Growth & Innovation' THEN 'Business, Growth and Innovation'
  ELSE department
END
WHERE department IS NOT NULL;

-- Update assignment_type to 'office' for records that now have office_location set
UPDATE assets
SET assignment_type = 'office'
WHERE office_location IS NOT NULL AND assignment_type != 'office';

UPDATE asset_assignments
SET assignment_type = 'office'
WHERE office_location IS NOT NULL AND assignment_type != 'office';

-- Add check constraint to ensure only valid departments are used
ALTER TABLE assets
DROP CONSTRAINT IF EXISTS assets_department_check;

ALTER TABLE assets
ADD CONSTRAINT assets_department_check
CHECK (
  department IS NULL OR
  department IN (
    'Accounts',
    'Admin & HR',
    'Business, Growth and Innovation',
    'IT and Communications',
    'Legal, Regulatory and Compliance',
    'Logistics',
    'Operations',
    'Technical'
  )
);

-- Add check constraint for office locations
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
    'Kitchen',
    'Legal, Regulatory and Compliance',
    'MD Conference Room',
    'MD Office',
    'Media/Control',
    'Operations',
    'Reception',
    'Technical',
    'Technical Extension'
  )
);

-- Update comments
COMMENT ON COLUMN assets.department IS 'Department assignment (standardized list): Accounts, Admin & HR, Business, Growth and Innovation, IT and Communications, Legal, Regulatory and Compliance, Logistics, Operations, Technical';
COMMENT ON COLUMN assets.office_location IS 'Office location/room for office assignments: Accounts, Admin & HR, Assistant Executive Director, Business, Growth and Innovation, General Conference Room, Kitchen, Legal, Regulatory and Compliance, MD Conference Room, MD Office, Media/Control, Operations, Reception, Technical, Technical Extension';
COMMENT ON COLUMN assets.assignment_type IS 'Assignment type: individual (assigned to person), department (assigned to department), office (assigned to office location)';
