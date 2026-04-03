do $$
begin
  if to_regclass('public.weekly_report_schedules') is not null then
    update public.weekly_report_schedules
    set content_choice = 'action_point'
    where content_choice = 'action_tracker';

    alter table public.weekly_report_schedules
      drop constraint if exists weekly_report_schedules_content_choice_check;

    alter table public.weekly_report_schedules
      add constraint weekly_report_schedules_content_choice_check
      check (content_choice in ('both', 'weekly_report', 'action_point'));
  end if;

  if to_regclass('public.digest_schedules') is not null then
    update public.digest_schedules
    set content_choice = 'action_point'
    where content_choice = 'action_tracker';

    alter table public.digest_schedules
      drop constraint if exists digest_schedules_content_choice_check;

    alter table public.digest_schedules
      add constraint digest_schedules_content_choice_check
      check (content_choice in ('both', 'weekly_report', 'action_point'));
  end if;
end $$;
