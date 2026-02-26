-- Shift meetings-domain 2026 data from ISO-aligned numbering to office-week numbering.
-- Office week anchor: January 12 (week 1 each office year).

create or replace function public.office_week_year_start(p_year integer)
returns date
language sql
immutable
as $$
  select make_date(p_year, 1, 12);
$$;

create or replace function public.office_weeks_in_year(p_year integer)
returns integer
language sql
immutable
as $$
  select ceil(
    extract(
      epoch from (
        public.office_week_year_start(p_year + 1)::timestamp
        - public.office_week_year_start(p_year)::timestamp
      )
    ) / 604800.0
  )::integer;
$$;

do $$
declare
  v_collision_count integer;
begin
  with mapped as (
    select
      wr.id,
      wr.department,
      case
        when wr.week_number - 2 >= 1 then wr.week_number - 2
        else public.office_weeks_in_year(wr.year - 1) + (wr.week_number - 2)
      end as new_week,
      case
        when wr.week_number - 2 >= 1 then wr.year
        else wr.year - 1
      end as new_year
    from public.weekly_reports wr
    where wr.year = 2026
  ),
  duplicate_targets as (
    select department, new_week, new_year
    from mapped
    group by department, new_week, new_year
    having count(*) > 1
  ),
  conflicts_with_existing as (
    select m.id
    from mapped m
    join public.weekly_reports wr
      on wr.department = m.department
     and wr.week_number = m.new_week
     and wr.year = m.new_year
     and wr.id <> m.id
  ),
  all_conflicts as (
    select 1 from duplicate_targets
    union all
    select 1 from conflicts_with_existing
  )
  select count(*) into v_collision_count from all_conflicts;

  if v_collision_count > 0 then
    raise exception
      'Aborting office-week migration: weekly_reports target collision detected (% conflict group(s)).',
      v_collision_count;
  end if;
end $$;

-- Weekly reports
update public.weekly_reports wr
set
  week_number = case
    when wr.week_number - 2 >= 1 then wr.week_number - 2
    else public.office_weeks_in_year(wr.year - 1) + (wr.week_number - 2)
  end,
  year = case
    when wr.week_number - 2 >= 1 then wr.year
    else wr.year - 1
  end
where wr.year = 2026;

-- Action tracker items
update public.action_items ai
set
  week_number = case
    when ai.week_number - 2 >= 1 then ai.week_number - 2
    else public.office_weeks_in_year(ai.year - 1) + (ai.week_number - 2)
  end,
  year = case
    when ai.week_number - 2 >= 1 then ai.year
    else ai.year - 1
  end
where ai.year = 2026;

-- One-time schedules only
update public.digest_schedules ds
set
  meeting_week = case
    when ds.meeting_week - 2 >= 1 then ds.meeting_week - 2
    else public.office_weeks_in_year(ds.meeting_year - 1) + (ds.meeting_week - 2)
  end,
  meeting_year = case
    when ds.meeting_week - 2 >= 1 then ds.meeting_year
    else ds.meeting_year - 1
  end
where ds.schedule_type = 'one_time'
  and ds.meeting_year = 2026
  and ds.meeting_week is not null;
