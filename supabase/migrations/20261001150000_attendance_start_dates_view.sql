-- Each person's attendance start: their first clock-in or manual edit.
--
-- The reports and payroll found each person's earliest attendance record by
-- loading every record for everyone, and PostgREST caps a response at 1,000
-- rows. With 3,617 records the cap fell on 15 Jul 2026, so anyone whose first
-- record came later got no start date - and no absences counted at all. Ten
-- active staff were affected on 1 Oct 2026. One row per person here, so the cap
-- never bites and almost nothing is sent.
--
-- What starts attendance is unchanged from the 17 Sep 2026 rule: a real
-- clock-in (device, app, remote) or a manual edit by Admin & HR. Spelling the
-- two out keeps anything else that writes a record from moving the start.
--
-- security_invoker keeps attendance_records RLS in force for non-service callers.

create or replace view public.attendance_start_dates
with (security_invoker = true)
as
select user_id, min(date) as first_attendance_date
  from public.attendance_records
 where clock_in is not null
    or source = 'manual'
 group by user_id;

comment on view public.attendance_start_dates is
  'First clock-in or manual edit per person: the date attendance starts being scored (see getEffectiveAttendanceStartDate).';
