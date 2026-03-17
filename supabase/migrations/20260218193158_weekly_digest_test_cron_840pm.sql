
SELECT cron.schedule(
  'weekly-digest-test-840pm',
  '40 19 18 2 *',
  $$
  SELECT net.http_post(
    url := 'https://itqegqxeqkeogwrvlzlj.supabase.co/functions/v1/send-weekly-digest',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0cWVncXhlcWtlb2d3cnZsemxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NDI0NTcsImV4cCI6MjA3NzIxODQ1N30.eVYpuw_VqDrg28DXJFoeYGAbth4Q-t0tXokA1Nq1dog"}'::jsonb,
    body := '{"testEmail": "i.chibuikem@org.acoblighting.com", "forceWeek": 7, "forceYear": 2026}'::jsonb
  );
  $$
);
;
