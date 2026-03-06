-- Ensure assigned approvers can see and act on leave requests.
-- This is required for reliever/department-lead/non-admin approvers.

DROP POLICY IF EXISTS "Leave requests approver select policy" ON public.leave_requests;
CREATE POLICY "Leave requests approver select policy"
ON public.leave_requests
FOR SELECT
TO authenticated
USING (current_approver_user_id = auth.uid());

DROP POLICY IF EXISTS "Leave requests approver update policy" ON public.leave_requests;
CREATE POLICY "Leave requests approver update policy"
ON public.leave_requests
FOR UPDATE
TO authenticated
USING (
  current_approver_user_id = auth.uid()
  AND status IN ('pending', 'pending_evidence')
)
WITH CHECK (true);

DROP POLICY IF EXISTS "Leave approvals approver insert policy" ON public.leave_approvals;
CREATE POLICY "Leave approvals approver insert policy"
ON public.leave_approvals
FOR INSERT
TO authenticated
WITH CHECK (
  approver_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.leave_requests lr
    WHERE lr.id = leave_request_id
      AND lr.current_approver_user_id = auth.uid()
      AND lr.status IN ('pending', 'pending_evidence')
  )
);
