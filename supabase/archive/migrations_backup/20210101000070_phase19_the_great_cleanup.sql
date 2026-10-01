-- Migration: Phase 19 The Great Performance Cleanup (V2)
-- Description: Systematically replaces overlapping 'FOR ALL' policies and 
-- optimizes ALL remaining auth function calls with subqueries.

-- =====================================================
-- 1. HARDEN ASSET ISSUES
-- =====================================================
DROP POLICY IF EXISTS "Asset issues select policy" ON asset_issues;
DROP POLICY IF EXISTS "Asset issues manage policy" ON asset_issues;
DROP POLICY IF EXISTS "Asset issues insert policy" ON asset_issues;
DROP POLICY IF EXISTS "Asset issues update policy" ON asset_issues;
DROP POLICY IF EXISTS "Asset issues delete policy" ON asset_issues;
DROP POLICY IF EXISTS "Authenticated users can insert asset issues" ON asset_issues;
DROP POLICY IF EXISTS "Users can update asset issues" ON asset_issues;

CREATE POLICY "Asset issues select policy" ON asset_issues FOR SELECT TO authenticated 
USING ((SELECT has_role('employee')) OR (SELECT has_role('admin')));

CREATE POLICY "Asset issues insert policy" ON asset_issues FOR INSERT TO authenticated 
WITH CHECK (true);

CREATE POLICY "Asset issues update policy" ON asset_issues FOR UPDATE TO authenticated 
USING ((SELECT has_role('admin')));

CREATE POLICY "Asset issues delete policy" ON asset_issues FOR DELETE TO authenticated 
USING ((SELECT has_role('admin')));


-- =====================================================
-- 2. HARDEN METERS & GATEWAYS
-- =====================================================

-- Table: gateways
DROP POLICY IF EXISTS "Gateways select policy" ON gateways;
DROP POLICY IF EXISTS "Gateways insert policy" ON gateways;
DROP POLICY IF EXISTS "Gateways update policy" ON gateways;
DROP POLICY IF EXISTS "Gateways delete policy" ON gateways;
DROP POLICY IF EXISTS "Gateways manage policy" ON gateways;
DROP POLICY IF EXISTS "Enable read access for all users" ON gateways;
DROP POLICY IF EXISTS "employee read gateways" ON gateways;
DROP POLICY IF EXISTS "Admin full access to gateways" ON gateways;

CREATE POLICY "Gateways select policy" ON gateways FOR SELECT TO authenticated 
USING ((SELECT has_role('employee')) OR (SELECT has_role('admin')));

CREATE POLICY "Gateways insert policy" ON gateways FOR INSERT TO authenticated 
WITH CHECK ((SELECT has_role('admin')));

CREATE POLICY "Gateways update policy" ON gateways FOR UPDATE TO authenticated 
USING ((SELECT has_role('admin')));

CREATE POLICY "Gateways delete policy" ON gateways FOR DELETE TO authenticated 
USING ((SELECT has_role('admin')));

-- Table: meters
DROP POLICY IF EXISTS "Meters select policy" ON meters;
DROP POLICY IF EXISTS "Meters insert policy" ON meters;
DROP POLICY IF EXISTS "Meters update policy" ON meters;
DROP POLICY IF EXISTS "Meters delete policy" ON meters;
DROP POLICY IF EXISTS "Meters manage policy" ON meters;
DROP POLICY IF EXISTS "Users with access can read meters" ON meters;
DROP POLICY IF EXISTS "Admin full access to meters" ON meters;
DROP POLICY IF EXISTS "Emergency Insert Meters" ON meters;
DROP POLICY IF EXISTS "employee create meters" ON meters;
DROP POLICY IF EXISTS "employee update meters" ON meters;

CREATE POLICY "Meters select policy" ON meters FOR SELECT TO authenticated 
USING ((SELECT has_role('employee')) OR (SELECT has_role('admin')));

CREATE POLICY "Meters insert policy" ON meters FOR INSERT TO authenticated 
WITH CHECK ((SELECT has_role('employee')) OR (SELECT has_role('admin')));

CREATE POLICY "Meters update policy" ON meters FOR UPDATE TO authenticated 
USING ((SELECT has_role('employee')) OR (SELECT has_role('admin')));

CREATE POLICY "Meters delete policy" ON meters FOR DELETE TO authenticated 
USING ((SELECT has_role('admin')));


-- =====================================================
-- 3. HARDEN PAYROLL & HR
-- =====================================================

-- Table: payroll_entries
DROP POLICY IF EXISTS "Payroll entries select policy" ON payroll_entries;
DROP POLICY IF EXISTS "Payroll entries insert policy" ON payroll_entries;
DROP POLICY IF EXISTS "Payroll entries update policy" ON payroll_entries;
DROP POLICY IF EXISTS "Payroll entries delete policy" ON payroll_entries;
DROP POLICY IF EXISTS "Payroll entries manage policy" ON payroll_entries;
CREATE POLICY "Payroll entries select policy" ON payroll_entries FOR SELECT TO authenticated 
USING (user_id = (SELECT auth.uid()) OR (SELECT has_role('admin')));

