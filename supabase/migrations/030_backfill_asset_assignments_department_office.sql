-- ============================================
-- Backfill Department and Office Location for Individual Asset Assignments
-- ============================================
-- This migration populates department and office_location in asset_assignments
-- and assets tables for assets assigned to individuals, based on the user's profile

-- Step 1: Update asset_assignments table with user's department and office_location
UPDATE asset_assignments aa
SET 
  department = p.department,
  office_location = p.current_work_location
FROM profiles p
WHERE 
  aa.assigned_to = p.id
  AND aa.is_current = true
  AND aa.assigned_to IS NOT NULL
  AND (aa.department IS NULL OR aa.office_location IS NULL);

-- Step 2: Update assets table with department and office_location from current assignment
UPDATE assets a
SET 
  department = aa.department,
  office_location = aa.office_location
FROM asset_assignments aa
WHERE 
  a.id = aa.asset_id
  AND aa.is_current = true
  AND a.assignment_type = 'individual'
  AND a.status = 'assigned'
  AND (a.department IS NULL OR a.office_location IS NULL);

-- Verify the update
-- Run this query to check results:
-- SELECT 
--   a.unique_code,
--   a.assignment_type,
--   a.department as asset_department,
--   a.office_location as asset_office_location,
--   aa.department as assignment_department,
--   aa.office_location as assignment_office_location,
--   p.department as user_department,
--   p.current_work_location as user_office_location,
--   p.first_name,
--   p.last_name
-- FROM assets a
-- LEFT JOIN asset_assignments aa ON aa.asset_id = a.id AND aa.is_current = true
-- LEFT JOIN profiles p ON p.id = aa.assigned_to
-- WHERE a.status = 'assigned' AND aa.assigned_to IS NOT NULL
-- ORDER BY a.unique_code;













