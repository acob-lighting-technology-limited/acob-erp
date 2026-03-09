do $$
begin
  if to_regclass('public.digest_schedules') is not null
     and to_regclass('public.weekly_report_schedules') is null then
    alter table public.digest_schedules rename to weekly_report_schedules;
  end if;
end
$$;
