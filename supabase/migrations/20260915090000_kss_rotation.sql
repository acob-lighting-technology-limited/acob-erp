-- Knowledge Sharing Session (KSS) rotation.
--
-- WHY: the Sunday meeting reminder only named a KSS department when someone had
-- entered a roster row with a presenter, which often never happened, so the
-- reminder went out with nothing. Departments present in a fixed repeating
-- order, so the department for any week can be derived instead of typed in.
--
-- Resolution order for a meeting week (kss_department_for_week):
--   1. an active kss_weekly_roster row  -> its department (+ presenter if known)
--   2. a kss_rotation_skips row         -> no session; later turns shift back
--   3. the rotation in system_settings.kss_rotation, counted from its anchor
--      week and excluding skipped weeks, so no department ever loses its turn.
-- A roster row does not consume or shift a rotation turn; to hand a week to
-- someone outside the rotation (an external visitor) mark it skipped.
--
-- Also adds the Monday heads-up: process_kss_heads_up() runs every 15 minutes and,
-- after the configured time on Monday, emails next week's department plus the
-- Admin and HR lead, HCS and MD via send-kss-heads-up (up to 3 attempts, confirmed
-- through mark_kss_heads_up_sent like the meeting reminder).

-- ---------------------------------------------------------------------------
-- 1. Settings
-- ---------------------------------------------------------------------------
-- The July-September cycle (with Quality Assurance) ends on 21 Sep 2026; the
-- next cycle starts with Admin and HR on office week 38 (28 Sep) and drops QA.
insert into public.system_settings (key, value, description, updated_at)
values (
  'kss_rotation',
  jsonb_build_object(
    'departments', jsonb_build_array(
      'Admin and HR',
      'Technical',
      'Operations and Maintenance',
      'Business, Growth and Innovation',
      'Accounts',
      'Corporate Services',
      'IT and Communications',
      'Regulatory and Compliance',
      'Project',
      'Stakeholder Engagement'
    ),
    'anchor_week', 38,
    'anchor_year', 2026,
    'heads_up_enabled', true,
    'heads_up_time', '12:00'
  ),
  'Knowledge Sharing rotation: department order, the office week the first department presents, and the Monday heads-up email.',
  now()
)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Skipped weeks
-- ---------------------------------------------------------------------------
create table if not exists public.kss_rotation_skips (
  id uuid primary key default gen_random_uuid(),
  meeting_week integer not null check (meeting_week between 1 and 53),
  meeting_year integer not null check (meeting_year between 2000 and 2100),
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint kss_rotation_skips_week_unique unique (meeting_week, meeting_year)
);

alter table public.kss_rotation_skips enable row level security;

