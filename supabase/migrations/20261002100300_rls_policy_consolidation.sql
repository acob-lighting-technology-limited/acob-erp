-- RLS policy consolidation (audit 3.5 "multiple permissive policies").
--
-- Permissive policies for the same table/command/role are OR-ed by Postgres and
-- each one is evaluated per row. Merging them into one policy with an explicit
-- OR keeps the exact same access semantics and halves the per-row work.
-- Two groups are rewritten by hand because the old text was wrong, not just slow:
--
--   (Admin access follows admin_routes via current_user_holds_admin_route, matching
--   20261002110000, which went live first; admin_domains is no longer consulted.)
--
--   * action_items UPDATE "Users can update their own action items or admins/leads"
--     had `... OR (role = 'admin' AND ...)` *outside* the `p.id = auth.uid()`
--     bracket, so the EXISTS matched any admin's row and every signed-in user
--     could update every action item.
--   * Policies scoped `TO public` (anon included) are re-created `TO authenticated`.

BEGIN;

-- 1. action_items: correct UPDATE + single INSERT --------------------------------
DROP POLICY IF EXISTS "Users can update own dept action items" ON public.action_items;
DROP POLICY IF EXISTS "Users can update their own action items or admins/leads" ON public.action_items;
CREATE POLICY action_items_update ON public.action_items
  FOR UPDATE TO authenticated
  USING (
    assigned_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (
          lower(trim(p.role::text)) IN ('developer', 'super_admin')
          OR public.current_user_holds_admin_route(ARRAY['reports.other'])
          OR ((lower(trim(p.role::text)) = 'admin' OR p.is_department_lead)
              AND (action_items.department = p.department
                   OR action_items.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[]))))
        )
    )
  )
  WITH CHECK (
    assigned_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (
          lower(trim(p.role::text)) IN ('developer', 'super_admin')
          OR public.current_user_holds_admin_route(ARRAY['reports.other'])
          OR ((lower(trim(p.role::text)) = 'admin' OR p.is_department_lead)
              AND (action_items.department = p.department
                   OR action_items.department = ANY (COALESCE(p.lead_departments, ARRAY[]::text[]))))
        )
    )
  );

-- "Users can insert action items" is a superset of "Admins and leads can insert
-- action items" (it also admits admins for their own department), so the narrower
-- duplicate is dropped.
DROP POLICY IF EXISTS "Admins and leads can insert action items" ON public.action_items;

-- 2. Mechanical merges -------------------------------------------------------------
-- For each (table, command) below, the existing permissive policies are folded
-- into one: USING = OR of the USING clauses; WITH CHECK = OR of each policy's
-- effective check (its WITH CHECK, or its USING when it had none — which is what
-- Postgres applies for UPDATE). Built from pg_policies at apply time so the merged
-- text is exactly the live text.
DO $$
DECLARE
  target record;
  pol record;
  using_parts text[];
  check_parts text[];
  merged_name text;
  sql text;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('daily_reports', 'SELECT'),
      ('daily_reports', 'UPDATE'),
      ('development_plans', 'SELECT'),
      ('event_notifications', 'UPDATE'),
      ('feedback', 'SELECT'),
      ('goals_objectives', 'UPDATE'),
      ('leave_approvals', 'INSERT'),
      ('leave_requests', 'SELECT'),
      ('leave_requests', 'UPDATE'),
      ('meeting_week_documents', 'SELECT'),
      ('peer_feedback', 'SELECT'),
      ('profiles', 'SELECT'),
      ('system_settings', 'ALL'),
      ('user_documentation', 'SELECT')
    ) AS t(tbl, cmd)
  LOOP
    using_parts := ARRAY[]::text[];
    check_parts := ARRAY[]::text[];

    FOR pol IN
      SELECT policyname, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = target.tbl AND cmd = target.cmd AND permissive = 'PERMISSIVE'
    LOOP
      IF pol.qual IS NOT NULL THEN
        using_parts := using_parts || format('(%s)', pol.qual);
      END IF;
      IF target.cmd IN ('INSERT', 'UPDATE', 'ALL') AND COALESCE(pol.with_check, pol.qual) IS NOT NULL THEN
        check_parts := check_parts || format('(%s)', COALESCE(pol.with_check, pol.qual));
      END IF;
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, target.tbl);
    END LOOP;

    merged_name := format('%s_%s', target.tbl, lower(target.cmd));
    sql := format('CREATE POLICY %I ON public.%I FOR %s TO authenticated', merged_name, target.tbl, target.cmd);
    IF array_length(using_parts, 1) > 0 AND target.cmd <> 'INSERT' THEN
      sql := sql || format(' USING (%s)', array_to_string(using_parts, ' OR '));
    END IF;
    IF array_length(check_parts, 1) > 0 THEN
      sql := sql || format(' WITH CHECK (%s)', array_to_string(check_parts, ' OR '));
    END IF;
    EXECUTE sql;
  END LOOP;
END $$;

-- 3. auth_rls_initplan: evaluate auth.uid() once per statement, not per row --------
DROP POLICY IF EXISTS "Users can insert satisfaction survey" ON public.system_satisfaction_surveys;
CREATE POLICY "Users can insert satisfaction survey" ON public.system_satisfaction_surveys
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) OR (user_id IS NULL AND is_anonymous = true));

DROP POLICY IF EXISTS "Users can view own satisfaction survey" ON public.system_satisfaction_surveys;
CREATE POLICY "Users can view own satisfaction survey" ON public.system_satisfaction_surveys
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin_like()));

DROP POLICY IF EXISTS "Users can update own satisfaction survey" ON public.system_satisfaction_surveys;
CREATE POLICY "Users can update own satisfaction survey" ON public.system_satisfaction_surveys
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

COMMIT;
