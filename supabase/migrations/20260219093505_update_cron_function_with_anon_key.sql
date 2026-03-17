
-- Update the process_digest_schedules function to use the anon key
-- The edge function has verify_jwt: false so anon key works fine
CREATE OR REPLACE FUNCTION public.process_digest_schedules()
RETURNS void AS $$
DECLARE
  schedule RECORD;
  current_info RECORD;
  payload jsonb;
  day_num int;
  today_dow int;
  now_time time;
  base_url text := 'https://itqegqxeqkeogwrvlzlj.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0cWVncXhlcWtlb2d3cnZsemxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NDI0NTcsImV4cCI6MjA3NzIxODQ1N30.eVYpuw_VqDrg28DXJFoeYGAbth4Q-t0tXokA1Nq1dog';
BEGIN
  -- Get current ISO week
  SELECT * INTO current_info FROM public.get_current_iso_week();

  -- Current day of week (1=Mon...7=Sun) and time in Lagos timezone
  today_dow := EXTRACT(ISODOW FROM CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::int;
  now_time := (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::time;

  FOR schedule IN
    SELECT * FROM public.digest_schedules
    WHERE is_active = true
  LOOP
    -- ── One-time schedules ──
    IF schedule.schedule_type = 'one_time' THEN
      IF schedule.next_run_at IS NOT NULL AND schedule.next_run_at <= NOW() THEN
        payload := jsonb_build_object(
          'meetingWeek', schedule.meeting_week,
          'meetingYear', schedule.meeting_year,
          'recipients', schedule.recipients,
          'contentChoice', schedule.content_choice
        );

        PERFORM net.http_post(
          url := base_url || '/functions/v1/send-weekly-digest',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || anon_key
          ),
          body := payload
        );

        UPDATE public.digest_schedules
        SET is_active = false, last_sent_at = NOW()
        WHERE id = schedule.id;
      END IF;

    -- ── Recurring schedules ──
    ELSIF schedule.schedule_type = 'recurring' THEN
      day_num := CASE schedule.send_day
        WHEN 'monday' THEN 1
        WHEN 'tuesday' THEN 2
        WHEN 'wednesday' THEN 3
        WHEN 'thursday' THEN 4
        WHEN 'friday' THEN 5
        WHEN 'saturday' THEN 6
        WHEN 'sunday' THEN 7
        ELSE 1
      END;

      IF today_dow = day_num
         AND now_time >= schedule.send_time
         AND (schedule.last_sent_at IS NULL
              OR schedule.last_sent_at < date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::timestamptz)
      THEN
        payload := jsonb_build_object(
          'meetingWeek', current_info.week,
          'meetingYear', current_info.year,
          'recipients', schedule.recipients,
          'contentChoice', schedule.content_choice
        );

        PERFORM net.http_post(
          url := base_url || '/functions/v1/send-weekly-digest',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || anon_key
          ),
          body := payload
        );

        UPDATE public.digest_schedules
        SET last_sent_at = NOW()
        WHERE id = schedule.id;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
;
