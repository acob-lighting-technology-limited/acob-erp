
-- Fix duplicate current assignments by keeping only the most recent one per device
WITH ranked_assignments AS (
  SELECT 
    id,
    device_id,
    assigned_at,
    ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY assigned_at DESC) as rn
  FROM device_assignments
  WHERE is_current = true
)
UPDATE device_assignments
SET is_current = false,
    handed_over_at = COALESCE(handed_over_at, NOW()),
    handover_notes = COALESCE(handover_notes, 'Marked as not current due to duplicate assignments')
WHERE id IN (
  SELECT id 
  FROM ranked_assignments 
  WHERE rn > 1
);
;
