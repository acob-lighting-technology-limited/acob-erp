-- Migration: Phase 16 HR & Payroll Security Hardening
-- Description: Hardens sensitive HR tables (salaries and performance ratings) where records were too permissive.
-- Consolidates redundant policies and ensures employees can see their own data while restricting others.

-- =====================================================
-- 1. HARDEN SALARY STRUCTURES (Huge Privacy Hole)
-- =====================================================

-- Table: salary_structures
-- Problem: Policy "Salary structures view policy" was USING (true) for all authenticated users
DROP POLICY IF EXISTS "Salary structures view policy" ON salary_structures;
DROP POLICY IF EXISTS "Salary structures admin insert" ON salary_structures;
DROP POLICY IF EXISTS "Salary structures admin update" ON salary_structures;
DROP POLICY IF EXISTS "Salary structures admin delete" ON salary_structures;

CREATE POLICY "Salary structures select policy" ON salary_structures 
FOR SELECT TO authenticated 
USING (
    has_role('admin') OR 
    EXISTS (
        SELECT 1 FROM employee_salaries es 
        WHERE es.id = salary_structures.employee_salary_id 
        AND es.user_id = (SELECT auth.uid())
    )
);

CREATE POLICY "Salary structures manage policy" ON salary_structures 
FOR ALL TO authenticated 
USING (has_role('admin'))
WITH CHECK (has_role('admin'));


-- =====================================================
-- 2. HARDEN PERFORMANCE RATINGS (Privacy)
-- =====================================================

-- Table: performance_ratings
-- Problem: Policy "Performance ratings select" was USING (true)
DROP POLICY IF EXISTS "Performance ratings select" ON performance_ratings;
DROP POLICY IF EXISTS "Performance ratings admin insert" ON performance_ratings;
DROP POLICY IF EXISTS "Performance ratings admin update" ON performance_ratings;
DROP POLICY IF EXISTS "Performance ratings admin delete" ON performance_ratings;

CREATE POLICY "Performance ratings select policy" ON performance_ratings 
FOR SELECT TO authenticated 
USING (
    has_role('admin') OR 
    EXISTS (
        SELECT 1 FROM performance_reviews pr 
        WHERE pr.id = performance_ratings.performance_review_id 
        AND (pr.user_id = (SELECT auth.uid()) OR pr.reviewer_id = (SELECT auth.uid()))
    ) OR
    (has_role('lead') AND EXISTS (
        SELECT 1 FROM performance_reviews pr 
        JOIN profiles p ON p.id = pr.user_id
        WHERE pr.id = performance_ratings.performance_review_id 
        AND p.department_id = (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid()) LIMIT 1)
    ))
);

CREATE POLICY "Performance ratings manage policy" ON performance_ratings 
FOR ALL TO authenticated 
USING (has_role('admin'))
WITH CHECK (has_role('admin'));


-- =====================================================
-- 3. CONSOLIDATE EMPLOYEE SALARIES
-- =====================================================

-- Table: employee_salaries
-- Problem: Users couldn't see their own basic salary record even though it belongs to them
DROP POLICY IF EXISTS "Only admins can manage employee salaries" ON employee_salaries;
DROP POLICY IF EXISTS "Only admins can view employee salaries" ON employee_salaries;

CREATE POLICY "Employee salaries select policy" ON employee_salaries 
FOR SELECT TO authenticated 
USING (
    user_id = (SELECT auth.uid()) OR 
    has_role('admin')
);

CREATE POLICY "Employee salaries manage policy" ON employee_salaries 
FOR ALL TO authenticated 
USING (has_role('admin'))
WITH CHECK (has_role('admin'));


-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
