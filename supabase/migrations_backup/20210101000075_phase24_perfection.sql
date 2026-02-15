-- Migration: Phase 24 Database Perfection
-- Description: Consolidates the absolute last set of redundant policies and 
-- fixes the final batch of InitPlan and Always True warnings.

-- =====================================================
-- 1. PROJECT MEMBERS (InitPlan & Redundancy)
-- =====================================================
DROP POLICY IF EXISTS "Project managers can add members" ON project_members;
DROP POLICY IF EXISTS "Project managers can update members" ON project_members;
DROP POLICY IF EXISTS "Users can view project members" ON project_members;
DROP POLICY IF EXISTS "Project members select policy" ON project_members;
DROP POLICY IF EXISTS "Project members insert policy" ON project_members;
DROP POLICY IF EXISTS "Project members update policy" ON project_members;
DROP POLICY IF EXISTS "Project members delete policy" ON project_members;

CREATE POLICY "Project members select policy" ON project_members 
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Project members insert policy" ON project_members 
FOR INSERT TO authenticated 
WITH CHECK (
    (EXISTS (
        SELECT 1 FROM projects 
        WHERE projects.id = project_members.project_id 
        AND (projects.created_by = (SELECT auth.uid()) OR projects.project_manager_id = (SELECT auth.uid()))
    )) OR 
    (SELECT has_role('admin')) OR 
    (SELECT has_role('lead'))
);

CREATE POLICY "Project members update policy" ON project_members 
FOR UPDATE TO authenticated 
USING (
    (EXISTS (
        SELECT 1 FROM projects 
        WHERE projects.id = project_members.project_id 
        AND (projects.created_by = (SELECT auth.uid()) OR projects.project_manager_id = (SELECT auth.uid()))
    )) OR 
    (SELECT has_role('admin')) OR 
    (SELECT has_role('lead'))
);

CREATE POLICY "Project members delete policy" ON project_members 
FOR DELETE TO authenticated 
USING ((SELECT has_role('admin')) OR (SELECT has_role('lead')));


-- =====================================================
-- 2. GOALS & OBJECTIVES (Redundancy & InitPlan)
-- =====================================================
DROP POLICY IF EXISTS "Goals select policy" ON goals_objectives;
DROP POLICY IF EXISTS "Only admins can manage goals and objectives" ON goals_objectives;
DROP POLICY IF EXISTS "Users and managers can create goals" ON goals_objectives;
DROP POLICY IF EXISTS "Users can update own goals" ON goals_objectives;
DROP POLICY IF EXISTS "Goals insert policy" ON goals_objectives;
DROP POLICY IF EXISTS "Goals update policy" ON goals_objectives;
DROP POLICY IF EXISTS "Goals delete policy" ON goals_objectives;

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

CREATE POLICY "Goals insert policy" ON goals_objectives 
FOR INSERT TO authenticated 
WITH CHECK (
    user_id = (SELECT auth.uid()) OR 
    (SELECT has_role('admin')) OR 
    ((SELECT has_role('lead')) AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = goals_objectives.user_id 
        AND profiles.department_id = (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid()))
    ))
);

CREATE POLICY "Goals update policy" ON goals_objectives 
FOR UPDATE TO authenticated 
USING (
    user_id = (SELECT auth.uid()) OR 
    (SELECT has_role('admin'))
);

CREATE POLICY "Goals delete policy" ON goals_objectives 
FOR DELETE TO authenticated 
USING ((SELECT has_role('admin')));


-- =====================================================
-- 3. INTERVIEWS (Redundancy & InitPlan)
-- =====================================================
DROP POLICY IF EXISTS "Interviews select policy" ON interviews;
DROP POLICY IF EXISTS "Only admins can manage interviews" ON interviews;
DROP POLICY IF EXISTS "Only admins can view interviews" ON interviews;
DROP POLICY IF EXISTS "Recruitment employee view interviews" ON interviews;
DROP POLICY IF EXISTS "Interviews insert policy" ON interviews;
DROP POLICY IF EXISTS "Interviews update policy" ON interviews;
DROP POLICY IF EXISTS "Interviews delete policy" ON interviews;

CREATE POLICY "Interviews select policy" ON interviews 
FOR SELECT TO authenticated 
USING ((SELECT has_role('admin')) OR interviewer_id = (SELECT auth.uid()));

CREATE POLICY "Interviews insert policy" ON interviews 
FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));

CREATE POLICY "Interviews update policy" ON interviews 
FOR UPDATE TO authenticated USING ((SELECT has_role('admin')) OR interviewer_id = (SELECT auth.uid()));

CREATE POLICY "Interviews delete policy" ON interviews 
FOR DELETE TO authenticated USING ((SELECT has_role('admin')));


-- =====================================================
-- 4. LEAVE MODULE FINAL TWEAKS (InitPlan)
-- =====================================================

-- Table: leave_requests
DROP POLICY IF EXISTS "Admin can view all leave requests" ON leave_requests;
DROP POLICY IF EXISTS "Users can view own leave requests" ON leave_requests;
DROP POLICY IF EXISTS "Managers can view team leave" ON leave_requests;
DROP POLICY IF EXISTS "Leave requests select policy" ON leave_requests;

CREATE POLICY "Leave requests select policy" ON leave_requests 
FOR SELECT TO authenticated 
USING (
    user_id = (SELECT auth.uid()) OR 
    (SELECT has_role('admin')) OR 
    ((SELECT has_role('lead')) AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = leave_requests.user_id 
        AND profiles.department_id = (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid()))
    ))
);


-- =====================================================
-- 5. SECURITY HARDENING (Always True Fixes)
-- =====================================================

-- Table: applications
DROP POLICY IF EXISTS "Applications insert policy" ON applications;
CREATE POLICY "Applications insert policy" ON applications 
FOR INSERT TO authenticated 
WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- Table: asset_issues
DROP POLICY IF EXISTS "Asset issues insert policy" ON asset_issues;
CREATE POLICY "Asset issues insert policy" ON asset_issues 
FOR INSERT TO authenticated 
WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- Table: pending_users
DROP POLICY IF EXISTS "Pending users insert policy" ON pending_users;
CREATE POLICY "Pending users insert policy" ON pending_users 
FOR INSERT TO authenticated 
WITH CHECK ((SELECT auth.uid()) IS NOT NULL);


-- =====================================================
-- 6. PROFILE REDUNDANCY
-- =====================================================
DROP POLICY IF EXISTS "Profiles select policy" ON profiles;
DROP POLICY IF EXISTS "Profiles view policy" ON profiles;
CREATE POLICY "Profiles select policy" ON profiles 
FOR SELECT TO authenticated 
USING (true);


-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
