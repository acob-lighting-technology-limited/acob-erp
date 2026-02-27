-- Align action tracker week with weekly report week.
-- Previously action_items linked to weekly_reports were shifted by week logic.

begin;

create or replace function public.fn_calculate_next_week(w integer, y integer)
returns table(next_w integer, next_y integer)
language plpgsql
immutable
as $function$
begin
  -- Meetings now require same-week alignment between Weekly Report and Action Tracker.
  return query select w, y;
end;
$function$;

create or replace function public.fn_sync_action_items_on_week_change()
returns trigger
language plpgsql
as $function$
declare
  target_w int;
  target_y int;
begin
  if (
    old.week_number is distinct from new.week_number
    or old.year is distinct from new.year
    or old.department is distinct from new.department
  ) then
    select next_w, next_y
    into target_w, target_y
    from public.fn_calculate_next_week(new.week_number, new.year);

    update public.action_items
    set week_number = target_w,
        year = target_y,
        department = new.department
    where report_id = new.id;

    if not exists (select 1 from public.action_items where report_id = new.id) then
      declare
        old_target_w int;
        old_target_y int;
      begin
        select next_w, next_y
        into old_target_w, old_target_y
        from public.fn_calculate_next_week(old.week_number, old.year);

        update public.action_items
        set week_number = target_w,
            year = target_y,
            department = new.department
        where department = old.department
          and week_number = old_target_w
          and year = old_target_y
          and status = 'pending';
      end;
    end if;
  end if;

  return new;
end;
$function$;

-- Backfill existing linked action items to match their report week/year/department.
update public.action_items ai
set week_number = wr.week_number,
    year = wr.year,
    department = wr.department
from public.weekly_reports wr
where ai.report_id = wr.id
  and (
    ai.week_number is distinct from wr.week_number
    or ai.year is distinct from wr.year
    or ai.department is distinct from wr.department
  );

commit;
