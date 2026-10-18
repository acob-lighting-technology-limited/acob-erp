-- Mailbox quota alerts: one row per cPanel mailbox that has been alerted at
-- 90% full. The row stops a mailbox being mailed every day; the daily job
-- deletes it once usage falls back under 85% (quota raised or mail cleared),
-- which re-arms the alert.

BEGIN;

CREATE TABLE IF NOT EXISTS public.mailbox_quota_alerts (
  email        text PRIMARY KEY,
  used_percent numeric,
  alerted_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mailbox_quota_alerts ENABLE ROW LEVEL SECURITY;

-- Written only by the daily job (service role). Admins may read it.
DROP POLICY IF EXISTS "Mailbox quota alerts admin read" ON public.mailbox_quota_alerts;
CREATE POLICY "Mailbox quota alerts admin read" ON public.mailbox_quota_alerts
  FOR SELECT TO authenticated
  USING (public.is_admin_like());

REVOKE ALL ON public.mailbox_quota_alerts FROM anon;

COMMIT;

-- Daily at 08:15 WAT (07:15 UTC), through the same app-endpoint caller as the other app jobs.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'app-mailbox-quota-alerts';
SELECT cron.schedule(
  'app-mailbox-quota-alerts', '15 7 * * *',
  $job$select public.call_app_endpoint('/api/cron/mailboxes/quota-alerts', 'GET')$job$
);
