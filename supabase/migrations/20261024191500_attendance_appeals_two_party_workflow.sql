-- Migration: Add two-party approval stages and tracking to attendance_appeals
-- Regular employees: pending_lead -> pending_admin -> approved/rejected/resolved
-- Department leads: pending_admin -> pending_hr_lead -> approved/rejected/resolved
-- Admin manual alteration: pending_lead (lead confirmation) -> approved/rejected/resolved

-- 1. Add stage column
ALTER TABLE public.attendance_appeals
  ADD COLUMN IF NOT EXISTS stage varchar(30) NOT NULL DEFAULT 'pending_lead'
  CHECK (stage IN ('pending_lead', 'pending_admin', 'pending_hr_lead', 'approved', 'rejected', 'resolved'));

-- 2. Add two-party review audit and routing columns
ALTER TABLE public.attendance_appeals
  ADD COLUMN IF NOT EXISTS lead_reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS lead_resolution_note text,
  ADD COLUMN IF NOT EXISTS admin_reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_resolution_note text,
  ADD COLUMN IF NOT EXISTS initiated_by_role varchar(30) NOT NULL DEFAULT 'employee'
    CHECK (initiated_by_role IN ('employee', 'lead_on_behalf', 'admin_manual')),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Backfill stage for existing rows
UPDATE public.attendance_appeals
SET stage = status
WHERE status IN ('approved', 'rejected', 'resolved') AND stage = 'pending_lead';

-- For completed appeals where legacy reviewed_by is present, backfill to admin_reviewed_by
UPDATE public.attendance_appeals
SET admin_reviewed_by = reviewed_by,
    admin_reviewed_at = reviewed_at,
    admin_resolution_note = resolution_note
WHERE reviewed_by IS NOT NULL AND admin_reviewed_by IS NULL;

-- 4. Indexes for performant filtering
CREATE INDEX IF NOT EXISTS idx_attendance_appeals_stage ON public.attendance_appeals (stage);
CREATE INDEX IF NOT EXISTS idx_attendance_appeals_created_by ON public.attendance_appeals (created_by);
