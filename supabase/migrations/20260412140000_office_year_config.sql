-- Per-year office week anchor configuration.
-- The anchor_day is the January day on which Week 1 begins for that year.

create table if not exists public.office_year_config (
  year integer primary key,
  anchor_day integer not null default 12
    constraint office_year_config_anchor_day_check check (anchor_day between 1 and 31),
  is_locked boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Seed 2026 as locked (cannot be changed from the UI)
insert into public.office_year_config (year, anchor_day, is_locked)
values (2026, 12, true)
on conflict (year) do nothing;

-- RLS
alter table public.office_year_config enable row level security;

-- Everyone can read
create policy "office_year_config_select"
  on public.office_year_config for select
  using (true);

-- Only admins can insert/update
create policy "office_year_config_admin_modify"
  on public.office_year_config for all
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

-- Update the office_week_year_start function to read from the config table,
-- falling back to Jan 12 if no row exists for that year.
create or replace function public.office_week_year_start(p_year integer)
returns date
language sql
stable
set search_path = public, pg_temp
as $$
  select make_date(
    p_year,
    1,
    coalesce(
      (select anchor_day from public.office_year_config where year = p_year),
      12
    )
  );
$$;
