-- Fix RLS Policies for HR Tables (Admin-Only Simplified)
-- These tables are not actively used, so we'll add basic admin-only access
-- This closes the security gap without over-engineering unused features

-- =====================================================
-- RECRUITMENT TABLES (Admin-only)
-- =====================================================

CREATE POLICY "Only admins can view applications"
  ON applications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can manage applications"
  ON applications FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can view interviews"
  ON interviews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can manage interviews"
  ON interviews FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can view offers"
  ON offers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can manage offers"
  ON offers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "All authenticated users can view job postings"
  ON job_postings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage job postings"
  ON job_postings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- =====================================================
-- LEAVE MANAGEMENT TABLES (Admin-only for now)
-- =====================================================

CREATE POLICY "Only admins can view leave requests"
  ON leave_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can manage leave requests"
  ON leave_requests FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can view leave approvals"
  ON leave_approvals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can manage leave approvals"
  ON leave_approvals FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can view leave balances"
  ON leave_balances FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can manage leave balances"
  ON leave_balances FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- =====================================================
-- PAYROLL TABLES (Admin-only)
-- =====================================================

CREATE POLICY "Only admins can view employee salaries"
  ON employee_salaries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can manage employee salaries"
  ON employee_salaries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "All authenticated users can view salary components"
  ON salary_components FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage salary components"
  ON salary_components FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "All authenticated users can view salary structures"
  ON salary_structures FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage salary structures"
  ON salary_structures FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "All authenticated users can view payroll periods"
  ON payroll_periods FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage payroll periods"
  ON payroll_periods FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can view payroll entries"
  ON payroll_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can manage payroll entries"
  ON payroll_entries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can view payslips"
  ON payslips FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can manage payslips"
  ON payslips FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- =====================================================
-- PERFORMANCE MANAGEMENT TABLES (Admin-only)
-- =====================================================

CREATE POLICY "Only admins can view performance reviews"
  ON performance_reviews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can manage performance reviews"
  ON performance_reviews FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can view performance ratings"
  ON performance_ratings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can manage performance ratings"
  ON performance_ratings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "All authenticated users can view review cycles"
  ON review_cycles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage review cycles"
  ON review_cycles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can view goals and objectives"
  ON goals_objectives FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can manage goals and objectives"
  ON goals_objectives FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- =====================================================
-- TIME TRACKING TABLES (Admin-only)
-- =====================================================

CREATE POLICY "All authenticated users can view shifts"
  ON shifts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage shifts"
  ON shifts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can view timesheets"
  ON timesheets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can manage timesheets"
  ON timesheets FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can view overtime requests"
  ON overtime_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can manage overtime requests"
  ON overtime_requests FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can view attendance records"
  ON attendance_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Only admins can manage attendance records"
  ON attendance_records FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Add comments to mark these as unused
COMMENT ON TABLE applications IS 'HR recruitment system - Currently unused, admin-only access';
COMMENT ON TABLE interviews IS 'HR recruitment system - Currently unused, admin-only access';
COMMENT ON TABLE offers IS 'HR recruitment system - Currently unused, admin-only access';
COMMENT ON TABLE job_postings IS 'HR recruitment system - Currently unused, admin-only access';
COMMENT ON TABLE leave_requests IS 'HR leave management - Currently unused, admin-only access';
COMMENT ON TABLE leave_approvals IS 'HR leave management - Currently unused, admin-only access';
COMMENT ON TABLE leave_balances IS 'HR leave management - Currently unused, admin-only access';
COMMENT ON TABLE employee_salaries IS 'HR payroll system - Currently unused, admin-only access';
COMMENT ON TABLE payroll_entries IS 'HR payroll system - Currently unused, admin-only access';
COMMENT ON TABLE payslips IS 'HR payroll system - Currently unused, admin-only access';
COMMENT ON TABLE performance_reviews IS 'HR performance management - Currently unused, admin-only access';
COMMENT ON TABLE performance_ratings IS 'HR performance management - Currently unused, admin-only access';
COMMENT ON TABLE goals_objectives IS 'HR performance management - Currently unused, admin-only access';
COMMENT ON TABLE timesheets IS 'HR time tracking - Currently unused, admin-only access';
COMMENT ON TABLE overtime_requests IS 'HR time tracking - Currently unused, admin-only access';
COMMENT ON TABLE attendance_records IS 'HR time tracking - Currently unused, admin-only access';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
