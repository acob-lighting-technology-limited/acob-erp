
-- 1. pending_users: drop legacy always-true Supabase auto-generated policies
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.pending_users;
DROP POLICY IF EXISTS "Enable insert for anon users" ON public.pending_users;

-- 2. leave_requests: tighten approver update WITH CHECK (was always true)
DROP POLICY IF EXISTS "Leave requests approver update policy" ON public.leave_requests;
CREATE POLICY "Leave requests approver update policy"
  ON public.leave_requests
  FOR UPDATE
  TO authenticated
  USING (
    current_approver_user_id = (SELECT auth.uid())
    AND status IN ('pending', 'pending_evidence')
  )
  WITH CHECK (
    current_approver_user_id = (SELECT auth.uid())
    AND status IN ('approved', 'rejected', 'pending_evidence', 'pending')
  );

-- 3. reminder_schedules: this is a system config table (no user_id).
--    Replace the blanket "ALL = true" with admin-only access using the is_admin() helper.
DROP POLICY IF EXISTS "Allow authenticated users full access on reminder_schedules" ON public.reminder_schedules;

CREATE POLICY "reminder_schedules_admin_all"
  ON public.reminder_schedules FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
;
