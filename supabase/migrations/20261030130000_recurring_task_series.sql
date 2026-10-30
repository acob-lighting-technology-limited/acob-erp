-- Recurring tasks.
--
-- A series is the recipe ("check the server backup, every working day, Ada").
-- It never holds work itself: a nightly job turns it into one ordinary task
-- row per due date. Overdue grace, reminders, rating and the KPI all keep
-- working because, to them, each repeat is just a task.
--
-- Rules the schema carries (the date maths lives in lib/tasks/recurrence.ts):
--   - working_daily skips weekends and public holidays
--   - weekly is due on a chosen weekday, Mon-Fri
--   - monthly is due on a day number or the last day; a day the month does
--     not have (the 31st) falls on its last day
--   - quarterly is due on the last day of Mar, Jun, Sep and Dec
--   - yearly is due on a chosen month and day
--
-- Who the work belongs to is dated, in task_series_assignees: reassigning
-- from the 13th adds a row effective the 13th, so days 1-12 stay with the
-- original person and the history of who held the series is kept.

CREATE TABLE IF NOT EXISTS public.task_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  description text,
  priority text NOT NULL DEFAULT 'medium',
  department text,
  kpi_id uuid REFERENCES public.corporate_kpis(id) ON DELETE SET NULL,
  goal_id uuid REFERENCES public.goals_objectives(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.implementation_plans(id) ON DELETE SET NULL,
  portfolio_id uuid REFERENCES public.portfolios(id) ON DELETE SET NULL,
  weight integer NOT NULL DEFAULT 3 CHECK (weight BETWEEN 1 AND 5),

  frequency text NOT NULL CHECK (frequency IN ('working_daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  -- ISO weekday, 1 = Monday ... 5 = Friday. Weekly only.
  weekday smallint CHECK (weekday BETWEEN 1 AND 5),
  -- Monthly and yearly: a day number, or the last day of the month.
  month_mode text CHECK (month_mode IN ('day', 'last_day')),
  month_day smallint CHECK (month_day BETWEEN 1 AND 31),
  -- Yearly only.
  year_month smallint CHECK (year_month BETWEEN 1 AND 12),

  start_date date NOT NULL,
  end_date date,

  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  paused_from date,
  -- NULL while paused means "until someone resumes it".
  paused_until date,
  end_reason text CHECK (end_reason IN ('completed_early', 'no_longer_needed', 'end_date_reached')),
  ended_at timestamptz,
  ended_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Last time the generator looked at this series; for diagnosing a stalled job.
  last_generated_at timestamptz,

  CONSTRAINT task_series_end_after_start CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT task_series_project_xor_portfolio CHECK (portfolio_id IS NULL OR project_id IS NULL),
  CONSTRAINT task_series_weekly_fields CHECK (frequency <> 'weekly' OR weekday IS NOT NULL),
  CONSTRAINT task_series_month_fields CHECK (
    frequency NOT IN ('monthly', 'yearly')
    OR (month_mode = 'last_day' OR (month_mode = 'day' AND month_day IS NOT NULL))
  ),
  CONSTRAINT task_series_yearly_fields CHECK (frequency <> 'yearly' OR year_month IS NOT NULL),
  CONSTRAINT task_series_pause_fields CHECK (
    (status = 'paused') = (paused_from IS NOT NULL)
    AND (paused_until IS NULL OR paused_until >= paused_from)
  ),
  CONSTRAINT task_series_end_fields CHECK ((status = 'ended') = (ended_at IS NOT NULL))
);

COMMENT ON TABLE public.task_series IS
  'Recurring task recipe. The generate-recurring cron creates one ordinary tasks row per due date.';

CREATE INDEX IF NOT EXISTS idx_task_series_status ON public.task_series (status);
CREATE INDEX IF NOT EXISTS idx_task_series_department ON public.task_series (department);
CREATE INDEX IF NOT EXISTS idx_task_series_created_by ON public.task_series (created_by);

CREATE TABLE IF NOT EXISTS public.task_series_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.task_series(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL REFERENCES auth.users(id),
  effective_from date NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (series_id, effective_from)
);

COMMENT ON TABLE public.task_series_assignees IS
  'Who holds a task series from which date. The row with the latest effective_from on or before a due date owns that task.';

CREATE INDEX IF NOT EXISTS idx_task_series_assignees_user ON public.task_series_assignees (assigned_to);

-- ── Link each generated task to its series ──────────────────────────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES public.task_series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS occurrence_date date;

COMMENT ON COLUMN public.tasks.series_id IS 'The recurring series that created this task. NULL for one-off tasks.';
COMMENT ON COLUMN public.tasks.occurrence_date IS
  'The scheduled due date this task was created for. Fixed even when the task''s own deadline is moved.';

-- The guarantee that a generator run twice, or two runs overlapping, can
-- never create the same repeat twice.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tasks_series_occurrence
  ON public.tasks (series_id, occurrence_date)
  WHERE series_id IS NOT NULL;

-- Which series a task belongs to is set by the server, never by its
-- assignee: the tasks update policy lets an assignee update their own row,
-- and unlinking a task would change how it is scored.
CREATE OR REPLACE FUNCTION public.tasks_guard_series_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL
     AND (NEW.series_id IS DISTINCT FROM OLD.series_id
          OR NEW.occurrence_date IS DISTINCT FROM OLD.occurrence_date) THEN
    RAISE EXCEPTION 'A task''s recurring series can only be changed by the server'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tasks_guard_series_link() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tasks_guard_series_link ON public.tasks;
CREATE TRIGGER tasks_guard_series_link
  BEFORE UPDATE OF series_id, occurrence_date ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.tasks_guard_series_link();

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Reads mirror the tasks select policy: admins and leads, the person who set
-- the series up, and anyone who holds or held it. Every write goes through
-- /api/task-series with the service role, so no write policy exists and the
-- table grants are revoked as well.

ALTER TABLE public.task_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_series_assignees ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.task_series FROM anon;
REVOKE ALL ON public.task_series_assignees FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.task_series FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.task_series_assignees FROM authenticated;
GRANT SELECT ON public.task_series TO authenticated;
GRANT SELECT ON public.task_series_assignees TO authenticated;
GRANT ALL ON public.task_series TO service_role;
GRANT ALL ON public.task_series_assignees TO service_role;

DROP POLICY IF EXISTS "Task series select policy" ON public.task_series;
CREATE POLICY "Task series select policy" ON public.task_series
  FOR SELECT TO authenticated
  USING (
    (SELECT has_role('admin'::text))
    OR (SELECT has_role('lead'::text))
    OR created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.task_series_assignees a
      WHERE a.series_id = task_series.id AND a.assigned_to = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Task series assignees select policy" ON public.task_series_assignees;
CREATE POLICY "Task series assignees select policy" ON public.task_series_assignees
  FOR SELECT TO authenticated
  USING (
    (SELECT has_role('admin'::text))
    OR (SELECT has_role('lead'::text))
    OR assigned_to = (SELECT auth.uid())
    -- Deliberately not a lookup into task_series: its policy reads this
    -- table, and two policies reading each other recurse forever.
    OR created_by = (SELECT auth.uid())
  );

-- ── Nightly generator ────────────────────────────────────────────────────
-- 04:00 UTC = 05:00 WAT: before the 07:00 UTC reminders job, so a task
-- created today is already there when the day's reminders go out.

SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'app-tasks-generate-recurring';

SELECT cron.schedule(
  'app-tasks-generate-recurring', '0 4 * * *',
  $job$SELECT public.call_app_endpoint('/api/cron/tasks/generate-recurring', 'GET')$job$
);

NOTIFY pgrst, 'reload schema';
