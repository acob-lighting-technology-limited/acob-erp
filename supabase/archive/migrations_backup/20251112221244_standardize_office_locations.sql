-- Migration: Standardize Office Locations and Link to Departments
-- Ensures all department offices are properly linked and adds missing common areas

-- Add Kitchen if it doesn't exist
INSERT INTO office_locations (name, type, department, description, is_active)
VALUES ('Kitchen', 'common_area', NULL, 'Company kitchen/common area', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Ensure all department offices are properly linked
-- Technical Extension should be linked to Technical department
UPDATE office_locations
SET 
  department = 'Technical',
  type = 'department_office',
  description = COALESCE(description, 'Technical Department Extension Office')
WHERE name = 'Technical Extension'
  AND (department IS NULL OR department != 'Technical');

-- Ensure Technical office is linked
UPDATE office_locations
SET 
  department = 'Technical',
  type = 'department_office',
  description = COALESCE(description, 'Technical Department Office')
WHERE name = 'Technical'
  AND (department IS NULL OR department != 'Technical');

-- Ensure Accounts office is linked
UPDATE office_locations
SET 
  department = 'Accounts',
  type = 'department_office',
  description = COALESCE(description, 'Accounts Department Office')
WHERE name = 'Accounts'
  AND (department IS NULL OR department != 'Accounts');

-- Ensure Admin & HR office is linked
UPDATE office_locations
SET 
  department = 'Admin & HR',
  type = 'department_office',
  description = COALESCE(description, 'Admin & HR Department Office')
WHERE name = 'Admin & HR'
  AND (department IS NULL OR department != 'Admin & HR');

-- Ensure Operations office is linked
UPDATE office_locations
SET 
  department = 'Operations',
  type = 'department_office',
  description = COALESCE(description, 'Operations Department Office')
WHERE name = 'Operations'
  AND (department IS NULL OR department != 'Operations');

-- Ensure Legal office is linked
UPDATE office_locations
SET 
  department = 'Legal, Regulatory and Compliance',
  type = 'department_office',
  description = COALESCE(description, 'Legal, Regulatory and Compliance Department Office')
WHERE name = 'Legal, Regulatory and Compliance'
  AND (department IS NULL OR department != 'Legal, Regulatory and Compliance');

-- Ensure Business office is linked
UPDATE office_locations
SET 
  department = 'Business, Growth and Innovation',
  type = 'department_office',
  description = COALESCE(description, 'Business, Growth and Innovation Department Office')
WHERE name = 'Business, Growth and Innovation'
  AND (department IS NULL OR department != 'Business, Growth and Innovation');

-- Ensure common areas have no department
UPDATE office_locations
SET department = NULL
WHERE type IN ('common_area', 'conference_room')
  AND department IS NOT NULL;

-- Ensure executive offices have no department
UPDATE office_locations
SET department = NULL
WHERE type = 'office'
  AND name IN ('MD Office', 'Assistant Executive Director')
  AND department IS NOT NULL;

-- Add descriptions for common areas
UPDATE office_locations
SET description = COALESCE(description, 'Main reception area')
WHERE name = 'Reception' AND type = 'common_area';

UPDATE office_locations
SET description = COALESCE(description, 'Company kitchen/common area')
WHERE name = 'Kitchen' AND type = 'common_area';

UPDATE office_locations
SET description = COALESCE(description, 'Media and control room')
WHERE name = 'Media/Control' AND type = 'common_area';

-- Add descriptions for conference rooms
UPDATE office_locations
SET description = COALESCE(description, 'Main conference room for general meetings')
WHERE name = 'General Conference Room' AND type = 'conference_room';

-- Add descriptions for executive offices
UPDATE office_locations
SET description = COALESCE(description, 'Managing Director''s private office')
WHERE name = 'MD Office' AND type = 'office';

UPDATE office_locations
SET description = COALESCE(description, 'Assistant Executive Director''s private office')
WHERE name = 'Assistant Executive Director' AND type = 'office';

-- Create a view for easy querying
CREATE OR REPLACE VIEW office_locations_by_type AS
SELECT 
  id,
  name,
  type,
  department,
  description,
  is_active,
  CASE 
    WHEN type = 'department_office' THEN 'Department Office'
    WHEN type = 'common_area' THEN 'Common Area'
    WHEN type = 'conference_room' THEN 'Conference Room'
    WHEN type = 'office' THEN 'Executive Office'
    ELSE 'Other'
  END as type_label
FROM office_locations
WHERE is_active = TRUE
ORDER BY 
  CASE type
    WHEN 'office' THEN 1
    WHEN 'department_office' THEN 2
    WHEN 'conference_room' THEN 3
    WHEN 'common_area' THEN 4
    ELSE 5
  END,
  department NULLS LAST,
  name;

-- Add helpful comments
COMMENT ON VIEW office_locations_by_type IS 
  'View of active office locations organized by type. Use this to filter offices by category.';

COMMENT ON TABLE office_locations IS 
  'Reference table for office/room locations. 
   Types: office (executive), department_office (linked to department), 
   conference_room (meeting spaces), common_area (shared spaces like Kitchen, Reception).';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

