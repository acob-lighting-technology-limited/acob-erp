-- Enforce weekly report edit/delete windows by meeting date, with per-week override support.

create table if not exists public.weekly_report_meeting_windows (
  id uuid primary key default gen_random_uuid(),
  week_number integer not null,
  year integer not null,
  meeting_date date not null,
  grace_hours integer not null default 24,
  unlock_until timestamp with time zone,
  unlock_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint weekly_report_meeting_windows_week_year_key unique (week_number, year),
  constraint weekly_report_meeting_windows_grace_hours_check check (grace_hours between 0 and 168)
);

create index if not exists idx_weekly_report_meeting_windows_week_year
  on public.weekly_report_meeting_windows(week_number, year);

create or replace function public.weekly_report_effective_meeting_date(p_week integer, p_year integer)
returns date
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select wrmw.meeting_date
      from public.weekly_report_meeting_windows wrmw
      where wrmw.week_number = p_week
        and wrmw.year = p_year
      limit 1
    ),
    (public.office_week_year_start(p_year) + ((greatest(p_week, 1) - 1) * interval '1 week'))::date
  );
$$;

create or replace function public.weekly_report_lock_deadline(p_week integer, p_year integer)
returns timestamp with time zone
language sql
stable
set search_path = public, pg_temp
as $$
  with cfg as (
    select
      public.weekly_report_effective_meeting_date(p_week, p_year) as meeting_date,
      coalesce(
        (
          select wrmw.grace_hours
          from public.weekly_report_meeting_windows wrmw
          where wrmw.week_number = p_week
            and wrmw.year = p_year
          limit 1
        ),
        24
      ) as grace_hours
  )
  select ((cfg.meeting_date + 1)::timestamp + make_interval(hours => cfg.grace_hours)) at time zone 'Africa/Lagos'
  from cfg;
$$;

create or replace function public.weekly_report_can_mutate(p_week integer, p_year integer)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_unlock_until timestamp with time zone;
  v_deadline timestamp with time zone;
begin
  -- Super admins are the emergency override.
  if public.has_role('super_admin') then
    return true;
  end if;

  select wrmw.unlock_until
  into v_unlock_until
  from public.weekly_report_meeting_windows wrmw
  where wrmw.week_number = p_week
    and wrmw.year = p_year
  limit 1;

  if v_unlock_until is not null and now() <= v_unlock_until then
    return true;
  end if;

  v_deadline := public.weekly_report_lock_deadline(p_week, p_year);
  return now() <= v_deadline;
end;
$$;

create or replace function public.weekly_report_lock_state(p_week integer, p_year integer)
returns table (
  meeting_date date,
  grace_hours integer,
  unlock_until timestamp with time zone,
  lock_deadline timestamp with time zone,
  is_locked boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with cfg as (
    select
      public.weekly_report_effective_meeting_date(p_week, p_year) as meeting_date,
      coalesce(
        (
          select wrmw.grace_hours
          from public.weekly_report_meeting_windows wrmw
          where wrmw.week_number = p_week
            and wrmw.year = p_year
          limit 1
        ),
        24
      ) as grace_hours,
      (
        select wrmw.unlock_until
        from public.weekly_report_meeting_windows wrmw
        where wrmw.week_number = p_week
          and wrmw.year = p_year
        limit 1
      ) as unlock_until,
      public.weekly_report_lock_deadline(p_week, p_year) as lock_deadline
  )
  select
    cfg.meeting_date,
    cfg.grace_hours,
    cfg.unlock_until,
    cfg.lock_deadline,
    not (
      public.has_role('super_admin')
      or (cfg.unlock_until is not null and now() <= cfg.unlock_until)
      or now() <= cfg.lock_deadline
    ) as is_locked
  from cfg;
$$;

alter table public.weekly_report_meeting_windows enable row level security;

drop policy if exists "Weekly report meeting windows select" on public.weekly_report_meeting_windows;
create policy "Weekly report meeting windows select"
  on public.weekly_report_meeting_windows
  for select
  to authenticated
  using (true);

drop policy if exists "Weekly report meeting windows admin manage" on public.weekly_report_meeting_windows;
create policy "Weekly report meeting windows admin manage"
  on public.weekly_report_meeting_windows
  for all
  to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

grant all on table public.weekly_report_meeting_windows to authenticated;
grant all on table public.weekly_report_meeting_windows to service_role;
grant execute on function public.weekly_report_effective_meeting_date(integer, integer) to authenticated, service_role;
grant execute on function public.weekly_report_lock_deadline(integer, integer) to authenticated, service_role;
grant execute on function public.weekly_report_can_mutate(integer, integer) to authenticated, service_role;
grant execute on function public.weekly_report_lock_state(integer, integer) to authenticated, service_role;

-- Replace weekly_reports mutation policies with lock-aware versions.
drop policy if exists "Leads can manage their own reports" on public.weekly_reports;
drop policy if exists "Leads and admins can update weekly reports" on public.weekly_reports;
drop policy if exists "Only admins can delete weekly reports" on public.weekly_reports;
drop policy if exists "Leads and admins can insert weekly reports" on public.weekly_reports;

create policy "Leads and admins can insert weekly reports"
  on public.weekly_reports
  for insert
  to authenticated
  with check (
    (
      auth.uid() = user_id
      or exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and (
            profiles.role in ('admin', 'super_admin')
            or (profiles.role = 'lead' and profiles.department = weekly_reports.department)
          )
      )
    )
    and public.weekly_report_can_mutate(week_number, year)
  );

create policy "Leads and admins can update weekly reports"
  on public.weekly_reports
  for update
  to authenticated
  using (
    (
      auth.uid() = user_id
      or exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and (
            profiles.role in ('admin', 'super_admin')
            or (profiles.role = 'lead' and profiles.department = weekly_reports.department)
          )
      )
    )
    and public.weekly_report_can_mutate(week_number, year)
  )
  with check (
    (
      auth.uid() = user_id
      or exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and (
            profiles.role in ('admin', 'super_admin')
            or (profiles.role = 'lead' and profiles.department = weekly_reports.department)
          )
      )
    )
    and public.weekly_report_can_mutate(week_number, year)
  );

create policy "Only admins can delete weekly reports"
  on public.weekly_reports
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'super_admin')
    )
    and public.weekly_report_can_mutate(week_number, year)
  );
