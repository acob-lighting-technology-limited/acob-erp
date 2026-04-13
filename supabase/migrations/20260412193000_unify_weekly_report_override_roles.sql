-- Centralize grace-period override roles for all weekly report lock consumers.
-- This keeps every feature that relies on weekly_report_can_mutate /
-- weekly_report_lock_state aligned on the same override behavior.

create or replace function public.weekly_report_has_override_role()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role::text in ('super_admin', 'developer')
  );
$$;

grant execute on function public.weekly_report_has_override_role() to authenticated, service_role;

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
  if public.weekly_report_has_override_role() then
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
  has_override_role boolean,
  can_mutate boolean,
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
      public.weekly_report_lock_deadline(p_week, p_year) as lock_deadline,
      public.weekly_report_has_override_role() as has_override_role
  ),
  state as (
    select
      cfg.meeting_date,
      cfg.grace_hours,
      cfg.unlock_until,
      cfg.lock_deadline,
      cfg.has_override_role,
      (
        cfg.has_override_role
        or (cfg.unlock_until is not null and now() <= cfg.unlock_until)
        or now() <= cfg.lock_deadline
      ) as can_mutate
    from cfg
  )
  select
    state.meeting_date,
    state.grace_hours,
    state.unlock_until,
    state.lock_deadline,
    state.has_override_role,
    state.can_mutate,
    not state.can_mutate as is_locked
  from state;
$$;
