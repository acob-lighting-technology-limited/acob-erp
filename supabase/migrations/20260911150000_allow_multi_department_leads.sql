-- Allow one employee to lead multiple departments.
--
-- The scoping layer (lib/admin/api-scope.ts, lib/tasks/assignment-scope.ts,
-- lib/dept/scope.ts, lib/admin/rbac.ts) has always read profiles.lead_departments
-- as an array, but three database objects pinned it to exactly one element:
--
--   1. check_lead_has_departments  -- CHECK (array_length(lead_departments,1) = 1)
--   2. enforce_single_department_lead()  -- wiped a rival lead's ENTIRE array
--   3. assign_department_lead()          -- overwrote lead_departments with one name
--
-- The invariant we keep is "one lead per department".
-- The invariant we drop is "one department per lead".
--
-- Baseline at time of writing: 12 leads, all holding exactly one department,
-- 12 departments with a head, 0 stale heads. This migration is a no-op on that data.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Constraint: a lead needs at least one department, no longer exactly one.
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS check_lead_has_departments;

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
      AND COALESCE(array_length(lead_departments, 1), 0) >= 1
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Trigger: demote rival leads surgically, and release dropped departments.
--
-- Previously this cleared the rival's whole lead_departments array, so giving
-- A one department stripped B of every department B led. It also never cleared
-- departments.department_head_id when a lead was unassigned, leaving stale heads.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_single_department_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_leads text[] := CASE
                      WHEN NEW.is_department_lead IS TRUE
                        THEN COALESCE(NEW.lead_departments, ARRAY[]::text[])
                      ELSE ARRAY[]::text[]
                    END;
  v_dept  text;
BEGIN
  -- Demoting a rival re-enters this trigger on their row. That nested pass can
  -- only re-assert state this pass already writes, so stop it from cascading.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- 2a. One lead per department: take only the contested department away from
  --     any other lead. Everything else they lead is left untouched.
  --     Clearing is_department_lead when nothing remains also lets the BEFORE
  --     SSOT trigger zero lead_department_ids, satisfying the CHECK above.
  FOREACH v_dept IN ARRAY v_leads LOOP
    UPDATE public.profiles p
    SET lead_departments   = array_remove(p.lead_departments, v_dept),
        is_department_lead = COALESCE(
                               array_length(array_remove(p.lead_departments, v_dept), 1), 0
                             ) > 0,
        updated_at         = NOW()
    WHERE p.id <> NEW.id
      AND p.is_department_lead IS TRUE
      AND v_dept = ANY(p.lead_departments);
  END LOOP;

  -- 2b. Point every department this profile leads at this profile.
  IF array_length(v_leads, 1) > 0 THEN
    UPDATE public.departments
    SET department_head_id = NEW.id,
        updated_at         = NOW()
    WHERE name = ANY(v_leads)
      AND department_head_id IS DISTINCT FROM NEW.id;
  END IF;

  -- 2c. Release any department this profile headed but no longer leads.
  --     With v_leads empty (lead flag turned off) this clears all of them.
  UPDATE public.departments
  SET department_head_id = NULL,
      updated_at         = NOW()
  WHERE department_head_id = NEW.id
    AND NOT (name = ANY(v_leads));

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_single_department_lead() FROM anon, PUBLIC;

-- ---------------------------------------------------------------------------
-- 3. RPC: assigning a department adds to the lead's set instead of replacing it.
--
-- Called from components/admin/department-leads-manager.tsx. The old version
-- cleared every other department the new lead headed, overwrote their
-- lead_departments with a single name, and moved their home department.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assign_department_lead(
  p_department_id uuid,
  p_new_lead_id   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dept_name   text;
  v_old_lead_id uuid;
BEGIN
  SELECT name, department_head_id
    INTO v_dept_name, v_old_lead_id
  FROM public.departments
  WHERE id = p_department_id;

  IF v_dept_name IS NULL THEN
    RAISE EXCEPTION 'Department not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_new_lead_id AND employment_status = 'active'
  ) THEN
    RAISE EXCEPTION 'New lead profile not found or inactive';
  END IF;

  -- Release the outgoing lead from this department only.
  IF v_old_lead_id IS NOT NULL AND v_old_lead_id <> p_new_lead_id THEN
    UPDATE public.profiles
    SET lead_departments   = array_remove(lead_departments, v_dept_name),
        is_department_lead = COALESCE(
                               array_length(array_remove(lead_departments, v_dept_name), 1), 0
                             ) > 0,
        updated_at         = NOW()
    WHERE id = v_old_lead_id;
  END IF;

  -- Add the department to the incoming lead's set. Their home department is
  -- only filled in when they do not already have one -- leading a second
  -- department must not relocate the employee.
  UPDATE public.profiles
  SET department         = COALESCE(NULLIF(trim(COALESCE(department, '')), ''), v_dept_name),
      department_id      = COALESCE(department_id, p_department_id),
      is_department_lead = true,
      lead_departments   = (
        SELECT array_agg(DISTINCT d ORDER BY d)
        FROM unnest(array_append(COALESCE(profiles.lead_departments, ARRAY[]::text[]), v_dept_name)) AS d
      ),
      updated_at         = NOW()
  WHERE id = p_new_lead_id;

  -- trg_enforce_single_department_lead syncs departments.department_head_id.
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_department_lead(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_department_lead(uuid, uuid) TO authenticated, service_role;

COMMIT;
