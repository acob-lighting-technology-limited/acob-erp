-- Data Integrity Improvements
-- Add NOT NULL constraints, CHECK constraints, and clean up orphaned records

-- =====================================================
-- 1. CLEAN UP ORPHANED RECORDS
-- =====================================================

-- Remove orphaned department_payments (if any)
DELETE FROM department_payments
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = department_payments.department_id);

-- Remove orphaned asset_assignments
DELETE FROM asset_assignments
WHERE NOT EXISTS (SELECT 1 FROM assets WHERE id = asset_assignments.asset_id)
   OR NOT EXISTS (SELECT 1 FROM profiles WHERE id = asset_assignments.assigned_to);

-- Remove orphaned task assignments
UPDATE tasks
SET assigned_to = created_by
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE id = tasks.assigned_to)
  AND EXISTS (SELECT 1 FROM profiles WHERE id = tasks.created_by);

-- =====================================================
-- 2. ADD NOT NULL CONSTRAINTS
-- =====================================================

-- Profiles table
ALTER TABLE profiles
  ALTER COLUMN company_email SET NOT NULL,
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN last_name SET NOT NULL,
  ALTER COLUMN role SET NOT NULL;

-- Department payments table
ALTER TABLE department_payments
  ALTER COLUMN department_id SET NOT NULL,
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN payment_type SET NOT NULL,
  ALTER COLUMN category SET NOT NULL;

-- Departments table
ALTER TABLE departments
  ALTER COLUMN name SET NOT NULL;

-- Office locations table
ALTER TABLE office_locations
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN type SET NOT NULL;

-- Assets table
ALTER TABLE assets
  ALTER COLUMN asset_name SET NOT NULL,
  ALTER COLUMN asset_type SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN created_by SET NOT NULL;

-- Tasks table
ALTER TABLE tasks
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN priority SET NOT NULL,
  ALTER COLUMN assigned_to SET NOT NULL,
  ALTER COLUMN assigned_by SET NOT NULL;

-- =====================================================
-- 3. ADD CHECK CONSTRAINTS FOR ENUMS
-- =====================================================

-- Payment status check
ALTER TABLE department_payments
  DROP CONSTRAINT IF EXISTS department_payments_status_check,
  ADD CONSTRAINT department_payments_status_check 
    CHECK (status IN ('pending', 'due', 'paid', 'overdue', 'cancelled'));

-- Payment type check
ALTER TABLE department_payments
  DROP CONSTRAINT IF EXISTS department_payments_payment_type_check,
  ADD CONSTRAINT department_payments_payment_type_check 
    CHECK (payment_type IN ('one-time', 'recurring'));

-- Recurrence period check
ALTER TABLE department_payments
  DROP CONSTRAINT IF EXISTS department_payments_recurrence_check,
  ADD CONSTRAINT department_payments_recurrence_check 
    CHECK (
      (payment_type = 'one-time' AND recurrence_period IS NULL) OR
      (payment_type = 'recurring' AND recurrence_period IN ('monthly', 'quarterly', 'yearly'))
    );

-- Asset status check
ALTER TABLE assets
  DROP CONSTRAINT IF EXISTS assets_status_check,
  ADD CONSTRAINT assets_status_check 
    CHECK (status IN ('available', 'assigned', 'maintenance', 'retired'));

-- Task status check
ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_status_check,
  ADD CONSTRAINT tasks_status_check 
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'));

-- Task priority check
ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_priority_check,
  ADD CONSTRAINT tasks_priority_check 
    CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

-- Office location type check
ALTER TABLE office_locations
  DROP CONSTRAINT IF EXISTS office_locations_type_check,
  ADD CONSTRAINT office_locations_type_check 
    CHECK (type IN ('office', 'department_office', 'conference_room', 'common_area'));

-- =====================================================
-- 4. ADD BUSINESS LOGIC CONSTRAINTS
-- =====================================================