-- Read-only for admins; writes go through the service-role API route.
create policy kss_rotation_skips_select on public.kss_rotation_skips
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and lower(trim(p.role::text)) in ('developer', 'super_admin', 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Heads-up send log (one row per target meeting week)
-- ---------------------------------------------------------------------------
create table if not exists public.kss_heads_up_log (
  meeting_week integer not null,
  meeting_year integer not null,
  department text,
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  recipient_count integer,
  outcome text,
  primary key (meeting_week, meeting_year)
);

alter table public.kss_heads_up_log enable row level security;

-- Deployed on Monday 14 Sep 2026 after 12:00: hold the heads-up for week 37 so
-- the first run does not mail Stakeholder Engagement before the email has been
-- previewed. Delete this row to release that send.
insert into public.kss_heads_up_log (meeting_week, meeting_year, department, attempt_count, last_attempt_at, sent_at, recipient_count, outcome)
values (37, 2026, 'Stakeholder Engagement', 0, now(), now(), 0, 'held_for_preview')
on conflict (meeting_week, meeting_year) do nothing;

create policy kss_heads_up_log_select on public.kss_heads_up_log
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and lower(trim(p.role::text)) in ('developer', 'super_admin', 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Resolver
-- ---------------------------------------------------------------------------
-- Weeks between two office weeks. Office years start on a configurable January
-- day that is not always a Monday, so round rather than floor across a year edge.
create or replace function public.kss_week_index(p_week integer, p_year integer)
returns integer
language sql
stable
set search_path = public, pg_temp
as $function$
  select round(
    ((public.office_week_year_start(p_year) + (greatest(p_week, 1) - 1) * 7) - date '2000-01-03')::numeric / 7
  )::integer;
$function$;

create or replace function public.kss_department_for_week(p_week integer, p_year integer)
returns table (
  department text,
  presenter_id uuid,
  presenter_name text,
  presenter_department text,
  source text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_settings jsonb;
  v_departments jsonb;
  v_count integer;
  v_anchor_index integer;
  v_target_index integer;
  v_skipped integer;
begin
  -- 1. Explicit roster entry wins.
  return query
    select r.department,
           r.presenter_id,
           coalesce(nullif(trim(p.full_name), ''), nullif(trim(r.presenter_name), '')),
           p.department,
           'roster'::text
    from public.kss_weekly_roster r
    left join public.profiles p on p.id = r.presenter_id
    where r.meeting_week = p_week
      and r.meeting_year = p_year
      and r.is_active = true
    order by r.updated_at desc
    limit 1;
  if found then
    return;
  end if;

  -- 2. No session this week.
  if exists (
    select 1 from public.kss_rotation_skips s
    where s.meeting_week = p_week and s.meeting_year = p_year
  ) then
    return query select null::text, null::uuid, null::text, null::text, 'no_session'::text;
    return;
  end if;

  -- 3. Rotation.
  select value into v_settings from public.system_settings where key = 'kss_rotation';
  v_departments := v_settings -> 'departments';
  v_count := coalesce(jsonb_array_length(v_departments), 0);

  if v_count = 0 or (v_settings ->> 'anchor_week') is null or (v_settings ->> 'anchor_year') is null then
    return query select null::text, null::uuid, null::text, null::text, 'unconfigured'::text;
    return;
  end if;

  v_anchor_index := public.kss_week_index((v_settings ->> 'anchor_week')::integer, (v_settings ->> 'anchor_year')::integer);
  v_target_index := public.kss_week_index(p_week, p_year);

  if v_target_index < v_anchor_index then
    return query select null::text, null::uuid, null::text, null::text, 'before_start'::text;
    return;
  end if;

  select count(*) into v_skipped
  from public.kss_rotation_skips s
  where public.kss_week_index(s.meeting_week, s.meeting_year) >= v_anchor_index
    and public.kss_week_index(s.meeting_week, s.meeting_year) < v_target_index;

  return query
    select v_departments ->> (((v_target_index - v_anchor_index - v_skipped) % v_count)),
           null::uuid,
           null::text,
           null::text,
           'rotation'::text;
end;
$function$;

revoke all on function public.kss_week_index(integer, integer) from public, anon;
revoke all on function public.kss_department_for_week(integer, integer) from public, anon;
grant execute on function public.kss_week_index(integer, integer) to authenticated, service_role;
grant execute on function public.kss_department_for_week(integer, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Close out the July-September cycle
-- ---------------------------------------------------------------------------
-- Weeks 36 and 37 precede the new anchor, so give them roster rows (department
-- only; presenters can be added later from Reports > KSS as before).
insert into public.kss_weekly_roster (meeting_week, meeting_year, department, notes, is_active, created_by)
values
  (36, 2026, 'Quality Assurance', 'Jul-Sep 2026 KSS framework', true, '1aeae0c5-ef2f-4790-be14-d0e696be01af'),
  (37, 2026, 'Stakeholder Engagement', 'Jul-Sep 2026 KSS framework', true, '1aeae0c5-ef2f-4790-be14-d0e696be01af')
on conflict (meeting_week, meeting_year) do nothing;

-- ---------------------------------------------------------------------------
-- 6. Sunday reminder uses the resolver
-- ---------------------------------------------------------------------------
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
  kss_source text;
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

      -- Knowledge Sharing department: a roster entry if one exists, otherwise the
      -- configured rotation. (The previous direct roster SELECT put 5 columns into
      -- 4 variables, so employee presenters were never picked up.)
      select k.department, k.presenter_id, k.presenter_name, k.presenter_department, k.source
      into kss_department, kss_presenter_id, kss_presenter_name, kss_presenter_department, kss_source
      from public.kss_department_for_week(office_week, office_year) k;

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
        payload := payload || jsonb_build_object(
          'kssRosterStatus', case when kss_source = 'no_session' then 'no_session' else 'missing' end
        );
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
-- ---------------------------------------------------------------------------
-- 7. Monday heads-up
-- ---------------------------------------------------------------------------
create or replace function public.process_kss_heads_up()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_settings jsonb;
  v_time time;
  v_lagos_now timestamp := now() at time zone 'Africa/Lagos';
  v_target date;
  v_year integer;
  v_year_start date;
  v_week integer;
  v_log public.kss_heads_up_log%rowtype;
  v_department text;
  v_source text;
  v_anon_key text;
  max_attempts constant integer := 3;
begin
  select value into v_settings from public.system_settings where key = 'kss_rotation';
  if coalesce((v_settings ->> 'heads_up_enabled')::boolean, false) is not true then
    return;
  end if;

  -- Mondays only, from the configured time.
  if extract(isodow from v_lagos_now) <> 1 then
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

  -- The session being announced is next Monday's.
  v_target := v_lagos_now::date + 7;
  v_year := extract(year from v_target)::integer;
  v_year_start := public.office_week_year_start(v_year);
  if v_target < v_year_start then
    v_year := v_year - 1;
    v_year_start := public.office_week_year_start(v_year);
  end if;
  v_week := floor((v_target - v_year_start)::numeric / 7) + 1;

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
    -- No session or no rotation configured: record it so this runs once, not all afternoon.
    insert into public.kss_heads_up_log (meeting_week, meeting_year, attempt_count, last_attempt_at, sent_at, recipient_count, outcome)
    values (v_week, v_year, 0, now(), now(), 0, coalesce(v_source, 'unresolved'))
    on conflict (meeting_week, meeting_year) do update
      set sent_at = excluded.sent_at, outcome = excluded.outcome, last_attempt_at = excluded.last_attempt_at;
    return;
  end if;

  select decrypted_secret into v_anon_key from vault.decrypted_secrets where name = 'anon_key';
  if v_anon_key is null or v_anon_key = '' then
    raise warning 'anon_key is not configured in vault; skipping KSS heads-up';
    return;
  end if;

  insert into public.kss_heads_up_log (meeting_week, meeting_year, department, attempt_count, last_attempt_at, outcome)
  values (v_week, v_year, v_department, 1, now(), 'attempted')
  on conflict (meeting_week, meeting_year) do update
    set department = excluded.department,
        attempt_count = public.kss_heads_up_log.attempt_count + 1,
        last_attempt_at = excluded.last_attempt_at,
        outcome = 'attempted';

  perform net.http_post(
    url := 'https://itqegqxeqkeogwrvlzlj.supabase.co/functions/v1/send-kss-heads-up',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key,
      'apikey', v_anon_key
    ),
    body := jsonb_build_object('meetingWeek', v_week, 'meetingYear', v_year),
    timeout_milliseconds := 120000
  );
end;
$function$;

-- Called by send-kss-heads-up once at least one email is delivered.
create or replace function public.mark_kss_heads_up_sent(p_week integer, p_year integer, p_recipient_count integer)
returns void
language sql
security definer
set search_path = public, pg_temp
as $function$
  update public.kss_heads_up_log
  set sent_at = now(), recipient_count = p_recipient_count, outcome = 'sent'
  where meeting_week = p_week and meeting_year = p_year and sent_at is null;
$function$;

revoke all on function public.process_kss_heads_up() from public, anon, authenticated;
revoke all on function public.mark_kss_heads_up_sent(integer, integer, integer) from public, anon, authenticated;
grant execute on function public.mark_kss_heads_up_sent(integer, integer, integer) to service_role;

select cron.unschedule(jobname) from cron.job where jobname = 'process-kss-heads-up';

select cron.schedule(
  'process-kss-heads-up', '*/15 * * * *',
  $job$select public.process_kss_heads_up()$job$
);

revoke all on function public.process_reminder_schedules() from public, anon, authenticated;
