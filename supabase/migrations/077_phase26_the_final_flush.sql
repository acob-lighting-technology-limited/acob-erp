-- Migration: Phase 26 The Final Flush (V2)
-- Description: Flushing the final bits of redundant policies and InitPlan warnings across the database.

-- =====================================================
-- 1. ATTENDANCE RECORDS (InitPlan)
-- =====================================================
DROP POLICY IF EXISTS "Admins can delete attendance" ON attendance_records;
DROP POLICY IF EXISTS "Attendance delete policy" ON attendance_records;
CREATE POLICY "Attendance delete policy" ON attendance_records FOR DELETE TO authenticated USING ((SELECT has_role('admin')));


-- =====================================================
-- 2. APPLICATIONS (InitPlan & Redundancy)
-- =====================================================
DROP POLICY IF EXISTS "Only admins can view applications" ON applications;
DROP POLICY IF EXISTS "Applications select policy" ON applications;
CREATE POLICY "Applications select policy" ON applications FOR SELECT TO authenticated USING ((SELECT has_role('admin')));


-- =====================================================
-- 3. PROJECT ITEMS (Redundancy)
-- =====================================================
DROP POLICY IF EXISTS "Project managers can delete items" ON project_items;
DROP POLICY IF EXISTS "Project members can update items" ON project_items;


-- =====================================================
-- 4. ASSET ISSUES (Redundancy & InitPlan)
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage asset issues" ON asset_issues;
DROP POLICY IF EXISTS "Admins can view all asset issues" ON asset_issues;
DROP POLICY IF EXISTS "Users can view own asset issues" ON asset_issues;
DROP POLICY IF EXISTS "Users can view their own asset issues" ON asset_issues;
DROP POLICY IF EXISTS "Asset issues select policy" ON asset_issues;
DROP POLICY IF EXISTS "Asset issues insert policy" ON asset_issues;
DROP POLICY IF EXISTS "Asset issues update policy" ON asset_issues;
DROP POLICY IF EXISTS "Asset issues delete policy" ON asset_issues;

CREATE POLICY "Asset issues select policy" ON asset_issues 
FOR SELECT TO authenticated 
USING (
    created_by = (SELECT auth.uid()) OR 
    (SELECT has_role('admin')) OR 
    ((SELECT has_role('lead')) AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = asset_issues.created_by 
        AND profiles.department_id = (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid()))
    ))
);

CREATE POLICY "Asset issues insert policy" ON asset_issues 
FOR INSERT TO authenticated 
WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Asset issues update policy" ON asset_issues 
FOR UPDATE TO authenticated 
USING (
    created_by = (SELECT auth.uid()) OR 
    (SELECT has_role('admin'))
);

CREATE POLICY "Asset issues delete policy" ON asset_issues 
FOR DELETE TO authenticated USING ((SELECT has_role('admin')));


-- =====================================================
-- 5. PROJECT UPDATES (InitPlan)
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view project updates" ON project_updates;
DROP POLICY IF EXISTS "Project updates select policy" ON project_updates;
CREATE POLICY "Project updates select policy" ON project_updates FOR SELECT TO authenticated USING (true);


-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
