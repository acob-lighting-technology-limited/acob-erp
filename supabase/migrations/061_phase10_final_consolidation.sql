-- Migration: Phase 10 Final Performance Consolidation
-- Description: Final cleanup of overlapping policies and initplan optimizations for improved database efficiency.

-- =====================================================
-- 1. CONSOLIDATION: ELIMINATE REMAINING OVERLAPS
-- =====================================================

-- Table: salary_structures
DROP POLICY IF EXISTS "Only admins can manage salary structures" ON salary_structures;
DROP POLICY IF EXISTS "All authenticated users can view salary structures" ON salary_structures;
CREATE POLICY "Salary structures management" ON salary_structures 
FOR ALL TO authenticated 
USING (has_role('admin'))
WITH CHECK (has_role('admin'));

CREATE POLICY "Salary structures view policy" ON salary_structures 
FOR SELECT TO authenticated 
USING (true);

-- Table: shifts
DROP POLICY IF EXISTS "Only admins can manage shifts" ON shifts;
DROP POLICY IF EXISTS "Shifts select policy" ON shifts;
CREATE POLICY "Shifts management policy" ON shifts 
FOR ALL TO authenticated 
USING (has_role('admin'))
WITH CHECK (has_role('admin'));

CREATE POLICY "Shifts select policy" ON shifts 
FOR SELECT TO authenticated 
USING (true);

-- Table: starlink_payments
DROP POLICY IF EXISTS "Admins can manage starlink payments" ON starlink_payments;
DROP POLICY IF EXISTS "Authenticated users can view starlink payments" ON starlink_payments;
CREATE POLICY "Starlink payments management" ON starlink_payments 
FOR ALL TO authenticated 
USING (has_role('admin') OR has_role('super_admin'))
WITH CHECK (has_role('admin') OR has_role('super_admin'));

CREATE POLICY "Starlink payments select policy" ON starlink_payments 
FOR SELECT TO authenticated 
USING (has_role('admin') OR has_role('staff'));

-- Table: tasks
DROP POLICY IF EXISTS "Leads/admin/super_admin can create tasks" ON tasks;
DROP POLICY IF EXISTS "Task assignee or creator can update" ON tasks;
DROP POLICY IF EXISTS "Tasks select policy" ON tasks;

CREATE POLICY "Tasks insert policy" ON tasks 
FOR INSERT TO authenticated 
WITH CHECK (has_role('lead') OR has_role('admin'));

CREATE POLICY "Tasks update policy" ON tasks 
FOR UPDATE TO authenticated 
USING (assigned_to = (SELECT auth.uid()) OR assigned_by = (SELECT auth.uid()) OR has_role('admin'))
WITH CHECK (assigned_to = (SELECT auth.uid()) OR assigned_by = (SELECT auth.uid()) OR has_role('admin'));

CREATE POLICY "Tasks select policy" ON tasks 
FOR SELECT TO authenticated 
USING (
    assigned_to = (SELECT auth.uid()) OR 
    assigned_by = (SELECT auth.uid()) OR 
    has_role('admin') OR 
    (has_role('lead') AND department = (SELECT department FROM profiles WHERE id = (SELECT auth.uid()) LIMIT 1))
);

-- =====================================================
-- 2. HARDENING: ADDRESS REMAINING ALWAYS TRUE
-- =====================================================

-- Table: customers
DROP POLICY IF EXISTS "Emergency Insert Customers" ON customers;
CREATE POLICY "Staff can create customers" ON customers 
FOR INSERT TO authenticated 
WITH CHECK (has_role('staff') OR has_role('admin'));

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
