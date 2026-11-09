-- Monthly notice to the owners of each guarded area about changes made there as an override.
-- Calls the app, which reads last month's tagged audit rows and notifies the owners in-app.
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'app-access-override-monthly';

SELECT cron.schedule(
  'app-access-override-monthly', '0 7 1 * *',
  $job$SELECT public.call_app_endpoint('/api/cron/access/override-monthly', 'GET')$job$
);
