-- Attendance appeals: add a 'resolved' status.
--
-- An appeal is 'resolved' when Admin & HR or a lead changes the appealed day
-- directly (single-day edit, bulk edit, open-ended Out of Station) instead of
-- deciding the appeal. Before this, only an AWP/LWP edit closed the appeal, and
-- it closed it as 'approved' - which read as a decision on the employee's
-- stated reason even when the day was set to something else. Every other kind
-- of manual edit left the appeal pending, where a later approval would
-- overwrite the manual status.
--
-- 'resolved' is used for every manual closure, even when the status set
-- matches the one requested: the log then always shows the day was handled
-- outside the appeal, and resolution_note records the status actually set.
--
-- The one-active-appeal-per-day index is left as pending/approved: like a
-- rejection, a resolved appeal does not block a fresh appeal if the day is
-- still appealable afterwards.

alter table public.attendance_appeals
  drop constraint if exists attendance_appeals_status_check;

alter table public.attendance_appeals
  add constraint attendance_appeals_status_check
  check (status in ('pending', 'approved', 'rejected', 'resolved'));
