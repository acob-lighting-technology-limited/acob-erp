-- Migration: Phase 18 The Ultimate Performance Pass
-- Description: Optimizes RLS evaluation by wrapping auth functions in subqueries (InitPlan)
-- and consolidates remaining redundant permissive policies across the system.

-- =====================================================
-- 1. UTILITY: WRAP AUTH FUNCTIONS (InitPlan Optimization)
-- =====================================================

-- Table: goals_objectives
-- Consolidate 4 overlapping policies into 1 and wrap auth.uid()
DROP POLICY IF EXISTS "Admins can view all goals" ON goals_objectives;
DROP POLICY IF EXISTS "Department leads can view department goals" ON goals_objectives;
DROP POLICY IF EXISTS "Only admins can view goals and objectives" ON goals_objectives;
DROP POLICY IF EXISTS "Users can view own goals" ON goals_objectives;

CREATE POLICY "Goals select policy" ON goals_objectives 
FOR SELECT TO authenticated 
USING (
    user_id = (SELECT auth.uid()) OR 
    (SELECT has_role('admin')) OR 
    ((SELECT has_role('lead')) AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = goals_objectives.user_id 
        AND profiles.department_id = (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid()))
    ))
);

-- Table: leave_approvals
-- Consolidate 3 overlapping policies
DROP POLICY IF EXISTS "Admins can view all leave approvals" ON leave_approvals;
DROP POLICY IF EXISTS "Department leads can view department approvals" ON leave_approvals;
DROP POLICY IF EXISTS "Users can view own leave approvals" ON leave_approvals;

CREATE POLICY "Leave approvals select policy" ON leave_approvals 
FOR SELECT TO authenticated 
USING (
    approver_id = (SELECT auth.uid()) OR 
    (SELECT has_role('admin')) OR 
    ((SELECT has_role('lead')) AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = leave_approvals.approver_id 
        AND profiles.department_id = (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid()))
    )) OR
    EXISTS (
        SELECT 1 FROM leave_requests
        WHERE id = leave_approvals.leave_request_id
        AND user_id = (SELECT auth.uid())
    )
);

-- Table: leave_balances
-- Consolidate 3 overlapping policies
DROP POLICY IF EXISTS "Admins can view all leave balances" ON leave_balances;
DROP POLICY IF EXISTS "Department leads can view department balances" ON leave_balances;
DROP POLICY IF EXISTS "Users can view own leave balances" ON leave_balances;

CREATE POLICY "Leave balances select policy" ON leave_balances 
FOR SELECT TO authenticated 
USING (
    user_id = (SELECT auth.uid()) OR 
    (SELECT has_role('admin')) OR 
    ((SELECT has_role('lead')) AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = leave_balances.user_id 
        AND profiles.department_id = (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid()))
    ))
);

-- Table: attendance_records
-- Harden and optimize InitPlan
DROP POLICY IF EXISTS "Attendance view policy" ON attendance_records;
CREATE POLICY "Attendance select policy" ON attendance_records 
FOR SELECT TO authenticated 
USING (
    user_id = (SELECT auth.uid()) OR 
    (SELECT has_role('admin')) OR 
    ((SELECT has_role('lead')) AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = attendance_records.user_id 
        AND profiles.department_id = (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid()))
    ))
);

-- Table: timesheets
-- Harden and optimize InitPlan
DROP POLICY IF EXISTS "Timesheets view policy" ON timesheets;
CREATE POLICY "Timesheets select policy" ON timesheets 
FOR SELECT TO authenticated 
USING (
    user_id = (SELECT auth.uid()) OR 
    (SELECT has_role('admin')) OR 
    ((SELECT has_role('lead')) AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = timesheets.user_id 
        AND profiles.department_id = (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid()))
    ))
);

-- Table: customers
-- Merge redundant policies
DROP POLICY IF EXISTS "employee can create customers" ON customers;
DROP POLICY IF EXISTS "employee create customers" ON customers;
CREATE POLICY "Customers insert policy" ON customers 
FOR INSERT TO authenticated 
WITH CHECK ((SELECT has_role('employee')) OR (SELECT has_role('admin')));

