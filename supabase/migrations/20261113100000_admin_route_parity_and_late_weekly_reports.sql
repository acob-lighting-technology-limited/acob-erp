-- Admin route parity and late weekly reports.
--
-- Rule: whatever super_admin and developer can do on an admin route, an admin
-- holding that route can do too. current_user_holds_admin_route() already
-- encodes that (developer/super_admin hold every route; an admin holds what
-- admin_routes grants).
--
-- 1. The weekly report lock let only super_admin/developer past it. An admin
--    holding reports.weekly or reports.other now passes the same way.
-- 2. weekly_reports.submitted_late marks a report created after its week locked.
--    (The app already allows a missing report to be created after the lock.)
-- 3. Daily reports read/update rules allowed admin and super_admin but not
--    developer; developer is added.
--
-- NOT APPLIED: review, then apply to the live project only with explicit approval.

-- 1. Weekly report lock -------------------------------------------------------

CREATE OR REPLACE FUNCTION public.weekly_report_can_mutate(p_week integer, p_year integer)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_unlock_until timestamp with time zone;
  v_deadline timestamp with time zone;
begin
  -- Anyone holding the weekly reports admin route (developer, super_admin, or an
  -- admin granted the route) may edit a locked week.
  if public.current_user_holds_admin_route(array['reports.weekly', 'reports.other']) then
    return true;
  end if;

  select wrmw.unlock_until
  into v_unlock_until
  from public.weekly_report_meeting_windows wrmw
  where wrmw.week_number = p_week
    and wrmw.year = p_year
  limit 1;

  if v_unlock_until is not null and now() <= v_unlock_until then
    return true;
  end if;

  v_deadline := public.weekly_report_lock_deadline(p_week, p_year);
  return now() <= v_deadline;
end;
$function$;

CREATE OR REPLACE FUNCTION public.weekly_report_lock_state(p_week integer, p_year integer)
 RETURNS TABLE(meeting_date date, grace_hours integer, unlock_until timestamp with time zone, lock_deadline timestamp with time zone, is_locked boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with cfg as (
    select
      public.weekly_report_effective_meeting_date(p_week, p_year) as meeting_date,
      coalesce(
        (
          select wrmw.grace_hours
          from public.weekly_report_meeting_windows wrmw
          where wrmw.week_number = p_week
            and wrmw.year = p_year
          limit 1
        ),
        24
      ) as grace_hours,
      (
        select wrmw.unlock_until
        from public.weekly_report_meeting_windows wrmw
        where wrmw.week_number = p_week
          and wrmw.year = p_year
        limit 1
      ) as unlock_until,
      public.weekly_report_lock_deadline(p_week, p_year) as lock_deadline,
      public.current_user_holds_admin_route(array['reports.weekly', 'reports.other']) as holds_route
  )
  select
    cfg.meeting_date,
    cfg.grace_hours,
    cfg.unlock_until,
    cfg.lock_deadline,
    not (
      cfg.holds_route
      or (cfg.unlock_until is not null and now() <= cfg.unlock_until)
      or now() <= cfg.lock_deadline
    ) as is_locked
  from cfg;
$function$;

-- 2. Late weekly reports ------------------------------------------------------

ALTER TABLE public.weekly_reports
  ADD COLUMN IF NOT EXISTS submitted_late boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.weekly_reports.submitted_late IS
  'True when the report was created after its week locked (a missing report filled in late).';

-- 3. Daily reports: developer alongside admin and super_admin ------------------

DROP POLICY IF EXISTS daily_reports_select ON public.daily_reports;
CREATE POLICY daily_reports_select ON public.daily_reports
  FOR SELECT TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY (ARRAY['admin'::user_role, 'super_admin'::user_role, 'developer'::user_role])
    ))
    OR (EXISTS (
      SELECT 1 FROM public.profiles p1
      JOIN public.profiles p2 ON p2.id = daily_reports.user_id
      WHERE p1.id = (SELECT auth.uid())
        AND p1.is_department_lead = true
        AND p1.department_id = p2.department_id
        AND p1.department_id IS NOT NULL
    ))
    OR ((SELECT auth.uid()) = user_id)
  );

DROP POLICY IF EXISTS daily_reports_update ON public.daily_reports;
CREATE POLICY daily_reports_update ON public.daily_reports
  FOR UPDATE TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.profiles p1
      JOIN public.profiles p2 ON p2.id = daily_reports.user_id
      WHERE p1.id = (SELECT auth.uid())
        AND (
          p1.role = ANY (ARRAY['admin'::user_role, 'super_admin'::user_role, 'developer'::user_role])
          OR (p1.is_department_lead = true AND p1.department_id = p2.department_id AND p1.department_id IS NOT NULL)
        )
    ))
    OR ((SELECT auth.uid()) = user_id AND acknowledged_at IS NULL)
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.profiles p1
      JOIN public.profiles p2 ON p2.id = daily_reports.user_id
      WHERE p1.id = (SELECT auth.uid())
        AND (
          p1.role = ANY (ARRAY['admin'::user_role, 'super_admin'::user_role, 'developer'::user_role])
          OR (p1.is_department_lead = true AND p1.department_id = p2.department_id AND p1.department_id IS NOT NULL)
        )
    ))
    OR ((SELECT auth.uid()) = user_id)
  );

DROP POLICY IF EXISTS "View daily report tasks via parent" ON public.daily_report_tasks;
CREATE POLICY "View daily report tasks via parent" ON public.daily_report_tasks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.daily_reports r
      WHERE r.id = daily_report_tasks.report_id
        AND (
          r.user_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.profiles p1
            JOIN public.profiles p2 ON p2.id = r.user_id
            WHERE p1.id = (SELECT auth.uid())
              AND (
                p1.role = ANY (ARRAY['admin'::user_role, 'super_admin'::user_role, 'developer'::user_role])
                OR (p1.is_department_lead = true AND p1.department_id = p2.department_id AND p1.department_id IS NOT NULL)
              )
          )
        )
    )
  );
