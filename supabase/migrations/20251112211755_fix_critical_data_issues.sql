
-- Fix Critical Database Issues
-- This migration addresses 3 critical issues found in comprehensive audit

-- 1. Fix Citibank project date swap (end before start)
UPDATE projects
SET 
  deployment_start_date = '2025-11-19',
  deployment_end_date = '2025-11-20',
  updated_at = NOW()
WHERE id = '512a2cc1-a11a-4786-9c96-8c9972d79c0b'
  AND project_name = 'Citibank';

-- 2. Fix 121 asset_assignments with wrong assignment_type
-- These are marked as 'individual' but have office_location (should be 'office')
UPDATE asset_assignments
SET 
  assignment_type = 'office'
WHERE assignment_type = 'individual' 
  AND assigned_to IS NULL 
  AND office_location IS NOT NULL 
  AND office_location != '';

-- 3. Clean up available assets with stale assignment_type
UPDATE assets
SET 
  assignment_type = NULL,
  department = NULL,
  office_location = NULL,
  updated_at = NOW()
WHERE status = 'available' 
  AND assignment_type IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM asset_assignments aa 
    WHERE aa.asset_id = assets.id AND aa.is_current = true
  );
;
