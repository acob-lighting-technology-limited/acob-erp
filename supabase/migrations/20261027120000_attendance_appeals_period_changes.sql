-- Two-stage approval for every manual attendance change.
--
-- 1. One PENDING appeal per person per day, not one pending-or-approved. Every
--    manual status change is now staged as an appeal, so the old rule made a day
--    unchangeable for good once any change on it was approved. Employees still
--    cannot re-appeal an approved day: the employee route checks that itself.
--
-- 2. Period changes (open-ended Out of Station, exemptions) are staged on the
--    appeal too. change_kind says what the appeal applies when confirmed and
--    change_payload carries the requested settings; NULL change_kind is the
--    existing single-day status change. Nothing that reads OOS periods or
--    exemptions changes: they are only written once the change is confirmed.

DROP INDEX IF EXISTS public.appeals_one_active_per_day;

CREATE UNIQUE INDEX IF NOT EXISTS appeals_one_pending_per_day
  ON public.attendance_appeals (user_id, appeal_date)
  WHERE status = 'pending';

ALTER TABLE public.attendance_appeals
  ADD COLUMN IF NOT EXISTS change_kind varchar(30)
    CHECK (change_kind IN ('oos_period', 'exemption')),
  ADD COLUMN IF NOT EXISTS change_payload jsonb;
