-- HR Module: Attendance Tracking RLS Policies
-- Enable user-specific access for attendance records

-- =====================================================
-- 1. DROP EXISTING ADMIN-ONLY POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Only admins can view attendance records" ON attendance_records;
DROP POLICY IF EXISTS "Only admins can manage attendance records" ON attendance_records;
DROP POLICY IF EXISTS "Admins can view all attendance" ON attendance_records;
DROP POLICY IF EXISTS "Users can view own attendance" ON attendance_records;

DROP POLICY IF EXISTS "Only admins can view timesheets" ON timesheets;
DROP POLICY IF EXISTS "Only admins can manage timesheets" ON timesheets;

DROP POLICY IF EXISTS "Only admins can view shifts" ON shifts;
DROP POLICY IF EXISTS "Only admins can manage shifts" ON shifts;

-- =====================================================
-- 2. ATTENDANCE RECORDS - USER-SPECIFIC POLICIES
-- =====================================================

-- Users can view their own attendance records
CREATE POLICY "Users can view own attendance"
  ON attendance_records FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Department leads can view department attendance
CREATE POLICY "Department leads can view department attendance"
  ON attendance_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p1
      JOIN profiles p2 ON p2.id = attendance_records.user_id
      WHERE p1.id = auth.uid()
        AND p1.is_department_lead = true
        AND p1.department_id = p2.department_id
        AND p1.department_id IS NOT NULL
    )
  );

-- Admins can view all attendance records
CREATE POLICY "Admins can view all attendance"
  ON attendance_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Users can create their own attendance records (clock in)
CREATE POLICY "Users can clock in"
  ON attendance_records FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own attendance records (clock out)
CREATE POLICY "Users can clock out"
  ON attendance_records FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND clock_out IS NULL)
  WITH CHECK (auth.uid() = user_id);

-- Only admins can delete attendance records
CREATE POLICY "Admins can delete attendance"
  ON attendance_records FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- =====================================================
-- 3. TIMESHEETS - USER-SPECIFIC ACCESS
-- =====================================================

-- Users can view their own timesheets
CREATE POLICY "Users can view own timesheets"
  ON timesheets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Department leads can view department timesheets
CREATE POLICY "Department leads can view department timesheets"
  ON timesheets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p1
      JOIN profiles p2 ON p2.id = timesheets.user_id
      WHERE p1.id = auth.uid()
        AND p1.is_department_lead = true
        AND p1.department_id = p2.department_id
        AND p1.department_id IS NOT NULL
    )
  );

-- Admins can view all timesheets
CREATE POLICY "Admins can view all timesheets"
  ON timesheets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Users can create/update their own timesheets
CREATE POLICY "Users can manage own timesheets"
  ON timesheets FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 4. SHIFTS - READ-ONLY FOR ALL, ADMIN MANAGE
-- =====================================================

-- All authenticated users can view shifts
CREATE POLICY "All users can view shifts"
  ON shifts FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage shifts
CREATE POLICY "Only admins can manage shifts"
  ON shifts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