-- Ensure amount is positive
ALTER TABLE department_payments
  DROP CONSTRAINT IF EXISTS department_payments_amount_positive,
  ADD CONSTRAINT department_payments_amount_positive 
    CHECK (amount IS NULL OR amount >= 0);

-- Ensure amount_paid doesn't exceed amount
ALTER TABLE department_payments
  DROP CONSTRAINT IF EXISTS department_payments_amount_paid_valid,
  ADD CONSTRAINT department_payments_amount_paid_valid 
    CHECK (amount_paid IS NULL OR amount IS NULL OR amount_paid <= amount);

-- Ensure task progress is between 0 and 100
ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_progress_valid,
  ADD CONSTRAINT tasks_progress_valid 
    CHECK (progress >= 0 AND progress <= 100);

-- Ensure email format is valid (basic check)
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_email_format,
  ADD CONSTRAINT profiles_email_format 
    CHECK (company_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- =====================================================
-- 5. ADD FOREIGN KEY CONSTRAINTS (if not exists)
-- =====================================================

-- Department payments -> departments
ALTER TABLE department_payments
  DROP CONSTRAINT IF EXISTS department_payments_department_id_fkey,
  ADD CONSTRAINT department_payments_department_id_fkey 
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;

-- Department payments -> profiles (created_by)
ALTER TABLE department_payments
  DROP CONSTRAINT IF EXISTS department_payments_created_by_fkey,
  ADD CONSTRAINT department_payments_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE RESTRICT;

-- Assets -> profiles (created_by)
ALTER TABLE assets
  DROP CONSTRAINT IF EXISTS assets_created_by_fkey,
  ADD CONSTRAINT assets_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE RESTRICT;

-- Tasks -> profiles (assigned_to, assigned_by)
ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_assigned_to_fkey,
  ADD CONSTRAINT tasks_assigned_to_fkey 
    FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE RESTRICT;

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_assigned_by_fkey,
  ADD CONSTRAINT tasks_assigned_by_fkey 
    FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE RESTRICT;

-- Asset assignments -> assets and profiles
ALTER TABLE asset_assignments
  DROP CONSTRAINT IF EXISTS asset_assignments_asset_id_fkey,
  ADD CONSTRAINT asset_assignments_asset_id_fkey 
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE;

ALTER TABLE asset_assignments
  DROP CONSTRAINT IF EXISTS asset_assignments_assigned_to_fkey,
  ADD CONSTRAINT asset_assignments_assigned_to_fkey 
    FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE RESTRICT;

ALTER TABLE asset_assignments
  DROP CONSTRAINT IF EXISTS asset_assignments_assigned_by_fkey,
  ADD CONSTRAINT asset_assignments_assigned_by_fkey 
    FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE RESTRICT;

-- =====================================================
-- 6. ADD UNIQUE CONSTRAINTS
-- =====================================================

-- Ensure department names are unique
ALTER TABLE departments
  DROP CONSTRAINT IF EXISTS departments_name_unique,
  ADD CONSTRAINT departments_name_unique UNIQUE (name);

-- Ensure office location names are unique
ALTER TABLE office_locations
  DROP CONSTRAINT IF EXISTS office_locations_name_unique,
  ADD CONSTRAINT office_locations_name_unique UNIQUE (name);

-- Ensure profile emails are unique
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_company_email_unique,
  ADD CONSTRAINT profiles_company_email_unique UNIQUE (company_email);

-- =====================================================
-- 7. ADD INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_department_payments_status ON department_payments(status);
CREATE INDEX IF NOT EXISTS idx_department_payments_category ON department_payments(category);
CREATE INDEX IF NOT EXISTS idx_department_payments_next_due ON department_payments(next_payment_due) WHERE status != 'cancelled';
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date) WHERE status != 'completed' AND status != 'cancelled';
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_department_id ON profiles(department_id) WHERE department_id IS NOT NULL;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
