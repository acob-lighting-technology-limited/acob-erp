-- KSS heads-up: configurable recipients, send day, and a manual trigger.
--
-- 20260915090000 hard-coded the heads-up to Mondays and to the department plus
-- the Admin and HR lead, HCS and MD. Admins want to choose who receives it,
-- when it goes out, and to send it themselves from the Meeting Reminders page.
--
-- New keys on system_settings.kss_rotation (existing values are kept):
--   heads_up_day               ISO weekday the automatic send runs (1 = Monday)
--   include_department_members email everyone active in the presenting department
--   extra_recipient_ids        profile ids always emailed (seeded with the people
--                              the heads-up went to: Admin and HR lead, HCS, MD)

update public.system_settings
set value = jsonb_build_object(
      'heads_up_day', 1,
      'include_department_members', true,
      'extra_recipient_ids', jsonb_build_array(
        'c6d934f4-8d43-4c1c-967e-103c9f49f82a',
        '90d64faf-863e-4d07-a500-186cd073fbd8',
        'd29aad5f-f382-4998-8bd2-9857435874e0'
      )
    ) || value,
    updated_at = now()
where key = 'kss_rotation';

-- One place that calls send-kss-heads-up, for both the schedule and the admin
-- "Send now" / "Send preview" buttons (via the service-role API route).
-- A real send logs a fresh attempt first: the edge function refuses any real send
-- without one. A preview needs the service-role key and touches no log.
create or replace function public.dispatch_kss_heads_up(
  p_week integer,
  p_year integer,
  p_preview_to text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_department text;
  v_key text;
  v_body jsonb := jsonb_build_object('meetingWeek', p_week, 'meetingYear', p_year);
  v_preview boolean := nullif(trim(coalesce(p_preview_to, '')), '') is not null;
begin
  select k.department into v_department from public.kss_department_for_week(p_week, p_year) k;
  if v_department is null then
    raise exception 'No Knowledge Sharing department for week % of %', p_week, p_year;
  end if;

  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = case when v_preview then 'service_role_key' else 'anon_key' end;
  if v_key is null or v_key = '' then
    raise exception 'Vault key for the KSS heads-up is not configured';
  end if;

  if v_preview then
    v_body := v_body || jsonb_build_object('previewTo', trim(p_preview_to));
  else
    -- A manual send after an earlier one is a deliberate resend: reset the attempt.
    insert into public.kss_heads_up_log (meeting_week, meeting_year, department, attempt_count, last_attempt_at, sent_at, outcome)
    values (p_week, p_year, v_department, 1, now(), null, 'attempted')
    on conflict (meeting_week, meeting_year) do update
      set department = excluded.department,
          attempt_count = case when public.kss_heads_up_log.sent_at is not null then 1
                               else public.kss_heads_up_log.attempt_count + 1 end,
          last_attempt_at = excluded.last_attempt_at,
          sent_at = null,
          recipient_count = null,
          outcome = 'attempted';
  end if;

  return net.http_post(
    url := 'https://itqegqxeqkeogwrvlzlj.supabase.co/functions/v1/send-kss-heads-up',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key, 'apikey', v_key),
    body := v_body,
    timeout_milliseconds := 120000
  );
end;
$function$;

create or replace function public.process_kss_heads_up()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_settings jsonb;
  v_time time;
  v_day integer;
  v_lagos_now timestamp := now() at time zone 'Africa/Lagos';
  v_target date;
  v_year integer;
  v_year_start date;
  v_week integer;
  v_log public.kss_heads_up_log%rowtype;
  v_department text;
  v_source text;
  max_attempts constant integer := 3;
begin
  select value into v_settings from public.system_settings where key = 'kss_rotation';
  if coalesce((v_settings ->> 'heads_up_enabled')::boolean, false) is not true then
    return;
  end if;

  begin
    v_day := coalesce((v_settings ->> 'heads_up_day')::integer, 1);
  exception when others then
    v_day := 1;
  end;
  if extract(isodow from v_lagos_now) <> v_day then
    return;
  end if;

  begin
    v_time := coalesce(nullif(v_settings ->> 'heads_up_time', '')::time, time '12:00');
  exception when others then
    v_time := time '12:00';
  end;
  if v_lagos_now::time < v_time then
    return;
  end if;

  -- Announce the next meeting after today (meetings are on the office-week start day).
  v_target := v_lagos_now::date + 1;
  loop
    v_year := extract(year from v_target)::integer;
    v_year_start := public.office_week_year_start(v_year);
    if v_target < v_year_start then
      v_year := v_year - 1;
      v_year_start := public.office_week_year_start(v_year);
    end if;
    exit when ((v_target - v_year_start) % 7) = 0;
    v_target := v_target + 1;
  end loop;
  v_week := ((v_target - v_year_start) / 7) + 1;

  select * into v_log from public.kss_heads_up_log
  where meeting_week = v_week and meeting_year = v_year;

  if found and (
    v_log.sent_at is not null
    or v_log.attempt_count >= max_attempts
    or v_log.last_attempt_at > now() - interval '14 minutes'
  ) then
    return;
  end if;

  select k.department, k.source into v_department, v_source
  from public.kss_department_for_week(v_week, v_year) k;

  if v_department is null then
    insert into public.kss_heads_up_log (meeting_week, meeting_year, attempt_count, last_attempt_at, sent_at, recipient_count, outcome)
    values (v_week, v_year, 0, now(), now(), 0, coalesce(v_source, 'unresolved'))
    on conflict (meeting_week, meeting_year) do update
      set sent_at = excluded.sent_at, outcome = excluded.outcome, last_attempt_at = excluded.last_attempt_at;
    return;
  end if;

  perform public.dispatch_kss_heads_up(v_week, v_year, null);
end;
$function$;

revoke all on function public.dispatch_kss_heads_up(integer, integer, text) from public, anon, authenticated;
grant execute on function public.dispatch_kss_heads_up(integer, integer, text) to service_role;
revoke all on function public.process_kss_heads_up() from public, anon, authenticated;
