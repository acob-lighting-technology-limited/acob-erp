-- Attendance appeals: one row per range, and a recorded override.
--
-- 1. batch_id ties together the per-day appeals one bulk change staged for one
--    person, so a range (say 6-29 Oct) lists and is decided as a single item.
--    Each day stays its own appeal: approval still writes one day at a time.
--    NULL for single-day appeals and for everything staged before this.
--
-- 2. An admin can override a pending appeal at any stage. The override is
--    recorded on its own columns, never in the lead or admin review columns, so
--    the history cannot show it as a normal endorsement. overridden_stage keeps
--    the stage that was skipped.
--
-- Writes go through the service role in the API routes; no grant changes.

ALTER TABLE public.attendance_appeals
  ADD COLUMN IF NOT EXISTS batch_id uuid,
  ADD COLUMN IF NOT EXISTS overridden_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS overridden_at timestamptz,
  ADD COLUMN IF NOT EXISTS override_reason text,
  ADD COLUMN IF NOT EXISTS overridden_stage varchar(30)
    CHECK (overridden_stage IN ('pending_lead', 'pending_admin', 'pending_hr_lead'));

CREATE INDEX IF NOT EXISTS idx_attendance_appeals_batch_id
  ON public.attendance_appeals (batch_id)
  WHERE batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_appeals_overridden_by
  ON public.attendance_appeals (overridden_by)
  WHERE overridden_by IS NOT NULL;
