CREATE OR REPLACE FUNCTION public.process_reminder_schedules()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  schedule RECORD;
  payload jsonb;
  meeting_date_val date;
  meeting_date_str text;
  base_url text := 'https://itqegqxeqkeogwrvlzlj.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0cWVncXhlcWtlb2d3cnZsemxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NDI0NTcsImV4cCI6MjA3NzIxODQ1N30.eVYpuw_VqDrg28DXJFoeYGAbth4Q-t0tXokA1Nq1dog';
BEGIN
  FOR schedule IN
    SELECT *
    FROM public.reminder_schedules
    WHERE is_active = true
      AND next_run_at IS NOT NULL
      AND next_run_at <= NOW()
  LOOP
    payload := COALESCE(schedule.meeting_config, '{}'::jsonb);

    payload := payload
      || jsonb_build_object(
        'type', COALESCE(payload->>'type', schedule.reminder_type),
        'recipients', schedule.recipients
      );

    IF schedule.schedule_type = 'recurring' THEN
      meeting_date_val := ((NOW() AT TIME ZONE 'Africa/Lagos') + INTERVAL '1 day')::date;
      meeting_date_str := trim(to_char(meeting_date_val, 'FMDay, DD FMMonth YYYY'));
      payload := payload || jsonb_build_object('meetingDate', meeting_date_str);
    END IF;

    PERFORM net.http_post(
      url := base_url || '/functions/v1/send-meeting-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
      body := payload
    );

    IF schedule.schedule_type = 'recurring' THEN
      UPDATE public.reminder_schedules
      SET
        next_run_at = GREATEST(next_run_at, NOW()) + INTERVAL '7 days',
        updated_at = NOW()
      WHERE id = schedule.id;
    ELSE
      UPDATE public.reminder_schedules
      SET
        is_active = false,
        updated_at = NOW()
      WHERE id = schedule.id;
    END IF;
  END LOOP;
END;
$function$;