CREATE POLICY "Payroll entries insert policy" ON payroll_entries FOR INSERT TO authenticated 
WITH CHECK ((SELECT has_role('admin')));

CREATE POLICY "Payroll entries update policy" ON payroll_entries FOR UPDATE TO authenticated 
USING ((SELECT has_role('admin')));

CREATE POLICY "Payroll entries delete policy" ON payroll_entries FOR DELETE TO authenticated 
USING ((SELECT has_role('admin')));

-- Table: payroll_periods
DROP POLICY IF EXISTS "Payroll periods select policy" ON payroll_periods;
DROP POLICY IF EXISTS "Payroll periods insert policy" ON payroll_periods;
DROP POLICY IF EXISTS "Payroll periods update policy" ON payroll_periods;
DROP POLICY IF EXISTS "Payroll periods delete policy" ON payroll_periods;
DROP POLICY IF EXISTS "Payroll periods manage policy" ON payroll_periods;
CREATE POLICY "Payroll periods select policy" ON payroll_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Payroll periods insert policy" ON payroll_periods FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "Payroll periods update policy" ON payroll_periods FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Payroll periods delete policy" ON payroll_periods FOR DELETE TO authenticated USING ((SELECT has_role('admin')));

-- Table: payslips
DROP POLICY IF EXISTS "Payslips select policy" ON payslips;
DROP POLICY IF EXISTS "Payslips insert policy" ON payslips;
DROP POLICY IF EXISTS "Payslips update policy" ON payslips;
DROP POLICY IF EXISTS "Payslips delete policy" ON payslips;
DROP POLICY IF EXISTS "Payslips manage policy" ON payslips;
CREATE POLICY "Payslips select policy" ON payslips FOR SELECT TO authenticated 
USING (user_id = (SELECT auth.uid()) OR (SELECT has_role('admin')));

CREATE POLICY "Payslips insert policy" ON payslips FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "Payslips update policy" ON payslips FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Payslips delete policy" ON payslips FOR DELETE TO authenticated USING ((SELECT has_role('admin')));


-- =====================================================
-- 4. HARDEN PERFORMANCE & SALARY STRUCTURES
-- =====================================================

-- Table: performance_ratings
DROP POLICY IF EXISTS "Performance ratings select policy" ON performance_ratings;
DROP POLICY IF EXISTS "Performance ratings insert policy" ON performance_ratings;
DROP POLICY IF EXISTS "Performance ratings update policy" ON performance_ratings;
DROP POLICY IF EXISTS "Performance ratings delete policy" ON performance_ratings;
DROP POLICY IF EXISTS "Performance ratings manage policy" ON performance_ratings;
CREATE POLICY "Performance ratings select policy" ON performance_ratings FOR SELECT TO authenticated 
USING ((SELECT has_role('admin')) OR EXISTS (SELECT 1 FROM performance_reviews pr WHERE pr.id = performance_ratings.performance_review_id AND (pr.user_id = (SELECT auth.uid()) OR pr.reviewer_id = (SELECT auth.uid()))));
CREATE POLICY "Performance ratings insert policy" ON performance_ratings FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "Performance ratings update policy" ON performance_ratings FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Performance ratings delete policy" ON performance_ratings FOR DELETE TO authenticated USING ((SELECT has_role('admin')));

-- Table: salary_structures
DROP POLICY IF EXISTS "Salary structures select policy" ON salary_structures;
DROP POLICY IF EXISTS "Salary structures insert policy" ON salary_structures;
DROP POLICY IF EXISTS "Salary structures update policy" ON salary_structures;
DROP POLICY IF EXISTS "Salary structures delete policy" ON salary_structures;
DROP POLICY IF EXISTS "Salary structures manage policy" ON salary_structures;
CREATE POLICY "Salary structures select policy" ON salary_structures FOR SELECT TO authenticated 
USING ((SELECT has_role('admin')) OR EXISTS (SELECT 1 FROM employee_salaries es WHERE es.id = salary_structures.employee_salary_id AND es.user_id = (SELECT auth.uid())));
CREATE POLICY "Salary structures insert policy" ON salary_structures FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "Salary structures update policy" ON salary_structures FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Salary structures delete policy" ON salary_structures FOR DELETE TO authenticated USING ((SELECT has_role('admin')));


-- =====================================================
-- 5. USER ROLES CLEANUP
-- =====================================================
DROP POLICY IF EXISTS "User roles select policy" ON user_roles;
DROP POLICY IF EXISTS "User roles insert policy" ON user_roles;
DROP POLICY IF EXISTS "User roles update policy" ON user_roles;
DROP POLICY IF EXISTS "User roles delete policy" ON user_roles;
DROP POLICY IF EXISTS "User roles management" ON user_roles;
CREATE POLICY "User roles select policy" ON user_roles FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR (SELECT has_role('admin')));
CREATE POLICY "User roles insert policy" ON user_roles FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "User roles update policy" ON user_roles FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "User roles delete policy" ON user_roles FOR DELETE TO authenticated USING ((SELECT has_role('admin')));

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
