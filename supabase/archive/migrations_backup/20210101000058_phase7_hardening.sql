-- Migration: Phase 7 Final Security & Performance Hardening
-- Description: Fixes auth_rls_initplan warnings, hardens CRM security, and removes final overlapping policies.

-- =====================================================
-- 1. SECURITY: HARDEN CRM TABLES (Huge Security Hole)
-- =====================================================

-- Table: crm_contacts
DROP POLICY IF EXISTS "Users can delete contacts" ON crm_contacts;
CREATE POLICY "employee can delete contacts" ON crm_contacts 
FOR DELETE TO authenticated 
USING (has_role('employee') OR has_role('admin'));

DROP POLICY IF EXISTS "Users can update contacts" ON crm_contacts;
CREATE POLICY "employee can update contacts" ON crm_contacts 
FOR UPDATE TO authenticated 
USING (has_role('employee') OR has_role('admin'));

DROP POLICY IF EXISTS "Users can view all contacts" ON crm_contacts;
CREATE POLICY "employee can view contacts" ON crm_contacts 
FOR SELECT TO authenticated 
USING (has_role('employee') OR has_role('admin'));

-- Table: crm_opportunities
DROP POLICY IF EXISTS "Users can delete opportunities" ON crm_opportunities;
CREATE POLICY "employee can delete opportunities" ON crm_opportunities 
FOR DELETE TO authenticated 
USING (has_role('employee') OR has_role('admin'));

DROP POLICY IF EXISTS "Users can update opportunities" ON crm_opportunities;
CREATE POLICY "employee can update opportunities" ON crm_opportunities 
FOR UPDATE TO authenticated 
USING (has_role('employee') OR has_role('admin'));

DROP POLICY IF EXISTS "Users can view all opportunities" ON crm_opportunities;
CREATE POLICY "employee can view opportunities" ON crm_opportunities 
FOR SELECT TO authenticated 
USING (has_role('employee') OR has_role('admin'));

-- Table: crm_pipelines
DROP POLICY IF EXISTS "Authenticated users can create pipelines" ON crm_pipelines;
CREATE POLICY "employee can create pipelines" ON crm_pipelines 
FOR INSERT TO authenticated 
WITH CHECK (has_role('employee') OR has_role('admin'));

-- =====================================================
-- 2. PERFORMANCE: FIX auth_rls_initplan (Select subqueries)
-- =====================================================

-- Table: profiles
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles 
FOR UPDATE TO authenticated 
USING ((SELECT auth.uid()) = id)
WITH CHECK ((SELECT auth.uid()) = id);

-- Table: attendance_records
DROP POLICY IF EXISTS "Users can clock out" ON attendance_records;
CREATE POLICY "Users can clock out" ON attendance_records 
FOR UPDATE TO authenticated 
USING (((SELECT auth.uid()) = user_id) AND (clock_out IS NULL))
WITH CHECK ((SELECT auth.uid()) = user_id);

-- Table: performance_reviews
DROP POLICY IF EXISTS "Reviewers can update own reviews" ON performance_reviews;
CREATE POLICY "Reviewers can update own reviews" ON performance_reviews 
FOR UPDATE TO authenticated 
USING ((SELECT auth.uid()) = reviewer_id)
WITH CHECK ((SELECT auth.uid()) = reviewer_id);

-- =====================================================
-- 3. PERFORMANCE: CONSOLIDATE REMAINING POLICIES
-- =====================================================

-- Table: tariffs
DROP POLICY IF EXISTS "Admin full access to tariffs" ON tariffs;
-- (Tariffs view policy already handles SELECT)

-- Table: task_assignments
DROP POLICY IF EXISTS "Admins can manage task assignments" ON task_assignments;
-- (Task assignments select policy already handles SELECT)

-- Table: tasks
DROP POLICY IF EXISTS "Admins can view all tasks" ON tasks;
DROP POLICY IF EXISTS "Department leads can view tasks for their departments" ON tasks;
DROP POLICY IF EXISTS "Users can view their assigned tasks or tasks they created" ON tasks;
CREATE POLICY "Tasks select policy" ON tasks 
FOR SELECT TO authenticated 
USING (
    assigned_to = (SELECT auth.uid()) OR 
    assigned_by = (SELECT auth.uid()) OR 
    has_role('admin') OR 
    (has_role('lead') AND department = (SELECT department FROM profiles WHERE id = (SELECT auth.uid()) LIMIT 1))
);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
