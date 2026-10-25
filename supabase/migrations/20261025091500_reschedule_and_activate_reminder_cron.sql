-- Reschedule reminder schedules processor to every 5 minutes and reactivate it.
-- Reduces cron background worker startup churn while ensuring reminders are
-- dispatched within 5 minutes of their scheduled time.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN ('process-reminder-schedules-every-minute', 'process-reminder-schedules');

    PERFORM cron.schedule(
      'process-reminder-schedules',
      '*/5 * * * *',
      'SELECT public.process_reminder_schedules()'
    );
  END IF;
END $$;
