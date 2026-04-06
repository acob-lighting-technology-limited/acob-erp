-- Enforce exactly one lead per department via trigger.
--
-- Previously, the assign_department_lead() function handled demotion,
-- but only when called explicitly. Direct profile updates (admin UI,
-- manual SQL) could create duplicate leads for the same department.
--
-- This trigger fires on any profile INSERT/UPDATE that sets
-- is_department_lead = true, and automatically:
--   1. Demotes any other profile that was lead for the same department(s)
--   2. Syncs the departments.department_head_id column

CREATE OR REPLACE FUNCTION enforce_single_department_lead()
RETURNS TRIGGER AS $$
DECLARE
  dept TEXT;
BEGIN
  IF NEW.is_department_lead = true AND array_length(NEW.lead_departments, 1) > 0 THEN
    FOREACH dept IN ARRAY NEW.lead_departments LOOP
      UPDATE profiles
      SET is_department_lead = false,
          lead_departments = ARRAY[]::text[],
          updated_at = NOW()
      WHERE id <> NEW.id
        AND is_department_lead = true
        AND dept = ANY(lead_departments);

      UPDATE departments
      SET department_head_id = NEW.id,
          updated_at = NOW()
      WHERE name = dept;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_single_department_lead ON profiles;

CREATE TRIGGER trg_enforce_single_department_lead
  AFTER INSERT OR UPDATE OF is_department_lead, lead_departments
  ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_single_department_lead();
