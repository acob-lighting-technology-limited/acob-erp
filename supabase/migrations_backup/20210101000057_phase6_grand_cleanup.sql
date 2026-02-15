-- Migration: Phase 6 Final Performance & Security Consolidation
-- Description: Systematically drops overlapping policies and replaces them with single consolidated ones.

-- =====================================================
-- 1. PERFORMANCE: CONSOLIDATE OVERLAPPING POLICIES
-- =====================================================

-- Table: department_payments
DROP POLICY IF EXISTS "Users can insert payments in their department" ON department_payments;
DROP POLICY IF EXISTS "Admins can insert payments" ON department_payments;
CREATE POLICY "Department payments insert policy" ON department_payments 
FOR INSERT TO authenticated 
WITH CHECK (has_role('admin') OR has_role('lead'));

DROP POLICY IF EXISTS "Users can view their department payments" ON department_payments;
DROP POLICY IF EXISTS "Admins can view all payments" ON department_payments;
CREATE POLICY "Department payments select policy" ON department_payments 
FOR SELECT TO authenticated 
USING (
    has_role('admin') OR 
    (has_role('lead') AND EXISTS (
        SELECT 1 FROM profiles p1
        WHERE p1.id = auth.uid() 
        AND p1.department_id = department_payments.department_id -- Fixed type mismatch: TEXT vs UUID
    ))
);

DROP POLICY IF EXISTS "Users can update their own payments" ON department_payments;
DROP POLICY IF EXISTS "Admins can update all payments" ON department_payments;
CREATE POLICY "Department payments update policy" ON department_payments 
FOR UPDATE TO authenticated 
USING (has_role('admin') OR (has_role('lead') AND created_by = auth.uid()));

-- Table: employee_suspensions
DROP POLICY IF EXISTS "Admins can view all suspensions" ON employee_suspensions;
DROP POLICY IF EXISTS "Leads can view own department suspensions" ON employee_suspensions;
DROP POLICY IF EXISTS "Users can view own suspensions" ON employee_suspensions;
CREATE POLICY "Employee suspensions select policy" ON employee_suspensions 
FOR SELECT TO authenticated 
USING (
    employee_id = auth.uid() OR 
    has_role('admin') OR 
    (has_role('lead') AND EXISTS (
        SELECT 1 FROM profiles p1
        WHERE p1.id = employee_suspensions.employee_id 
        AND p1.department = (SELECT department FROM profiles WHERE id = auth.uid() LIMIT 1)
    ))
);

-- Table: shifts
DROP POLICY IF EXISTS "All users can view shifts" ON shifts;
DROP POLICY IF EXISTS "All authenticated users can view shifts" ON shifts;
CREATE POLICY "Shifts select policy" ON shifts 
FOR SELECT TO authenticated 
USING (true);

-- Table: task_assignments
DROP POLICY IF EXISTS "Users can view their own task assignments" ON task_assignments;
DROP POLICY IF EXISTS "Admins can view all task assignments" ON task_assignments;
DROP POLICY IF EXISTS "Department leads can view assignments for their departments" ON task_assignments;
CREATE POLICY "Task assignments select policy" ON task_assignments 
FOR SELECT TO authenticated 
USING (
    user_id = auth.uid() OR 
    has_role('admin') OR 
    has_role('lead')
);

-- Table: task_user_completion
DROP POLICY IF EXISTS "Users can view their own task completions" ON task_user_completion;
DROP POLICY IF EXISTS "Department leads can view completions for their department task" ON task_user_completion;
DROP POLICY IF EXISTS "Admins can view all task completions" ON task_user_completion;
CREATE POLICY "Task user completion select policy" ON task_user_completion 
FOR SELECT TO authenticated 
USING (
    user_id = auth.uid() OR 
    has_role('admin') OR 
    has_role('lead')
);

-- Table: timesheets
DROP POLICY IF EXISTS "Users can manage own timesheets" ON timesheets;
CREATE POLICY "Users can manage own timesheets" ON timesheets 
FOR INSERT, UPDATE, DELETE TO authenticated 
WITH CHECK (user_id = auth.uid());

-- =====================================================
-- 2. SECURITY: HARDEN PERMISSIVE POLICIES
-- =====================================================

-- CRM Contacts
DROP POLICY IF EXISTS "Authenticated users can create contacts" ON crm_contacts;
CREATE POLICY "employee can create contacts" ON crm_contacts 
FOR INSERT TO authenticated 
WITH CHECK (has_role('employee') OR has_role('admin'));

-- CRM Opportunities
DROP POLICY IF EXISTS "Authenticated users can create opportunities" ON crm_opportunities;
CREATE POLICY "employee can create opportunities" ON crm_opportunities 
FOR INSERT TO authenticated 
WITH CHECK (has_role('employee') OR has_role('admin'));

-- =====================================================
-- 3. PERFORMANCE: FINAL INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_leave_approvals_appr_id ON leave_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_salary_structures_comp_id ON salary_structures(salary_component_id);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
