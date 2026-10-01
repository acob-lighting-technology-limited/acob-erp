-- ============================================
-- Fix assignment_type constraint issue
-- ============================================

-- Drop the existing constraint if it exists
ALTER TABLE assets
DROP CONSTRAINT IF EXISTS assets_assignment_type_check;

-- Recreate the constraint to allow NULL values (for new assets before assignment)
ALTER TABLE assets
ADD CONSTRAINT assets_assignment_type_check
CHECK (assignment_type IS NULL OR assignment_type IN ('individual', 'department', 'office'));

-- Do the same for asset_assignments
ALTER TABLE asset_assignments
DROP CONSTRAINT IF EXISTS asset_assignments_assignment_type_check;

ALTER TABLE asset_assignments
ADD CONSTRAINT asset_assignments_assignment_type_check
CHECK (assignment_type IS NULL OR assignment_type IN ('individual', 'department', 'office'));

-- Set default to NULL instead of 'individual' for new assets
ALTER TABLE assets
ALTER COLUMN assignment_type DROP DEFAULT;

-- For asset_assignments, keep the default
ALTER TABLE asset_assignments
ALTER COLUMN assignment_type SET DEFAULT 'individual';
