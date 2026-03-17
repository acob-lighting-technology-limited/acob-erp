-- ============================================
-- Employment Status Management Migration
-- ============================================

-- 1. Create employment_status enum type
CREATE TYPE employment_status AS ENUM ('active', 'suspended', 'terminated', 'on_leave');

-- 2. Add employment status columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS employment_status employment_status DEFAULT 'active',
ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status_changed_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS termination_date DATE,
ADD COLUMN IF NOT EXISTS termination_reason TEXT;

-- 3. Create employee_suspensions table for tracking suspension history
CREATE TABLE IF NOT EXISTS employee_suspensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  suspended_by UUID REFERENCES profiles(id),
  reason TEXT NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,  -- NULL = indefinite
  is_active BOOLEAN DEFAULT true,
  lifted_by UUID REFERENCES profiles(id),
  lifted_at TIMESTAMPTZ,
  lift_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_employment_status ON profiles(employment_status);
CREATE INDEX IF NOT EXISTS idx_employee_suspensions_employee_id ON employee_suspensions(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_suspensions_is_active ON employee_suspensions(is_active);

-- 5. Enable RLS on employee_suspensions
ALTER TABLE employee_suspensions ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for employee_suspensions

-- Admins and Super Admins can view all suspensions
CREATE POLICY "Admins can view all suspensions" ON employee_suspensions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Department leads can view suspensions in their departments
CREATE POLICY "Leads can view own department suspensions" ON employee_suspensions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN profiles emp ON emp.id = employee_suspensions.employee_id
      WHERE p.id = auth.uid()
      AND p.is_department_lead = true
      AND emp.department_id = ANY(
        SELECT unnest(p.lead_departments::uuid[])
      )
    )
  );

-- Employees can view their own suspensions
CREATE POLICY "Users can view own suspensions" ON employee_suspensions
  FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

-- Only admins and super_admins can create suspensions
CREATE POLICY "Admins can create suspensions" ON employee_suspensions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Only admins and super_admins can update suspensions (lift them)
CREATE POLICY "Admins can update suspensions" ON employee_suspensions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 7. Create trigger to update updated_at on employee_suspensions
CREATE OR REPLACE FUNCTION update_employee_suspensions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_employee_suspensions_updated_at
  BEFORE UPDATE ON employee_suspensions
  FOR EACH ROW
  EXECUTE FUNCTION update_employee_suspensions_updated_at();

-- 8. Create function to automatically lift expired suspensions
CREATE OR REPLACE FUNCTION check_and_lift_expired_suspensions()
RETURNS void AS $$
BEGIN
  -- Update suspensions where end_date has passed
  UPDATE employee_suspensions
  SET 
    is_active = false,
    lifted_at = now(),
    lift_reason = 'Automatically lifted - suspension period ended'
  WHERE 
    is_active = true 
    AND end_date IS NOT NULL 
    AND end_date < CURRENT_DATE;
    
  -- Update profiles for employees whose suspensions were lifted
  UPDATE profiles p
  SET 
    employment_status = 'active',
    status_changed_at = now(),
    updated_at = now()
  FROM employee_suspensions s
  WHERE 
    p.id = s.employee_id
    AND p.employment_status = 'suspended'
    AND s.is_active = false
    AND s.lifted_at = (
      SELECT MAX(lifted_at) 
      FROM employee_suspensions 
      WHERE employee_id = p.id AND is_active = false
    )
    AND NOT EXISTS (
      SELECT 1 FROM employee_suspensions 
      WHERE employee_id = p.id AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Add comment for documentation
COMMENT ON TABLE employee_suspensions IS 'Tracks employee suspension history with start/end dates, reasons, and who suspended/lifted';
COMMENT ON COLUMN profiles.employment_status IS 'Current employment status: active, suspended, terminated, or on_leave';
COMMENT ON COLUMN profiles.status_changed_at IS 'Timestamp when employment status was last changed';
COMMENT ON COLUMN profiles.status_changed_by IS 'User ID of who changed the employment status';
COMMENT ON COLUMN profiles.termination_date IS 'Date of employment termination (if terminated)';
COMMENT ON COLUMN profiles.termination_reason IS 'Reason for termination (if terminated)';;
