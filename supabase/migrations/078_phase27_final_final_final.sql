-- Migration: Phase 27 Database Finality
-- Description: The absolute final sweep of redundant policies and InitPlan warnings.

-- =====================================================
-- 1. OFFERS (InitPlan & Redundancy)
-- =====================================================
DROP POLICY IF EXISTS "Only admins can view offers" ON offers;
DROP POLICY IF EXISTS "Only admins can manage offers" ON offers;
DROP POLICY IF EXISTS "Offers select policy" ON offers;
DROP POLICY IF EXISTS "Offers insert policy" ON offers;
DROP POLICY IF EXISTS "Offers update policy" ON offers;
DROP POLICY IF EXISTS "Offers delete policy" ON offers;

CREATE POLICY "Offers select policy" ON offers FOR SELECT TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Offers insert policy" ON offers FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "Offers update policy" ON offers FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Offers delete policy" ON offers FOR DELETE TO authenticated USING ((SELECT has_role('admin')));


-- =====================================================
-- 2. PROJECT UPDATES (InitPlan & Redundancy)
-- =====================================================
DROP POLICY IF EXISTS "Project members can create updates" ON project_updates;
DROP POLICY IF EXISTS "Users can view project updates" ON project_updates;
DROP POLICY IF EXISTS "Project updates select policy" ON project_updates;
DROP POLICY IF EXISTS "Project updates insert policy" ON project_updates;
DROP POLICY IF EXISTS "Project updates update policy" ON project_updates;
DROP POLICY IF EXISTS "Project updates delete policy" ON project_updates;

CREATE POLICY "Project updates select policy" ON project_updates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Project updates insert policy" ON project_updates 
FOR INSERT TO authenticated 
WITH CHECK (
    (EXISTS (
        SELECT 1 FROM project_members 
        WHERE project_members.project_id = project_updates.project_id 
        AND project_members.user_id = (SELECT auth.uid())
    )) OR 
    (SELECT has_role('admin'))
);

CREATE POLICY "Project updates update policy" ON project_updates 
FOR UPDATE TO authenticated 
USING (
    (EXISTS (
        SELECT 1 FROM project_members 
        WHERE project_members.project_id = project_updates.project_id 
        AND project_members.user_id = (SELECT auth.uid())
    )) OR 
    (SELECT has_role('admin'))
);

CREATE POLICY "Project updates delete policy" ON project_updates FOR DELETE TO authenticated USING ((SELECT has_role('admin')));


-- =====================================================
-- 3. ASSET ISSUES (Redundancy Cleanup)
-- =====================================================
DROP POLICY IF EXISTS "Admins can delete asset issues" ON asset_issues;


-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
