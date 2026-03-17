CREATE OR REPLACE FUNCTION public.process_reminder_schedules()
RETURNS void AS $$
DECLARE
  schedule RECORD;
  payload jsonb;
  meeting_date_val date;
  meeting_date_str text;
  base_url text := 'https://itqegqxeqkeogwrvlzlj.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0cWVncXhlcWtlb2d3cnZsemxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NDI0NTcsImV4cCI6MjA3NzIxODQ1N30.eVYpuw_VqDrg28DXJFoeYGAbth4Q-t0tXokA1Nq1dog';
BEGIN
  -- Process active schedules where next_run_at is now or in the past
  FOR schedule IN
    SELECT * FROM public.reminder_schedules
    WHERE is_active = true AND next_run_at <= (NOW() AT TIME ZONE 'Africa/Lagos')
  LOOP
    -- Initial payload from config
    payload := schedule.meeting_config;
    
    -- If it's recurring, we typically want the meeting date to be "tomorrow" 
    -- (since reminders are usually sent the day before)
    IF schedule.schedule_type = 'recurring' THEN
      -- Calculate tomorrow's date in Lagos
      meeting_date_val := (NOW() AT TIME ZONE 'Africa/Lagos' + INTERVAL '1 day')::date;
      meeting_date_str := to_char(meeting_date_val, 'Day, DD Month YYYY');
      
      -- Override meetingDate in payload for recurring
      payload := payload || jsonb_build_object('meetingDate', meeting_date_str);
    END IF;

    -- Add common fields
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
      UPDATE public.reminder_schedules
      SET 
        next_run_at = next_run_at + INTERVAL '7 days',
        last_sent_at = NOW(),
        updated_at = NOW()
      WHERE id = schedule.id;
    ELSE
      -- One-time
      UPDATE public.reminder_schedules
      SET 
        is_active = false, 
        last_sent_at = NOW(),
        updated_at = NOW()
      WHERE id = schedule.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
;
