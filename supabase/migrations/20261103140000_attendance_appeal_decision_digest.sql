-- Attendance appeal emails become summaries, not one email each.
--
-- Deciding an appeal used to email the employee and the Admin & HR lead right
-- away, once per appeal, so clearing the queue sent a burst of near-identical
-- emails (2 Nov 2026: seven "Attendance Appeal Approved" in two minutes), and
-- every submitted appeal emailed the department lead and the Admin & HR lead.
--
-- Employees: /api/cron/attendance/appeal-digest claims decided appeals not yet
-- emailed every 15 minutes and sends each employee one summary.
-- Leads: /api/cron/attendance/appeal-lead-summary sends one email a day at
-- 08:30 WAT with what is waiting for them and what was raised and decided.
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
WHERE jobname IN (
  'app-attendance-appeal-digest',
  'app-attendance-appeal-lead-summary',
  'app-attendance-appeal-lead-summary-retry'
);

SELECT cron.schedule(
  'app-attendance-appeal-digest', '*/15 * * * *',
  $job$SELECT public.call_app_endpoint('/api/cron/attendance/appeal-digest', 'GET')$job$
);

-- 4. Leads' daily summary: 07:30 UTC = 08:30 WAT, rerun at 08:50 WAT. The
--    endpoint records the day it sent, so the rerun does nothing after a success.
SELECT cron.schedule(
  'app-attendance-appeal-lead-summary', '30 7 * * *',
  $job$SELECT public.call_app_endpoint('/api/cron/attendance/appeal-lead-summary', 'GET')$job$
);

SELECT cron.schedule(
  'app-attendance-appeal-lead-summary-retry', '50 7 * * *',
  $job$SELECT public.call_app_endpoint('/api/cron/attendance/appeal-lead-summary', 'GET')$job$
);
