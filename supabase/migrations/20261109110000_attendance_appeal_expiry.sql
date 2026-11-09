-- Attendance appeals: an `expired` outcome, and two scheduled jobs.
--
-- 1. status and stage accept 'expired'. An appeal nobody decided by its deadline (end of the
--    month after the appealed day; six months for out-of-station) becomes expired. It is not a
--    rejection: the day stays as recorded, and the employee is told in the next decision
--    summary email (the digest claims decided appeals by decision_emailed_at).
--
-- 2. /api/cron/attendance/appeal-expiry, daily 02:00 WAT (01:00 UTC). Its first run only
--    records the start and lists the backlog for the Admin & HR Lead; nothing expires for a
--    week after that.
--
-- 3. /api/cron/attendance/self-approved-monthly, 07:30 WAT on the 1st (06:30 UTC): an in-app
--    notice to the MD's Desk listing last month's self-approved appeals.
--
-- Writes go through the service role in the API routes; no grant changes.

ALTER TABLE public.attendance_appeals DROP CONSTRAINT IF EXISTS attendance_appeals_status_check;
ALTER TABLE public.attendance_appeals
  ADD CONSTRAINT attendance_appeals_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'resolved', 'expired'));

ALTER TABLE public.attendance_appeals DROP CONSTRAINT IF EXISTS attendance_appeals_stage_check;
ALTER TABLE public.attendance_appeals
  ADD CONSTRAINT attendance_appeals_stage_check
  CHECK (stage IN ('pending_lead', 'pending_admin', 'pending_hr_lead', 'approved', 'rejected', 'resolved', 'expired'));

DROP INDEX IF EXISTS public.idx_attendance_appeals_decision_unemailed;
CREATE INDEX IF NOT EXISTS idx_attendance_appeals_decision_unemailed
  ON public.attendance_appeals (updated_at)
  WHERE decision_emailed_at IS NULL AND status IN ('approved', 'rejected', 'resolved', 'expired');

SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN ('app-attendance-appeal-expiry', 'app-attendance-self-approved-monthly');

SELECT cron.schedule(
  'app-attendance-appeal-expiry', '0 1 * * *',
  $job$SELECT public.call_app_endpoint('/api/cron/attendance/appeal-expiry', 'GET')$job$
);

SELECT cron.schedule(
  'app-attendance-self-approved-monthly', '30 6 1 * *',
  $job$SELECT public.call_app_endpoint('/api/cron/attendance/self-approved-monthly', 'GET')$job$
);
