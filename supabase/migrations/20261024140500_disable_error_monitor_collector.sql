-- Unschedule collect-error-monitor to stop Supabase Management API log query consumption
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'collect-error-monitor';
  END IF;
END $$;