DROP POLICY IF EXISTS "employee can update customers" ON customers;
DROP POLICY IF EXISTS "employee update customers" ON customers;
CREATE POLICY "Customers update policy" ON customers 
FOR UPDATE TO authenticated 
USING ((SELECT has_role('employee')) OR (SELECT has_role('admin')));

-- Table: departments
-- Merge redundant policies
DROP POLICY IF EXISTS "Admins can insert departments" ON departments;
DROP POLICY IF EXISTS "Only admins can insert departments" ON departments;
CREATE POLICY "Departments insert policy" ON departments 
FOR INSERT TO authenticated 
WITH CHECK ((SELECT has_role('admin')));

DROP POLICY IF EXISTS "Admins can update departments" ON departments;
DROP POLICY IF EXISTS "Only admins can update departments" ON departments;
CREATE POLICY "Departments update policy" ON departments 
FOR UPDATE TO authenticated 
USING ((SELECT has_role('admin')));

DROP POLICY IF EXISTS "Admins can delete departments" ON departments;
DROP POLICY IF EXISTS "Only admins can delete departments" ON departments;
CREATE POLICY "Departments delete policy" ON departments 
FOR DELETE TO authenticated 
USING ((SELECT has_role('admin')));


-- =====================================================
-- 2. HARDEN REMAINING SYSTEM TABLES
-- =====================================================

-- Table: user_roles
-- Problem: Overlapping 'ALL' policy and inefficient check
DROP POLICY IF EXISTS "User roles management" ON user_roles;
CREATE POLICY "User roles select policy" ON user_roles 
FOR SELECT TO authenticated 
USING (user_id = (SELECT auth.uid()) OR (SELECT has_role('admin')));

CREATE POLICY "User roles manage policy" ON user_roles 
FOR ALL TO authenticated 
USING ((SELECT has_role('admin')))
WITH CHECK ((SELECT has_role('admin')));

-- Table: overtime_requests
-- Redundant SELECT policies
DROP POLICY IF EXISTS "Only admins can view overtime requests" ON overtime_requests;
DROP POLICY IF EXISTS "Overtime requests select policy" ON overtime_requests;
CREATE POLICY "Overtime requests select policy" ON overtime_requests 
FOR SELECT TO authenticated 
USING (
    user_id = (SELECT auth.uid()) OR 
    (SELECT has_role('admin')) OR 
    ((SELECT has_role('lead')) AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = overtime_requests.user_id 
        AND profiles.department_id = (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid()))
    ))
);

-- Table: leave_types
DROP POLICY IF EXISTS "All authenticated users can view leave types" ON leave_types;
DROP POLICY IF EXISTS "All users can view leave types" ON leave_types;
CREATE POLICY "Leave types select policy" ON leave_types 
FOR SELECT TO authenticated 
USING (true);


-- =====================================================
-- 3. FINAL POLISH ON RECENT HARDIENING
-- =====================================================

-- Fix InitPlan on tables hardened in Phase 15-17
ALTER POLICY "Assets select policy" ON assets USING (
    (SELECT has_role('employee')) OR 
    (SELECT has_role('admin')) OR 
    ((SELECT has_role('lead')) AND department = (SELECT department FROM profiles WHERE id = (SELECT auth.uid()) LIMIT 1))
);

ALTER POLICY "Asset issues select policy" ON asset_issues USING (
    (SELECT has_role('employee')) OR (SELECT has_role('admin'))
);

-- Cleanup redundant policies on 'meters' from the list
DROP POLICY IF EXISTS "Emergency Insert Meters" ON meters;
DROP POLICY IF EXISTS "employee create meters" ON meters;
DROP POLICY IF EXISTS "staff create meters" ON meters;
CREATE POLICY "Meters insert policy" ON meters 
FOR INSERT TO authenticated 
WITH CHECK ((SELECT has_role('employee')) OR (SELECT has_role('admin')));

DROP POLICY IF EXISTS "Emergency Update Meters" ON meters;
DROP POLICY IF EXISTS "employee update meters" ON meters;
DROP POLICY IF EXISTS "staff update meters" ON meters;
CREATE POLICY "Meters update policy" ON meters 
FOR UPDATE TO authenticated 
USING ((SELECT has_role('employee')) OR (SELECT has_role('admin')));

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
