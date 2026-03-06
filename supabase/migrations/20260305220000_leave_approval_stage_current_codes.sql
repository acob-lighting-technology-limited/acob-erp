-- Move leave approval_stage fully to current workflow stage codes.
-- Removes legacy reliever/supervisor/hr pending values.

UPDATE public.leave_requests
SET approval_stage = CASE approval_stage
  WHEN 'reliever_pending' THEN 'pending_reliever'
  WHEN 'supervisor_pending' THEN 'pending_department_lead'
  WHEN 'hr_pending' THEN COALESCE(
    NULLIF(current_stage_code, ''),
    'pending_admin_hr_lead'
  )
  ELSE approval_stage
END
WHERE approval_stage IN ('reliever_pending', 'supervisor_pending', 'hr_pending');

ALTER TABLE public.leave_requests
DROP CONSTRAINT IF EXISTS leave_requests_approval_stage_check;

ALTER TABLE public.leave_requests
ADD CONSTRAINT leave_requests_approval_stage_check
CHECK (
  approval_stage IN ('completed', 'rejected', 'cancelled')
  OR approval_stage ~ '^pending_[a-z0-9_]+$'
);
