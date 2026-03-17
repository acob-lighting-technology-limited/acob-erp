
-- pg_cron job that runs every 15 minutes to check for due digest schedules
-- It uses pg_net to call the send-weekly-digest edge function

-- Helper function to calculate current ISO week
CREATE OR REPLACE FUNCTION public.get_current_iso_week()
RETURNS TABLE(week int, year int) AS $$
DECLARE
  now_date date := CURRENT_DATE;
  jan4 date;
  dow int;
  w1_monday date;
  diff int;
BEGIN
  jan4 := make_date(EXTRACT(YEAR FROM now_date)::int, 1, 4);
  dow := EXTRACT(ISODOW FROM jan4)::int;
  w1_monday := jan4 - (dow - 1);
  diff := now_date - w1_monday;
  week := (diff / 7) + 1;
  year := EXTRACT(YEAR FROM now_date)::int;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function called by pg_cron to process due schedules
CREATE OR REPLACE FUNCTION public.process_digest_schedules()
RETURNS void AS $$
DECLARE
  schedule RECORD;
  current_info RECORD;
  supabase_url text;
  service_key text;
  payload jsonb;
  day_num int;
  today_dow int;
  now_time time;
BEGIN
  -- Get Supabase URL and service key from vault or hardcode
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);

  -- Fallback: use the known URL if settings are not configured
  IF supabase_url IS NULL OR supabase_url = '' THEN
    supabase_url := 'https://itqegqxeqkeogwrvlzlj.supabase.co';
  END IF;

  -- Get current ISO week
  SELECT * INTO current_info FROM public.get_current_iso_week();

  -- Current day of week (1=Mon...7=Sun) and time
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

        -- Call edge function via pg_net
        PERFORM net.http_post(
          url := supabase_url || '/functions/v1/send-weekly-digest',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_key
          ),
          body := payload
        );

        -- Mark as sent and deactivate
        UPDATE public.digest_schedules
        SET is_active = false, last_sent_at = NOW()
        WHERE id = schedule.id;
      END IF;

    -- ── Recurring schedules ──
    ELSIF schedule.schedule_type = 'recurring' THEN
      -- Map day name to ISO day number
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

      -- Check if today is the right day and time is past the send time
      -- and we haven't already sent this week
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
          url := supabase_url || '/functions/v1/send-weekly-digest',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_key
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

-- Schedule the cron job to run every 15 minutes
SELECT cron.schedule(
  'process-digest-schedules',
  '*/15 * * * *',
  $$SELECT public.process_digest_schedules()$$
);
;
