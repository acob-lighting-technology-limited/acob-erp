-- ============================================
-- Clean Up Lead Roles
-- ============================================
-- This migration ensures consistency between role and lead_departments

-- For users with role = 'lead' but no lead_departments, set is_department_lead to false
UPDATE profiles
SET is_department_lead = false
WHERE role = 'lead' 
  AND (lead_departments IS NULL OR lead_departments = '{}' OR array_length(lead_departments, 1) IS NULL);

-- For users with role != 'lead', clear lead_departments and set is_department_lead to false
UPDATE profiles
SET 
  lead_departments = '{}',
  is_department_lead = false
WHERE role != 'lead'
  AND (lead_departments IS NOT NULL AND lead_departments != '{}' AND array_length(lead_departments, 1) > 0);

-- For users with role = 'lead' and lead_departments set, ensure is_department_lead is true
UPDATE profiles
SET is_department_lead = true
WHERE role = 'lead'
  AND lead_departments IS NOT NULL 
  AND lead_departments != '{}' 
  AND array_length(lead_departments, 1) > 0;

-- Add a constraint to ensure leads have at least one department
-- Note: This is a check constraint that will prevent future inconsistencies
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS check_lead_has_departments;

ALTER TABLE profiles
ADD CONSTRAINT check_lead_has_departments
CHECK (
  role != 'lead' OR 
  (lead_departments IS NOT NULL AND array_length(lead_departments, 1) > 0)
);

-- Create an index on lead_departments for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_lead_departments ON profiles USING GIN (lead_departments);

-- Add a comment to document this constraint
COMMENT ON CONSTRAINT check_lead_has_departments ON profiles IS 
  'Ensures that users with role = lead must have at least one department in lead_departments array';

