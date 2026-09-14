-- Meeting reminders: retry until a send is confirmed, instead of skipping a week.
--
-- WHY: on 13 Sep 2026 send-meeting-reminder started at 06:05:02 UTC and died
-- within seconds on a transient REST gateway 504 (rpc
-- weekly_report_effective_meeting_date). No email went out. But
-- process_reminder_schedules() had already moved next_run_at forward 7 days
-- as soon as it queued the request, so nothing retried and the week was lost.
--
-- (20260914091400 blamed pg_net's 5 s timeout. That was wrong: the 6 Sep send
-- logged its audit row 30 s after the trigger, so a pg_net timeout does not stop
-- the function. The 120 s timeout is kept as harmless headroom.)
--
-- NOW: each attempt books a retry 10 minutes out (max 3 attempts). The edge
-- function calls mark_reminder_schedule_sent() after at least one email is
-- delivered, which advances the schedule and cancels the pending retry.

alter table public.reminder_schedules
  add column if not exists attempt_count   integer not null default 0,
  add column if not exists slot_at         timestamptz,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists last_sent_at    timestamptz;

comment on column public.reminder_schedules.slot_at is
  'The scheduled run the current attempts belong to; retries shift next_run_at but not this.';

-- First weekly slot after p_slot that is still in the future.
create or replace function public.reminder_next_weekly_run(p_slot timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = public, pg_temp
as $function$
declare
  next_run timestamptz := p_slot + interval '7 days';
begin
  while next_run <= now() loop
    next_run := next_run + interval '7 days';
  end loop;
  return next_run;
end;
$function$;

create or replace function public.process_reminder_schedules()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  schedule record;
  payload jsonb;
  lagos_now timestamp;
  lagos_today date;
  meeting_seed date;
  target_dow int;
  today_dow int;
  days_until int;
  target_date date;
  meeting_time_val time;
  office_year int;
  office_week int;
  office_year_start date;
  kss_department text;
  kss_presenter_id uuid;
  kss_presenter_name text;
  kss_presenter_department text;
  base_url text := 'https://itqegqxeqkeogwrvlzlj.supabase.co';
  anon_key text;
  is_retry boolean;
  attempt_no int;
  slot timestamptz;
  max_attempts constant int := 3;
begin
  -- Retrieve anon_key from vault
  select decrypted_secret into anon_key
  from vault.decrypted_secrets
  where name = 'anon_key';

  -- Fallback to configuration settings
  if anon_key is null or anon_key = '' then
    anon_key := nullif(current_setting('app.anon_key', true), '');
  end if;

  -- Bail out if no key could be resolved
  if anon_key is null or anon_key = '' then
    raise warning 'anon_key is not configured in vault or app.anon_key; skipping reminder processing';
    return;
  end if;

  for schedule in
    select *
    from public.reminder_schedules
    where is_active = true
      and next_run_at is not null
      and next_run_at <= now()
  loop
    payload := coalesce(schedule.meeting_config, '{}'::jsonb);

    payload := payload
      || jsonb_build_object(
        'type', coalesce(payload->>'type', schedule.reminder_type),
        'recipients', schedule.recipients
      );

    if schedule.schedule_type = 'recurring' and coalesce(payload->>'type', schedule.reminder_type) = 'meeting' then
      lagos_now := now() at time zone 'Africa/Lagos';
      lagos_today := lagos_now::date;

      begin
        meeting_seed := nullif(payload->>'meetingDate', '')::date;
      exception when others then
        meeting_seed := null;
      end;

      if meeting_seed is null then
        target_dow := 1; -- Monday
      else
        target_dow := extract(dow from meeting_seed)::int;
      end if;

      today_dow := extract(dow from lagos_today)::int;
      days_until := (target_dow - today_dow + 7) % 7;
      target_date := lagos_today + days_until;

      begin
        meeting_time_val := coalesce(nullif(payload->>'meetingTime', '')::time, time '08:30');
      exception when others then
        meeting_time_val := time '08:30';
      end;

      if days_until = 0 and (lagos_now::time >= meeting_time_val) then
        target_date := target_date + interval '7 days';
      end if;

      payload := payload || jsonb_build_object('meetingDate', to_char(target_date, 'YYYY-MM-DD'));

      -- Resolve office week/year from computed target date.
      office_year := extract(year from target_date)::int;
      office_year_start := public.office_week_year_start(office_year);
      if target_date < office_year_start then
        office_year := office_year - 1;
        office_year_start := public.office_week_year_start(office_year);
      end if;
      office_week := floor((target_date - office_year_start)::numeric / 7) + 1;

      -- Refresh the office week/year in the payload so the edge function does
      -- not resolve a stale week frozen into meeting_config at creation time.
      payload := payload || jsonb_build_object(
        'meetingWeek', office_week,
        'meetingYear', office_year
      );

      -- Fetch KSS presenter
      select r.department, r.presenter_id, r.presenter_name, p.full_name, p.department
      into kss_department, kss_presenter_id, kss_presenter_name, kss_presenter_department
      from public.kss_weekly_roster r
      left join public.profiles p on p.id = r.presenter_id
      where r.meeting_week = office_week
        and r.meeting_year = office_year
        and r.is_active = true
      order by r.updated_at desc
      limit 1;

      payload := payload - 'knowledgeSharingDepartment' - 'knowledgeSharingPresenter';

      if kss_department is not null then
        payload := payload || jsonb_build_object('knowledgeSharingDepartment', kss_department);

        if kss_presenter_id is not null and kss_presenter_name is not null then
          payload := payload || jsonb_build_object(
            'knowledgeSharingPresenter',
            jsonb_build_object(
              'id', kss_presenter_id,
              'full_name', kss_presenter_name,
              'department', coalesce(kss_presenter_department, kss_department)
            )
          );
          payload := payload || jsonb_build_object('kssRosterStatus', 'enriched_with_presenter');
        elsif kss_presenter_name is not null and kss_presenter_name <> '' then
          payload := payload || jsonb_build_object(
            'knowledgeSharingPresenter',
            jsonb_build_object(
              'presenter_name', kss_presenter_name,
              'department', kss_department
            )
          );
          payload := payload || jsonb_build_object('kssRosterStatus', 'enriched_with_visitor');
        else
          payload := payload || jsonb_build_object('kssRosterStatus', 'enriched_department_only');
        end if;
      else
        payload := payload || jsonb_build_object('kssRosterStatus', 'missing');
      end if;
    end if;

    -- Retry state. Attempts belong to one slot while they are under an hour
    -- apart; anything older is stale state from a previous week, so start over.
    is_retry := schedule.attempt_count > 0
      and schedule.last_attempt_at > now() - interval '1 hour';
    attempt_no := case when is_retry then schedule.attempt_count + 1 else 1 end;
    slot := case when is_retry then coalesce(schedule.slot_at, schedule.next_run_at) else schedule.next_run_at end;

    -- The edge function passes this back to mark_reminder_schedule_sent().
    payload := payload || jsonb_build_object('scheduleId', schedule.id);

    -- timeout_milliseconds = 120000: harmless headroom. Note pg_net timing out
    -- does NOT stop the edge function; delivery is confirmed via the callback.
    perform net.http_post(
      url             := base_url || '/functions/v1/send-meeting-reminder',
      headers         := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || anon_key,
        'apikey',        anon_key
      ),
      body            := payload,
      timeout_milliseconds := 120000
    );

    if attempt_no < max_attempts then
      -- pg_net is fire-and-forget, so we cannot see whether this send worked.
      -- Book a retry; a successful send cancels it by advancing the schedule.
      -- 10 minutes comfortably exceeds a full send (~45 s for 54 recipients).
      update public.reminder_schedules
      set
        attempt_count   = attempt_no,
        slot_at         = slot,
        last_attempt_at = now(),
        next_run_at     = now() + interval '10 minutes',
        updated_at      = now()
      where id = schedule.id;
    else
      raise warning 'reminder schedule %: final attempt % of %; not retrying after this one',
        schedule.id, attempt_no, max_attempts;

      update public.reminder_schedules
      set
        attempt_count   = attempt_no,
        slot_at         = slot,
        last_attempt_at = now(),
        next_run_at     = case when schedule_type = 'recurring'
                            then public.reminder_next_weekly_run(slot)
                            else next_run_at end,
        is_active       = case when schedule_type = 'recurring' then is_active else false end,
        updated_at      = now()
      where id = schedule.id;
    end if;
  end loop;
end;
$function$;


-- Called by send-meeting-reminder once at least one email is delivered.
-- Guarded so it only acts on a schedule with an attempt in flight: a stray or
-- replayed call cannot skip a week that has not been attempted.
create or replace function public.mark_reminder_schedule_sent(p_schedule_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  update public.reminder_schedules
  set
    last_sent_at  = now(),
    attempt_count = 0,
    slot_at       = null,
    next_run_at   = case when schedule_type = 'recurring'
                      then public.reminder_next_weekly_run(coalesce(slot_at, next_run_at))
                      else next_run_at end,
    is_active     = case when schedule_type = 'recurring' then is_active else false end,
    updated_at    = now()
  where id = p_schedule_id
    and attempt_count > 0
    and last_attempt_at > now() - interval '15 minutes';
end;
$function$;

revoke all on function public.reminder_next_weekly_run(timestamptz) from public, anon, authenticated;
revoke all on function public.mark_reminder_schedule_sent(uuid) from public, anon, authenticated;
grant execute on function public.mark_reminder_schedule_sent(uuid) to service_role;
revoke all on function public.process_reminder_schedules() from public, anon, authenticated;
