-- Clean up duplicate is_current device assignments
-- This migration finds devices with multiple is_current=true assignments and keeps only the most recent one

-- First, identify devices with duplicate current assignments
WITH duplicate_assignments AS (
  SELECT 
    device_id,
    COUNT(*) as count
  FROM device_assignments
  WHERE is_current = true
  GROUP BY device_id
  HAVING COUNT(*) > 1
),
-- For each device with duplicates, get all but the most recent assignment
assignments_to_update AS (
  SELECT da.id
  FROM device_assignments da
  INNER JOIN duplicate_assignments dup ON da.device_id = dup.device_id
  WHERE da.is_current = true
  AND da.id NOT IN (
    -- Keep only the most recent assignment for each device
    SELECT id
    FROM (
      SELECT 
        id,
        device_id,
        ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY assigned_at DESC) as rn
      FROM device_assignments
      WHERE is_current = true
    ) ranked
    WHERE rn = 1
  )
)
-- Mark all old duplicate assignments as not current
UPDATE device_assignments
SET 
  is_current = false,
  handed_over_at = NOW(),
  handover_notes = 'Cleaned up duplicate assignment'
WHERE id IN (SELECT id FROM assignments_to_update);

-- Log how many were cleaned up
DO $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO cleaned_count
  FROM device_assignments
  WHERE handover_notes = 'Cleaned up duplicate assignment';
  
  RAISE NOTICE 'Cleaned up % duplicate device assignments', cleaned_count;
END $$;

