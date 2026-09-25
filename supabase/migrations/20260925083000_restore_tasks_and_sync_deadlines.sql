-- ─────────────────────────────────────────────────────────────
-- Migration: Restore auto-failed tasks, sync deadlines, and unschedule stale auto-fail cron
-- ─────────────────────────────────────────────────────────────

BEGIN;

-- 1. Restore all tasks that were automatically failed by the overdue cron
--    as well as TSK-000253 (which was failed during testing)
UPDATE public.tasks
SET status = 'in_progress',
    failure_reason = NULL,
    updated_at = now()
WHERE status = 'failed'
  AND (
    failure_reason = 'Deadline passed without completion (recorded automatically)'
    OR work_item_number = 'TSK-000253'
  );

-- 2. Synchronize task_end_date with due_date wherever task_end_date is older than due_date
--    (e.g., TSK-000267 where task_end_date was 2026-08-18 while due_date is 2026-09-30)
UPDATE public.tasks
SET task_end_date = due_date,
    updated_at = now()
WHERE due_date IS NOT NULL
  AND (task_end_date IS NULL OR task_end_date < due_date);

-- 3. Unschedule the auto-fail cron job 'app-tasks-expire-overdue'
--    Prevent stale live production route from re-failing tasks at midnight until code is deployed.
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'app-tasks-expire-overdue';

COMMIT;
