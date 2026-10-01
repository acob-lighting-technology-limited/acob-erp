-- Lock browser-reachable write paths (audit 2026-10-01, findings A3–A6, 3.2, 3.3).
--
-- Every function below is SECURITY DEFINER, executable by `authenticated` (one by
-- `anon`), and performed a privileged write with caller-supplied ids and no role
-- check. All application callers now use the service role, so EXECUTE is limited
-- to service_role:
--   * atomic_leave_approve_final / _transition / _reject — any employee could
--     approve or reject any leave request, including their own.
--   * create_notification (both overloads), enqueue_asset_notification — anyone
--     could send any colleague a notification with any link (enqueue: even anon).
--   * atomic_assign_asset, release_asset, reassign_asset — reassign company assets.
--   * atomic_dispatch_correspondence — mark any letter dispatched.

BEGIN;

DO $$
DECLARE
  f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN (
        'atomic_leave_approve_final',
        'atomic_leave_approve_transition',
        'atomic_leave_reject',
        'create_notification',
        'enqueue_asset_notification',
        'atomic_assign_asset',
        'release_asset',
        'reassign_asset',
        'atomic_dispatch_correspondence'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- Requisitions (A4) --------------------------------------------------------------
-- All writes go through /api/requisitions* with the service role. The browser
-- never updates a requisition, so no UPDATE policy is needed at all; SELECT is
-- limited to the requester and admins (approver/lead views are served by the API).
DROP POLICY IF EXISTS users_update_requisitions ON public.requisitions;
DROP POLICY IF EXISTS users_select_requisitions ON public.requisitions;
CREATE POLICY requisitions_select_own_or_admin ON public.requisitions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin_like()));

-- Notifications ------------------------------------------------------------------
-- Inserts are server-only (createNotification → service role). The old INSERT
-- policies let any signed-in user insert a notification for anyone, which
-- bypassed the RPC lockdown above.
DROP POLICY IF EXISTS "Notifications insert policy" ON public.notifications;
DROP POLICY IF EXISTS "Staff can create notifications" ON public.notifications;
REVOKE INSERT ON public.notifications FROM anon, authenticated;

-- A user may only flip read state on their own rows — and cannot re-key a row to
-- someone else (the old policy had no WITH CHECK, so a user could rewrite one of
-- their notifications and reassign it to a colleague).
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
REVOKE UPDATE ON public.notifications FROM anon, authenticated;
GRANT UPDATE (read, read_at) ON public.notifications TO authenticated;

-- There was no DELETE policy, so "Delete notification" silently removed nothing.
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Over-exposed reference tables (3.2) ---------------------------------------------
-- Customer PII and payroll/salary config were readable by every employee via the
-- public anon key. No browser code reads them; admin pages use the service role.
DROP POLICY IF EXISTS "Customers select policy" ON public.customers;
CREATE POLICY "Customers select policy" ON public.customers
  FOR SELECT TO authenticated USING ((SELECT public.has_role('admin')));

DROP POLICY IF EXISTS "Payroll periods select policy" ON public.payroll_periods;
CREATE POLICY "Payroll periods select policy" ON public.payroll_periods
  FOR SELECT TO authenticated USING ((SELECT public.has_role('admin')));

DROP POLICY IF EXISTS "Salary components select policy" ON public.salary_components;
CREATE POLICY "Salary components select policy" ON public.salary_components
  FOR SELECT TO authenticated USING ((SELECT public.has_role('admin')));

DROP POLICY IF EXISTS "Profiles select policy" ON public.employee_department_history;
CREATE POLICY "Department history select policy" ON public.employee_department_history
  FOR SELECT TO authenticated USING ((SELECT public.has_role('admin')));

-- staff_directory (3.3) -------------------------------------------------------------
-- Org-wide name/department lookups need a view that bypasses the own-row profiles
-- policy, so it stays SECURITY DEFINER (owner rights) by design. It now exposes
-- work contact fields only; the personal `additional_email` / `additional_phone`
-- columns are removed. No application code reads them from this view.
DROP VIEW IF EXISTS public.staff_directory CASCADE;
CREATE VIEW public.staff_directory AS
  SELECT
    id,
    first_name,
    last_name,
    full_name,
    company_email,
    phone_number,
    department,
    designation,
    office_location,
    is_department_lead,
    lead_departments,
    employment_status
  FROM public.profiles;
COMMENT ON VIEW public.staff_directory IS
  'Org-wide staff directory (work fields only). Owner-rights by design: profiles RLS shows an employee only their own row.';
REVOKE ALL ON public.staff_directory FROM anon, PUBLIC;
GRANT SELECT ON public.staff_directory TO authenticated, service_role;

COMMIT;
