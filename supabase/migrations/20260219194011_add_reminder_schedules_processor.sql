CREATE OR REPLACE FUNCTION public.process_reminder_schedules()
RETURNS void AS $$
DECLARE
  schedule RECORD;
  payload jsonb;
  base_url text := 'https://itqegqxeqkeogwrvlzlj.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0cWVncXhlcWtlb2d3cnZsemxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NDI0NTcsImV4cCI6MjA3NzIxODQ1N30.eVYpuw_VqDrg28DXJFoeYGAbth4Q-t0tXokA1Nq1dog';
BEGIN
  -- We process any active schedule where next_run_at is now or in the past
  FOR schedule IN
    SELECT * FROM public.reminder_schedules
    WHERE is_active = true AND next_run_at <= NOW()
  LOOP
    -- Build payload for send-meeting-reminder
    -- Config: { type, meetingDate, meetingTime, teamsLink, agenda, ... }
    payload := schedule.meeting_config;
    payload := payload || jsonb_build_object('recipients', schedule.recipients);

    -- Call the edge function
    PERFORM net.http_post(
      url := base_url || '/functions/v1/send-meeting-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
      body := payload
    );

    -- Update next run
    IF schedule.schedule_type = 'recurring' THEN
      -- Move to next week
      UPDATE public.reminder_schedules
      SET 
        next_run_at = next_run_at + INTERVAL '7 days',
        updated_at = NOW()
      WHERE id = schedule.id;
    ELSE
      -- One-time: mark as inactive
      UPDATE public.reminder_schedules
      SET is_active = false, updated_at = NOW()
      WHERE id = schedule.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule it every minute to check for due reminders
SELECT cron.schedule('process-reminder-schedules-every-minute', '* * * * *', 'SELECT public.process_reminder_schedules()');
;
