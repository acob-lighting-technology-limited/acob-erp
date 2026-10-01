-- Alert ICT when the clock-in device stops sending punches.
--
-- The Hikvision unit went quiet 18-21 Sep and 28-29 Sep 2026 and then sent its
-- backlog at once; nobody noticed until staff appealed days that were fine.
-- /api/cron/attendance/device-health checks for no clock-ins by 10:00 WAT and
-- for missing clock-outs by 19:00 WAT on working days, and alerts each problem
-- once per day (state in system_settings.attendance_device_health). Recipients
-- are system_settings.reminder_failure_alert plus the ICT mailbox.
--
-- Every 30 minutes, 09:00-21:30 UTC (10:00-22:30 WAT), Monday to Friday; the
-- route itself skips public holidays and the hours before its checks apply.
-- Apply after the app deploy that adds the route, or the job 404s until then.

select cron.unschedule(jobname) from cron.job where jobname = 'app-attendance-device-health';

select cron.schedule(
  'app-attendance-device-health', '0,30 9-21 * * 1-5',
  $job$select public.call_app_endpoint('/api/cron/attendance/device-health', 'GET')$job$
);
