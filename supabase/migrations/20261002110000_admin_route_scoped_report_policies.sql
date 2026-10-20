-- Admin access in RLS follows admin_routes, not the legacy admin_domains.
--
-- An admin is a super_admin scoped to their assigned routes (lib/admin/policy-v2.ts).
-- The app gates on admin_routes, but these report-area policies still checked
-- profiles.admin_domains, where NULL meant "every domain":
--
--   * too wide  - an admin with admin_domains NULL (every admin but one today)
--                 passed reports RLS whatever routes they held, e.g. an HR/assets
--                 admin could write weekly reports, KSS and meeting documents;
--   * too narrow - an admin with admin_domains set and no 'reports' entry was
--                 refused even after being granted the reports routes.
--
-- Each `role = 'admin' AND (admin_domains IS NULL OR 'reports' = ANY(...))`
-- clause becomes current_user_holds_admin_route(<route>):
--   weekly_reports                        -> reports.weekly
--   audit_logs                            -> auditlogs.main (was gated on reports)
--   action_items, kss_weekly_roster,
--   meeting_week_documents,
--   meeting_artifact_sources,
--   weekly_report_meeting_windows         -> reports.other
--
-- Closed weeks: general-meeting data (KSS roster, meeting documents, meeting
-- windows) now uses meeting_week_can_mutate, which also lets reports.other
-- admins through, matching canOverrideReportsWeekLock in lib/admin/rbac.ts.
-- weekly_reports keeps weekly_report_can_mutate unchanged: staff weekly report
-- submissions stay locked for everyone below super_admin.
--
-- Must run after 20261002100300_rls_policy_consolidation, which renames and
-- merges some action_items policies. The rewrite reads pg_policies at apply
-- time, so it covers whatever names exist then.

BEGIN;

-- 1. Helpers -----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_holds_admin_route(p_routes text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  -- Mirrors canAccessRouteV2: developer/super_admin hold every route; an admin
  -- holds what admin_routes grants. Callers pass every key that grants access.
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        lower(trim(p.role::text)) IN ('developer', 'super_admin')
        OR (lower(trim(p.role::text)) = 'admin' AND COALESCE(p.admin_routes, ARRAY[]::text[]) && p_routes)
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.current_user_holds_admin_route(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_holds_admin_route(text[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.meeting_week_can_mutate(p_week integer, p_year integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT public.weekly_report_can_mutate(p_week, p_year)
      OR public.current_user_holds_admin_route(ARRAY['reports.other'])
$$;

REVOKE EXECUTE ON FUNCTION public.meeting_week_can_mutate(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meeting_week_can_mutate(integer, integer) TO authenticated, service_role;

-- 2. Rewrite the policies from their live text --------------------------------------

DO $$
DECLARE
  pol record;
  route text;
  new_qual text;
  new_check text;
  sql text;
  -- Deparsed form of: lower(trim(p.role::text)) = 'admin' AND (p.admin_domains IS NULL OR 'reports' = ANY (p.admin_domains))
  domain_clause constant text :=
    '\(\(lower\(TRIM\(BOTH FROM \(p\.role\)::text\)\) = ''admin''::text\) AND \(\(p\.admin_domains IS NULL\) OR \(''reports''::text = ANY \(p\.admin_domains\)\)\)\)';
BEGIN
  FOR pol IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'action_items', 'audit_logs', 'kss_weekly_roster', 'meeting_artifact_sources',
        'meeting_week_documents', 'weekly_report_meeting_windows', 'weekly_reports'
      )
      AND (COALESCE(qual, '') || COALESCE(with_check, '')) ~ 'admin_domains|weekly_report_can_mutate'
  LOOP
    route := CASE pol.tablename
      WHEN 'weekly_reports' THEN 'reports.weekly'
      WHEN 'audit_logs' THEN 'auditlogs.main'
      ELSE 'reports.other'
    END;

    new_qual := regexp_replace(
      pol.qual, domain_clause, format('public.current_user_holds_admin_route(ARRAY[%L])', route), 'g');
    new_check := regexp_replace(
      pol.with_check, domain_clause, format('public.current_user_holds_admin_route(ARRAY[%L])', route), 'g');

    IF pol.tablename IN ('kss_weekly_roster', 'meeting_week_documents', 'weekly_report_meeting_windows') THEN
      new_qual := replace(new_qual, 'weekly_report_can_mutate(', 'public.meeting_week_can_mutate(');
      new_check := replace(new_check, 'weekly_report_can_mutate(', 'public.meeting_week_can_mutate(');
    END IF;

    IF new_qual IS NOT DISTINCT FROM pol.qual AND new_check IS NOT DISTINCT FROM pol.with_check THEN
      CONTINUE;
    END IF;

    sql := format('ALTER POLICY %I ON public.%I', pol.policyname, pol.tablename);
    IF new_qual IS NOT NULL THEN
      sql := sql || format(' USING (%s)', new_qual);
    END IF;
    IF new_check IS NOT NULL THEN
      sql := sql || format(' WITH CHECK (%s)', new_check);
    END IF;
    EXECUTE sql;
  END LOOP;
END $$;

-- 3. Fail the migration rather than leave a half-converted policy ------------------

DO $$
DECLARE
  leftover text;
BEGIN
  SELECT string_agg(format('%s.%s', tablename, policyname), ', ')
  INTO leftover
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (COALESCE(qual, '') || COALESCE(with_check, '')) ~ 'admin_domains';

  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION 'policies still reference admin_domains: %', leftover;
  END IF;
END $$;

COMMIT;
