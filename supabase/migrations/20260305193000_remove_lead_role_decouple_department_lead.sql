-- Remove legacy 'lead' system role and keep department leadership as an independent identity.

-- 1) Normalize existing role values before enum replacement.
UPDATE public.profiles
SET role = 'employee'
WHERE role::text IN ('lead', 'staff');

UPDATE public.dev_login_logs
SET role = 'employee'
WHERE role::text IN ('lead', 'staff');

-- 2) Drop dependent view before enum type swap.
DROP VIEW IF EXISTS public.dev_login_logs_enriched;

-- 3) Drop legacy role-dependent constraint before enum replacement.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS check_lead_has_departments;

DROP INDEX IF EXISTS public.unique_lead_per_department;

-- 4) Move role columns to text first to avoid enum cross-cast issues.
ALTER TABLE public.profiles
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role TYPE text
  USING role::text;

ALTER TABLE public.dev_login_logs
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role TYPE text
  USING role::text;

-- 5) Replace user_role enum without legacy values.
ALTER TYPE public.user_role RENAME TO user_role_old;

CREATE TYPE public.user_role AS ENUM (
  'visitor',
  'employee',
  'admin',
  'super_admin',
  'developer'
);

ALTER TABLE public.profiles
  ALTER COLUMN role TYPE public.user_role
  USING role::public.user_role;

ALTER TABLE public.dev_login_logs
  ALTER COLUMN role TYPE public.user_role
  USING role::public.user_role;

DROP TYPE public.user_role_old;

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'employee'::public.user_role;

-- 6) Recreate compatibility view.
CREATE OR REPLACE VIEW public.dev_login_logs_enriched
WITH (security_invoker = true) AS
SELECT
  dll.id,
  dll.user_id,
  dll.email,
  COALESCE(NULLIF(dll.full_name, ''), NULLIF(p.full_name, ''), concat_ws(' ', p.first_name, p.last_name), dll.email) AS full_name,
  dll.role,
  p.department,
  dll.ip_address,
  dll.user_agent,
  dll.auth_method,
  dll.login_at,
  dll.metadata
FROM public.dev_login_logs dll
LEFT JOIN public.profiles p ON p.id = dll.user_id;

GRANT SELECT ON public.dev_login_logs_enriched TO authenticated, service_role;

-- 7) Keep legacy required_role('lead') checks working via is_department_lead.
CREATE OR REPLACE FUNCTION public.has_role(required_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_role text;
  current_is_department_lead boolean := false;
BEGIN
  SELECT role::text, COALESCE(is_department_lead, false)
    INTO current_role, current_is_department_lead
  FROM public.profiles
  WHERE id = auth.uid();

  CASE required_role
    WHEN 'visitor' THEN
      RETURN current_role IN ('visitor', 'employee', 'admin', 'super_admin', 'developer') OR current_is_department_lead;
    WHEN 'employee', 'staff' THEN
      RETURN current_role IN ('employee', 'admin', 'super_admin', 'developer') OR current_is_department_lead;
    WHEN 'lead' THEN
      RETURN current_is_department_lead OR current_role IN ('admin', 'super_admin', 'developer');
    WHEN 'admin' THEN
      RETURN current_role IN ('admin', 'super_admin', 'developer');
    WHEN 'super_admin' THEN
      RETURN current_role IN ('super_admin', 'developer');
    WHEN 'developer' THEN
      RETURN current_role = 'developer';
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- 8) Keep lead department integrity independent of role enum.
ALTER TABLE public.profiles
  ADD CONSTRAINT check_lead_has_departments
  CHECK (
    (
      is_department_lead = false
      AND COALESCE(array_length(lead_departments, 1), 0) = 0
    )
    OR
    (
      is_department_lead = true
      AND lead_departments IS NOT NULL
      AND array_length(lead_departments, 1) = 1
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS unique_lead_per_department
  ON public.profiles USING btree (lead_department_name(profiles.*))
  WHERE (
    is_department_lead = true
    AND lead_departments IS NOT NULL
    AND array_length(lead_departments, 1) = 1
  );

-- 9) Department lead assignment RPC must not mutate system role.
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

    -- 3. Get current lead for this department
    SELECT department_head_id INTO v_old_lead_id
    FROM departments
    WHERE id = p_department_id;

    -- 4. If new lead already leads another department, clear that department head reference
    SELECT lead_departments[1] INTO v_new_lead_current_dept
    FROM profiles
    WHERE id = p_new_lead_id
      AND is_department_lead = true
      AND lead_departments IS NOT NULL
      AND array_length(lead_departments, 1) > 0;

    IF v_new_lead_current_dept IS NOT NULL AND v_new_lead_current_dept <> v_dept_name THEN
        UPDATE departments
        SET department_head_id = NULL,
            updated_at = NOW()
        WHERE department_head_id = p_new_lead_id;
    END IF;

    -- 5. Demote old lead identity for this department (role remains unchanged)
    IF v_old_lead_id IS NOT NULL AND v_old_lead_id <> p_new_lead_id THEN
        UPDATE profiles
        SET is_department_lead = false,
            lead_departments = ARRAY[]::text[],
            updated_at = NOW()
        WHERE id = v_old_lead_id;
    END IF;

    -- 6. Update department record
    UPDATE departments
    SET department_head_id = p_new_lead_id,
        updated_at = NOW()
    WHERE id = p_department_id;

    -- 7. Promote new lead identity (role remains unchanged)
    UPDATE profiles
    SET department = v_dept_name,
        department_id = p_department_id,
        is_department_lead = true,
        lead_departments = ARRAY[v_dept_name],
        updated_at = NOW()
    WHERE id = p_new_lead_id;
END;
$function$;
