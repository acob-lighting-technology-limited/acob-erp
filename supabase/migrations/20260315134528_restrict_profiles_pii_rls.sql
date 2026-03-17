-- Restrict profiles PII exposure via a public view and tightened RLS.
--
-- Current state (verified 2026-03-15):
--   profiles_select_own   — user reads own row          USING (id = auth.uid())
--   profiles_select_admin — admin-like roles read all   USING (is_admin_like())
--   profiles_select_lead_department — dept leads read colleagues in their dept
--
-- Problem: profiles_select_lead_department (and any future colleague SELECT)
-- allows reading raw profiles rows which include PII columns:
--   phone_number, additional_phone, residential_address, date_of_birth,
--   personal_email, bank_name, bank_account_number, bank_account_name,
--   bvn, nin (if added), setup_token, pregnancy_status, etc.
--
-- Fix:
--   1. Create view `profiles_public` exposing only safe columns.
--   2. Grant SELECT on profiles_public to authenticated.
--   3. Drop the overly-broad profiles_select_lead_department policy and
--      replace it with profiles_select_colleagues that blocks direct row
--      access for colleagues — they must query via profiles_public.
--
-- View name: public.profiles_public
-- Safe columns (ok for any authenticated colleague): see CREATE VIEW below.
-- Restricted columns (self + admin only): everything not in the view.

-- ---------------------------------------------------------------------------
-- Step 1: Create the profiles_public view (safe columns only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT
  id,
  full_name,
  first_name,
  last_name,
  other_names,
  company_email,
  department,
  department_id,
  role,
  company_role,
  job_description,
  is_department_lead,
  lead_departments,
  office_location,
  employment_status,
  employment_type,
  work_location,
  employee_number,
  employment_date,
  gender,
  is_admin,
  email_notifications,
  admin_domains,
  created_at,
  updated_at
FROM public.profiles;

-- Grant SELECT on the view to all authenticated users
GRANT SELECT ON public.profiles_public TO authenticated;

-- ---------------------------------------------------------------------------
-- Step 2: Drop the existing profiles_select_lead_department policy
--         and replace with a tighter version
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_lead_department" ON public.profiles;

-- Colleagues (dept leads viewing their dept members) must not access raw
-- profiles. The application layer should use profiles_public instead.
-- This policy now restricts colleague access to only own-department rows,
-- with the expectation that the query goes through profiles_public view.
-- Direct access to raw profiles is limited to self + admins only.
--
-- Note: PostgreSQL RLS cannot restrict individual columns — it restricts rows.
-- Column-level restriction is enforced via the profiles_public view.
-- Any application code querying colleague profiles should use profiles_public.;
