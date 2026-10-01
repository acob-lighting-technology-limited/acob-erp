-- Network activity logs now live in SharePoint, not the database.
--
-- The ingest route writes each router batch as a CSV under
-- it-communications/IT/Network Logs/<yyyy>/<mm>/<dd>/, kept for 12 months by the
-- app-network-log-retention job below. In Postgres the same data cost ~120 MB
-- for only a 7-day window, plus ~18% of log ingest from per-batch PostgREST
-- calls. Apply only after the app deploy that switches the ingest route is live.
--
-- Also dropped:
--   known_devices                — backed the "new device" flag, retired with this change
--   network_bandwidth_snapshots  — its ingest endpoint never received data (0 rows)
--
-- 'security.networkActivity' stays a valid admin route: the page now browses the
-- SharePoint archive.

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'purge-network-activity-logs';

DROP FUNCTION IF EXISTS public.purge_network_activity_logs(integer, integer);

DROP TABLE IF EXISTS public.network_activity_logs;
DROP TABLE IF EXISTS public.known_devices;
DROP TABLE IF EXISTS public.network_bandwidth_snapshots;

-- Daily at 02:15 UTC; removes archive months older than the retention window.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'app-network-log-retention';
SELECT cron.schedule(
  'app-network-log-retention', '15 2 * * *',
  $job$SELECT public.call_app_endpoint('/api/cron/security/network-log-retention', 'GET')$job$
);
