-- Monday birthday reminder: emails the recipients chosen in the Birthday
-- Manager (system_settings key 'birthday_weekly_reminder') the week's birthdays.
--
-- 23:00 UTC Sunday = 00:00 WAT Monday. The 06:00 UTC (07:00 WAT) run is a
-- retry: the endpoint records the week once sent, so it does nothing when the
-- midnight run succeeded.
--
-- No table changes. The setting starts absent, which the endpoint reads as
-- switched off with no recipients, so nothing is sent until HR configures it.

SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN ('app-hr-birthday-reminder', 'app-hr-birthday-reminder-retry');

SELECT cron.schedule(
  'app-hr-birthday-reminder', '0 23 * * 0',
  $job$SELECT public.call_app_endpoint('/api/cron/hr/birthday-reminder', 'GET')$job$
);

SELECT cron.schedule(
  'app-hr-birthday-reminder-retry', '0 6 * * 1',
  $job$SELECT public.call_app_endpoint('/api/cron/hr/birthday-reminder', 'GET')$job$
);
