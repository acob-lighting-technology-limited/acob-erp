-- Enforce that a department lead can only lead their own department.
-- Use NOT VALID so existing bad rows can be cleaned up separately while
-- all new inserts/updates are still checked immediately.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS check_lead_matches_department;

ALTER TABLE public.profiles
  ADD CONSTRAINT check_lead_matches_department
  CHECK (
    is_department_lead = false
    OR (
      department IS NOT NULL
      AND lead_departments IS NOT NULL
      AND array_length(lead_departments, 1) = 1
      AND lead_departments[1] = department
    )
  ) NOT VALID;
