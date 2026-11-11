-- Staged removal of manual attendance records.
--
-- Applying OOS, a waiver or a leave day is staged and needs the Department Lead's
-- confirmation, but removing one was an instant delete, so an admin could wipe approved days
-- with no second pair of eyes (and "Edit" was a delete followed by a re-stage, which made the
-- person vanish from the list until the lead approved). A removal is now staged too: an appeal
-- whose change_kind is 'record_removal' carries the record to remove, and the removal happens
-- only when it is confirmed.
--
-- Widens the allowed change kinds. Additive; no rows are changed.
ALTER TABLE public.attendance_appeals
  DROP CONSTRAINT IF EXISTS attendance_appeals_change_kind_check;

ALTER TABLE public.attendance_appeals
  ADD CONSTRAINT attendance_appeals_change_kind_check
  CHECK (change_kind IN ('oos_period', 'exemption', 'record_removal'));
