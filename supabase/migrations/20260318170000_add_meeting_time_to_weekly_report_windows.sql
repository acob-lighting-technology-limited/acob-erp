alter table public.weekly_report_meeting_windows
  add column if not exists meeting_time time without time zone not null default time '08:30';

update public.weekly_report_meeting_windows
set meeting_time = coalesce(meeting_time, time '08:30')
where meeting_time is distinct from coalesce(meeting_time, time '08:30');
