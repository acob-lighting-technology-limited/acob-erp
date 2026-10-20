-- Profiles privilege lockdown (audit 2026-10-01, findings A1 + A2).
--
-- Before: the UPDATE policy allowed `id = auth.uid()` with no WITH CHECK, and
-- `authenticated` held UPDATE on every column. Any employee could run
--   supabase.from('profiles').update({ role: 'developer' }).eq('id', <me>)
-- from the browser and become a developer (has_role() reads profiles.role, and
-- sync_profile_role_to_user_roles copies the change into user_roles).
--
-- After:
--   * `authenticated` may UPDATE only personal/contact columns (column grants).
--     Role, department, lead, admin access, employment and HR-managed fields are
--     written only by admin API routes with the service role.
--   * A BEFORE UPDATE trigger rejects privileged-column changes from any session
--     caller that is not admin-like — a second wall if a grant is ever widened.
--   * The UPDATE policy gains a WITH CHECK so a row cannot be re-keyed.
--   * Bank fields are dropped: the ERP no longer stores staff bank details
--     (payroll keeps its own employee_salaries bank fields).

BEGIN;

-- 1. Column-level UPDATE grants -------------------------------------------------
REVOKE UPDATE ON public.profiles FROM authenticated;
REVOKE UPDATE ON public.profiles FROM anon;
GRANT UPDATE (
  first_name,
  last_name,
  other_names,
  phone_number,
  additional_phone,
  residential_address,
  office_location,
  email_notifications,
  birthday,
  birth_year,
  job_description,
  job_description_updated_at,
  updated_at
) ON public.profiles TO authenticated;

-- 2. Guard trigger ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Service role / background jobs have no auth.uid(); admins may edit anything.
  IF auth.uid() IS NULL OR public.has_role('admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.is_admin IS DISTINCT FROM OLD.is_admin
     OR NEW.admin_routes IS DISTINCT FROM OLD.admin_routes
     OR NEW.admin_domains IS DISTINCT FROM OLD.admin_domains
     OR NEW.is_department_lead IS DISTINCT FROM OLD.is_department_lead
     OR NEW.lead_departments IS DISTINCT FROM OLD.lead_departments
     OR NEW.lead_department_ids IS DISTINCT FROM OLD.lead_department_ids
     OR NEW.department IS DISTINCT FROM OLD.department
     OR NEW.department_id IS DISTINCT FROM OLD.department_id
     OR NEW.designation IS DISTINCT FROM OLD.designation
     OR NEW.employment_status IS DISTINCT FROM OLD.employment_status
     OR NEW.employment_type IS DISTINCT FROM OLD.employment_type
     OR NEW.employment_date IS DISTINCT FROM OLD.employment_date
     OR NEW.confirmation_date IS DISTINCT FROM OLD.confirmation_date
     OR NEW.employee_number IS DISTINCT FROM OLD.employee_number
     OR NEW.company_email IS DISTINCT FROM OLD.company_email
     OR NEW.attendance_exempt IS DISTINCT FROM OLD.attendance_exempt
     OR NEW.contract_category_id IS DISTINCT FROM OLD.contract_category_id
     OR NEW.device_key IS DISTINCT FROM OLD.device_key
  THEN
    RAISE EXCEPTION 'not allowed to change privileged profile fields'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_profile_privileged_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_profile_privileged ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileged
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();

-- 3. UPDATE policy with WITH CHECK -----------------------------------------------
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
CREATE POLICY "Profiles update policy" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()) OR (SELECT public.is_admin_like()))
  WITH CHECK (id = (SELECT auth.uid()) OR (SELECT public.is_admin_like()));

-- 4. Drop staff bank details -----------------------------------------------------
-- staff_directory does not reference these columns; no view depends on them.
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS bank_name,
  DROP COLUMN IF EXISTS bank_account_number,
  DROP COLUMN IF EXISTS bank_account_name;

COMMIT;

-- Verify (run manually after applying):
--   BEGIN;
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<employee uuid>","role":"authenticated"}';
--   UPDATE public.profiles SET role = 'developer' WHERE id = '<employee uuid>';  -- must fail
--   ROLLBACK;
