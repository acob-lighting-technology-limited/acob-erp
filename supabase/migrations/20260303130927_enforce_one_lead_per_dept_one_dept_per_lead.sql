-- Constraint 1: One person can only lead ONE department
-- Enforce by limiting lead_departments array to max 1 element
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_lead_has_departments;
ALTER TABLE public.profiles ADD CONSTRAINT check_lead_has_departments CHECK (
  (role <> 'lead'::user_role) 
  OR (
    lead_departments IS NOT NULL 
    AND array_length(lead_departments, 1) = 1
  )
);

-- Constraint 2: One department cannot have two leads
-- Create a unique partial index: only one profile can have a given department in lead_departments
-- We use a function to extract the single department name from the array
CREATE OR REPLACE FUNCTION public.lead_department_name(p profiles)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p.lead_departments[1];
$$;

-- Unique index: no two profiles can lead the same department
DROP INDEX IF EXISTS unique_lead_per_department;
CREATE UNIQUE INDEX unique_lead_per_department 
ON public.profiles (public.lead_department_name(profiles))
WHERE role = 'lead' AND lead_departments IS NOT NULL AND array_length(lead_departments, 1) = 1;

-- Also add unique constraint on departments.department_head_id (one head per dept)
-- First check if it exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'departments' AND indexname = 'unique_department_head'
  ) THEN
    CREATE UNIQUE INDEX unique_department_head ON public.departments (department_head_id) 
    WHERE department_head_id IS NOT NULL;
  END IF;
END;
$$;

-- Update the assign_department_lead function to properly manage lead_departments
-- and enforce the constraints
CREATE OR REPLACE FUNCTION public.assign_department_lead(p_department_id uuid, p_new_lead_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_dept_name TEXT;
    v_old_lead_id UUID;
    v_new_lead_current_dept TEXT;
BEGIN
    -- 1. Get department name
    SELECT name INTO v_dept_name FROM departments WHERE id = p_department_id;
    
    IF v_dept_name IS NULL THEN
        RAISE EXCEPTION 'Department not found';
    END IF;

    -- 2. Validate new lead exists and is active
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = p_new_lead_id 
        AND employment_status = 'active'
    ) THEN
        RAISE EXCEPTION 'New lead profile not found or inactive';
    END IF;

    -- 3. Get the current lead of this department (if any)
    SELECT department_head_id INTO v_old_lead_id 
    FROM departments WHERE id = p_department_id;

    -- 4. If the new lead is already leading ANOTHER department, remove them from it
    SELECT lead_departments[1] INTO v_new_lead_current_dept
    FROM profiles 
    WHERE id = p_new_lead_id 
      AND role = 'lead' 
      AND lead_departments IS NOT NULL 
      AND array_length(lead_departments, 1) > 0;
    
    IF v_new_lead_current_dept IS NOT NULL AND v_new_lead_current_dept <> v_dept_name THEN
        -- Clear their old department head reference
        UPDATE departments 
        SET department_head_id = NULL, updated_at = NOW()
        WHERE department_head_id = p_new_lead_id;
    END IF;

    -- 5. Demote the old lead of this department (if different from new lead)
    IF v_old_lead_id IS NOT NULL AND v_old_lead_id <> p_new_lead_id THEN
        UPDATE profiles
        SET role = 'employee',
            is_department_lead = false,
            lead_departments = ARRAY[]::text[],
            updated_at = NOW()
        WHERE id = v_old_lead_id;
    END IF;

    -- 6. Update the department record
    UPDATE departments
    SET department_head_id = p_new_lead_id,
        updated_at = NOW()
    WHERE id = p_department_id;

    -- 7. Promote the new lead (set exactly ONE department)
    UPDATE profiles
    SET role = 'lead',
        department = v_dept_name,
        department_id = p_department_id,
        is_department_lead = true,
        lead_departments = ARRAY[v_dept_name],
        updated_at = NOW()
    WHERE id = p_new_lead_id;

END;
$function$;;
