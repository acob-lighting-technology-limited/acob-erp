-- Migration: Phase 12 Grand Finale Cleanup
-- Description: Final, final cleanup of redundant policies and initplan optimizations.

-- =====================================================
-- 1. CONSOLIDATION: DROP KNOWN REDUNDANT POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Salary structures management" ON salary_structures;
DROP POLICY IF EXISTS "Shifts management policy" ON shifts;
DROP POLICY IF EXISTS "Starlink payments management" ON starlink_payments;

-- =====================================================
-- 2. PERFORMANCE: FIX auth_rls_initplan (Subqueries)
-- =====================================================

-- Table: department_payments
DROP POLICY IF EXISTS "Department payments update policy" ON department_payments;
CREATE POLICY "Department payments update policy" ON department_payments 
FOR UPDATE TO authenticated 
USING (has_role('admin') OR (has_role('lead') AND created_by = (SELECT auth.uid())))
WITH CHECK (has_role('admin') OR (has_role('lead') AND created_by = (SELECT auth.uid())));

-- Table: employee_suspensions
DROP POLICY IF EXISTS "Employee suspensions select policy" ON employee_suspensions;
CREATE POLICY "Employee suspensions select policy" ON employee_suspensions 
FOR SELECT TO authenticated 
USING (
    (employee_id = (SELECT auth.uid())) OR 
    has_role('admin') OR 
    (has_role('lead') AND EXISTS (
        SELECT 1 FROM profiles p1
        WHERE p1.id = employee_suspensions.employee_id 
        AND p1.department_id = (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid()))
    ))
);

-- Table: profiles
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Profiles update policy" ON profiles 
FOR UPDATE TO authenticated 
USING ((SELECT auth.uid()) = id)
WITH CHECK ((SELECT auth.uid()) = id);

-- =====================================================
-- 3. HARDENING: PERMISSIVE
-- =====================================================

-- Table: pending_users
DROP POLICY IF EXISTS "Authenticated users can create pending user" ON pending_users;
CREATE POLICY "Pending users insert policy" ON pending_users 
FOR INSERT TO authenticated 
WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
