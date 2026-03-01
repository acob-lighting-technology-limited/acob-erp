-- Cap weekly report grace period to a maximum of 24 hours.
-- Keeps existing behavior of allowing immediate lock with 0 hours.

update public.weekly_report_meeting_windows
set grace_hours = 24
where grace_hours > 24;

alter table public.weekly_report_meeting_windows
  drop constraint if exists weekly_report_meeting_windows_grace_hours_check;

alter table public.weekly_report_meeting_windows
  add constraint weekly_report_meeting_windows_grace_hours_check
  check (grace_hours between 0 and 24);
