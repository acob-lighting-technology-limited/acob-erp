-- HR Module: Leave Management RLS Policies
-- Replace admin-only policies with user-specific access control

-- =====================================================
-- 1. DROP EXISTING ADMIN-ONLY POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Only admins can view leave requests" ON leave_requests;
DROP POLICY IF EXISTS "Only admins can manage leave requests" ON leave_requests;
DROP POLICY IF EXISTS "Admins can view all leave" ON leave_requests;
DROP POLICY IF EXISTS "Users can view own leave" ON leave_requests;

DROP POLICY IF EXISTS "Only admins can view leave types" ON leave_types;
DROP POLICY IF EXISTS "Only admins can manage leave types" ON leave_types;

DROP POLICY IF EXISTS "Only admins can view leave balances" ON leave_balances;
DROP POLICY IF EXISTS "Only admins can manage leave balances" ON leave_balances;

DROP POLICY IF EXISTS "Only admins can view leave approvals" ON leave_approvals;
DROP POLICY IF EXISTS "Only admins can manage leave approvals" ON leave_approvals;

-- =====================================================
-- 2. LEAVE REQUESTS - USER-SPECIFIC POLICIES
-- =====================================================

-- Users can view their own leave requests
CREATE POLICY "Users can view own leave requests"
  ON leave_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Department leads can view their department's leave requests
CREATE POLICY "Department leads can view department leave requests"
  ON leave_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p1
      JOIN profiles p2 ON p2.id = leave_requests.user_id
      WHERE p1.id = auth.uid()
        AND p1.is_department_lead = true
        AND p1.department_id = p2.department_id
        AND p1.department_id IS NOT NULL
    )
  );

-- Admins can view all leave requests
CREATE POLICY "Admins can view all leave requests"
  ON leave_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Users can create their own leave requests
CREATE POLICY "Users can create own leave requests"
  ON leave_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending leave requests
CREATE POLICY "Users can update own pending leave requests"
  ON leave_requests FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id 
    AND status = 'pending'
  )
  WITH CHECK (
    auth.uid() = user_id 
    AND status = 'pending'
  );

-- Department leads can update department leave requests (for approval)
CREATE POLICY "Department leads can approve department leave"
  ON leave_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p1
      JOIN profiles p2 ON p2.id = leave_requests.user_id
      WHERE p1.id = auth.uid()
        AND p1.is_department_lead = true
        AND p1.department_id = p2.department_id
        AND p1.department_id IS NOT NULL
    )
  );

-- Admins can update any leave request
CREATE POLICY "Admins can update all leave requests"
  ON leave_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Only admins can delete leave requests
CREATE POLICY "Admins can delete leave requests"
  ON leave_requests FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- =====================================================
-- 3. LEAVE TYPES - READ-ONLY FOR ALL, ADMIN MANAGE
-- =====================================================

-- All authenticated users can view leave types
CREATE POLICY "All users can view leave types"
  ON leave_types FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage leave types
CREATE POLICY "Only admins can manage leave types"
  ON leave_types FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- =====================================================
-- 4. LEAVE BALANCES - USER-SPECIFIC ACCESS
-- =====================================================

-- Users can view their own leave balances
CREATE POLICY "Users can view own leave balances"
  ON leave_balances FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Department leads can view department leave balances
CREATE POLICY "Department leads can view department balances"
  ON leave_balances FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p1
      JOIN profiles p2 ON p2.id = leave_balances.user_id
      WHERE p1.id = auth.uid()
        AND p1.is_department_lead = true
        AND p1.department_id = p2.department_id
        AND p1.department_id IS NOT NULL
    )
  );

-- Admins can view all leave balances
CREATE POLICY "Admins can view all leave balances"
  ON leave_balances FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Only admins can manage leave balances
CREATE POLICY "Only admins can manage leave balances"
  ON leave_balances FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- =====================================================
-- 5. LEAVE APPROVALS - TRACKING APPROVAL HISTORY
-- =====================================================

-- Users can view approvals for their leave requests
CREATE POLICY "Users can view own leave approvals"
  ON leave_approvals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leave_requests
      WHERE id = leave_approvals.leave_request_id
        AND user_id = auth.uid()
    )
  );

-- Department leads can view department leave approvals
CREATE POLICY "Department leads can view department approvals"
  ON leave_approvals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p1
      JOIN leave_requests lr ON lr.id = leave_approvals.leave_request_id
      JOIN profiles p2 ON p2.id = lr.user_id
      WHERE p1.id = auth.uid()
        AND p1.is_department_lead = true
        AND p1.department_id = p2.department_id
        AND p1.department_id IS NOT NULL
    )
  );

-- Admins can view all approvals
CREATE POLICY "Admins can view all leave approvals"
  ON leave_approvals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Department leads and admins can create approvals
CREATE POLICY "Leads and admins can create approvals"
  ON leave_approvals FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = approver_id
    AND (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
          AND role IN ('admin', 'super_admin')
      )
      OR EXISTS (
        SELECT 1 FROM profiles p1
        JOIN leave_requests lr ON lr.id = leave_approvals.leave_request_id
        JOIN profiles p2 ON p2.id = lr.user_id
        WHERE p1.id = auth.uid()
          AND p1.is_department_lead = true
          AND p1.department_id = p2.department_id
          AND p1.department_id IS NOT NULL
      )
    )
  );

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
