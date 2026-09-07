-- Move the scheduled work off Vercel Cron, and cap network log growth.
--
-- WHY: the Vercel Hobby plan allows 2 cron jobs at daily granularity, but
-- vercel.json declared 6. None of them were firing. Evidence at the time of
-- writing: 14 open tasks were due within 3 days while zero 'task_due_soon'
-- notifications had EVER been created, and 7 tasks were >7 days overdue while
-- still sitting in in_progress/pending. pg_cron on the Supabase free plan has
-- no such limit and already runs minute-level jobs here.
--
-- The DB timezone is UTC, which is what Vercel Cron used, so every schedule
-- below is copied across unchanged.
--
-- Requires two Vault secrets (see call_app_endpoint in the previous
-- migration); until they exist every job below is a harmless no-op:
--   app_base_url    -- e.g. https://matrix.acoblighting.com
--   app_cron_secret -- the same value as the app's CRON_SECRET env var

-- ---------------------------------------------------------------------------
-- 1. The six routes Vercel was supposed to be calling
-- ---------------------------------------------------------------------------
-- Method matters: these four export GET, the two below export POST. Calling
-- with the wrong verb returns 405 and the job silently does nothing.

SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN (
  'app-attendance-mark-incomplete',
  'app-pms-ensure-review-cycle',
  'app-tasks-expire-overdue',
  'app-tasks-reminders',
  'app-reports-official-exports',
  'app-leave-sla-reminders',
  'purge-network-activity-logs'
);

-- Marks yesterday's unfinished attendance. Midnight UTC = 01:00 WAT.
SELECT cron.schedule(
  'app-attendance-mark-incomplete', '0 0 * * *',
  $job$SELECT public.call_app_endpoint('/api/cron/attendance/mark-incomplete', 'GET')$job$
);

-- Keeps a current PMS review cycle in place. A missing quarterly cycle makes
-- attendance render blank, so this one is load-bearing.
SELECT cron.schedule(
  'app-pms-ensure-review-cycle', '30 0 * * *',
  $job$SELECT public.call_app_endpoint('/api/cron/pms/ensure-review-cycle', 'GET')$job$
);

SELECT cron.schedule(
  'app-tasks-expire-overdue', '15 1 * * *',
  $job$SELECT public.call_app_endpoint('/api/cron/tasks/expire-overdue', 'GET')$job$
);

-- Weekday deadline nudges. 07:00 UTC = 08:00 WAT, start of the working day.
SELECT cron.schedule(
  'app-tasks-reminders', '0 7 * * 1-5',
  $job$SELECT public.call_app_endpoint('/api/cron/tasks/reminders', 'GET')$job$
);

SELECT cron.schedule(
  'app-reports-official-exports', '0 1 * * *',
  $job$SELECT public.call_app_endpoint('/api/reports/official-exports', 'POST')$job$
);

SELECT cron.schedule(
  'app-leave-sla-reminders', '0 8 * * *',
  $job$SELECT public.call_app_endpoint('/api/hr/leave/sla/reminders', 'POST')$job$
);

-- ---------------------------------------------------------------------------
-- 2. Retention for network_activity_logs
-- ---------------------------------------------------------------------------
-- The table was 357 MB of a 551 MB database against a 500 MB free-plan limit,
-- ingesting ~35k rows (~10 MB) per day. Only two code paths touch it: the
-- ingest writer, and one admin security view that defaults to today and caps
-- at 5000 rows. Nothing aggregates or reports on the history.

CREATE OR REPLACE FUNCTION public.purge_network_activity_logs(
  p_retain_days integer DEFAULT 7,
  p_batch_limit integer DEFAULT 100000
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_deleted integer;
BEGIN
  -- Batched on purpose. The first run has ~1.08M rows to clear, and doing that
  -- in one transaction on a constrained free-tier instance would balloon WAL
  -- and risk pushing the database further over its disk limit before it
  -- shrinks. Small bites catch up within a few hours, then stay trivial.
  WITH doomed AS (
    SELECT id
    FROM public.network_activity_logs
    WHERE visited_at < now() - make_interval(days => p_retain_days)
    ORDER BY visited_at
    LIMIT p_batch_limit
  )
  DELETE FROM public.network_activity_logs n
  USING doomed d
  WHERE n.id = d.id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_network_activity_logs(integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_network_activity_logs(integer, integer) FROM authenticated;

-- Every 10 minutes so the initial ~1.08M row backlog clears in about two
-- hours; afterwards each run removes only the day's expiring slice.
SELECT cron.schedule(
  'purge-network-activity-logs', '*/10 * * * *',
  $job$SELECT public.purge_network_activity_logs(7, 100000)$job$
);

-- NOTE: DELETE marks space reusable but does not return it to the operating
-- system, and Supabase bills on actual size. After the backlog has cleared,
-- run once by hand to actually reclaim the ~291 MB:
--   VACUUM FULL public.network_activity_logs;
-- It takes a brief exclusive lock on the table, which only affects the admin
-- security view.
