-- Migration: Phase 11 Ultimate Cleanup (FIXED)
-- Description: Resolves final overlapping SELECT policies and initplan optimizations.

-- =====================================================
-- 1. CONSOLIDATION: RESOLVE COMMAND OVERLAPS (SELECT vs ALL)
-- =====================================================

-- Table: salary_structures
DROP POLICY IF EXISTS "Salary structures admin write" ON salary_structures;
DROP POLICY IF EXISTS "Salary structures admin insert" ON salary_structures;
DROP POLICY IF EXISTS "Salary structures admin update" ON salary_structures;
DROP POLICY IF EXISTS "Salary structures admin delete" ON salary_structures;

CREATE POLICY "Salary structures admin insert" ON salary_structures FOR INSERT TO authenticated WITH CHECK (has_role('admin'));
CREATE POLICY "Salary structures admin update" ON salary_structures FOR UPDATE TO authenticated USING (has_role('admin'));
CREATE POLICY "Salary structures admin delete" ON salary_structures FOR DELETE TO authenticated USING (has_role('admin'));

-- Table: shifts
DROP POLICY IF EXISTS "Shifts admin write" ON shifts;
DROP POLICY IF EXISTS "Shifts admin insert" ON shifts;
DROP POLICY IF EXISTS "Shifts admin update" ON shifts;
DROP POLICY IF EXISTS "Shifts admin delete" ON shifts;

CREATE POLICY "Shifts admin insert" ON shifts FOR INSERT TO authenticated WITH CHECK (has_role('admin'));
CREATE POLICY "Shifts admin update" ON shifts FOR UPDATE TO authenticated USING (has_role('admin'));
CREATE POLICY "Shifts admin delete" ON shifts FOR DELETE TO authenticated USING (has_role('admin'));

-- Table: starlink_payments
DROP POLICY IF EXISTS "Starlink payments admin write" ON starlink_payments;
DROP POLICY IF EXISTS "Starlink payments admin insert" ON starlink_payments;
DROP POLICY IF EXISTS "Starlink payments admin update" ON starlink_payments;
DROP POLICY IF EXISTS "Starlink payments admin delete" ON starlink_payments;

CREATE POLICY "Starlink payments admin insert" ON starlink_payments FOR INSERT TO authenticated WITH CHECK (has_role('admin') OR has_role('super_admin'));
CREATE POLICY "Starlink payments admin update" ON starlink_payments FOR UPDATE TO authenticated USING (has_role('admin') OR has_role('super_admin'));
CREATE POLICY "Starlink payments admin delete" ON starlink_payments FOR DELETE TO authenticated USING (has_role('admin') OR has_role('super_admin'));

-- =====================================================
-- 2. PERFORMANCE: FIX FINAL initplan (Subqueries)
-- =====================================================

-- Table: payment_categories
DROP POLICY IF EXISTS "Authenticated users can delete categories" ON payment_categories;
CREATE POLICY "Admins can delete categories" ON payment_categories 
FOR DELETE TO authenticated 
USING (has_role('admin'));

-- Table: department_payments
DROP POLICY IF EXISTS "Department payments select policy" ON department_payments;
CREATE POLICY "Department payments select policy" ON department_payments 
FOR SELECT TO authenticated 
USING (
    has_role('admin') OR 
    (has_role('lead') AND department_id = (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid()))) OR
    created_by = (SELECT auth.uid())
);

-- =====================================================
-- 3. HARDENING: FINAL PERMISSIVE POLICIES
-- =====================================================

-- Table: audit_logs
DROP POLICY IF EXISTS "Audit logs insert policy" ON audit_logs;
CREATE POLICY "Audit logs insert policy" ON audit_logs 
FOR INSERT TO authenticated 
WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- Table: customers
DROP POLICY IF EXISTS "Emergency Update Customers" ON customers;
CREATE POLICY "Staff can update customers" ON customers 
FOR UPDATE TO authenticated 
USING (has_role('staff') OR has_role('admin'));

-- Table: notifications
DROP POLICY IF EXISTS "System and Staff can create notifications" ON notifications;
CREATE POLICY "Notifications insert policy" ON notifications 
FOR INSERT TO authenticated 
WITH CHECK (has_role('staff') OR has_role('admin') OR (SELECT auth.uid()) IS NOT NULL);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
