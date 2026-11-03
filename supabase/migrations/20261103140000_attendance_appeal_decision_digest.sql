-- Attendance appeal decisions are emailed as a summary, not one email each.
--
-- Deciding an appeal used to email the employee and the Admin & HR lead right
-- away, once per appeal, so clearing the queue sent a burst of near-identical
-- emails (2 Nov 2026: seven "Attendance Appeal Approved" in two minutes).
-- The decision now only lands on the row; /api/cron/attendance/appeal-digest
-- claims decided appeals not yet emailed every 15 minutes and sends one
-- summary per recipient.
--
-- 1. decision_emailed_at: when the appeal was claimed for a summary. NULL means
--    a decided appeal still waiting to go out.
-- 2. Backfill: every appeal already decided was emailed by the old code (or
--    predates emails), so it is stamped now and never re-sent.
-- 3. pg_cron job calling the endpoint.
--
-- Writes go through the service role in the API routes; no grant changes.

ALTER TABLE public.attendance_appeals
  ADD COLUMN IF NOT EXISTS decision_emailed_at timestamptz;

UPDATE public.attendance_appeals
SET decision_emailed_at = coalesce(reviewed_at, updated_at, now())
WHERE status <> 'pending'
  AND decision_emailed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_appeals_decision_unemailed
  ON public.attendance_appeals (updated_at)
  WHERE decision_emailed_at IS NULL AND status IN ('approved', 'rejected', 'resolved');

SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'app-attendance-appeal-digest';

SELECT cron.schedule(
  'app-attendance-appeal-digest', '*/15 * * * *',
  $job$SELECT public.call_app_endpoint('/api/cron/attendance/appeal-digest', 'GET')$job$
);
