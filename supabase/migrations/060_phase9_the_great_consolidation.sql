-- Migration: Phase 9 Massive Consolidation and Optimization (RE-RUN)
-- Description: Aggressively drops all redundant policies revealed by pg_policies check and replaces with single consolidated ones.

-- =====================================================
-- 1. CONSOLIDATION: ELIMINATE ALL MULTIPLE PERMISSIVE POLICIES
-- =====================================================

-- Table: feedback
DROP POLICY IF EXISTS "Admins can view all feedback" ON feedback;
DROP POLICY IF EXISTS "Users can view own feedback" ON feedback;
DROP POLICY IF EXISTS "Users can view their own feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can view feedback" ON feedback;
DROP POLICY IF EXISTS "Feedback view policy" ON feedback;
CREATE POLICY "Feedback view policy" ON feedback 
FOR SELECT TO authenticated 
USING (user_id = (SELECT auth.uid()) OR has_role('admin'));

DROP POLICY IF EXISTS "Admins can delete all feedback" ON feedback;
DROP POLICY IF EXISTS "Users can delete their own feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can delete feedback" ON feedback;
DROP POLICY IF EXISTS "Feedback delete policy" ON feedback;
CREATE POLICY "Feedback delete policy" ON feedback 
FOR DELETE TO authenticated 
USING (user_id = (SELECT auth.uid()) OR has_role('admin'));

DROP POLICY IF EXISTS "Admins can update all feedback" ON feedback;
DROP POLICY IF EXISTS "Users can update their own feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can update feedback" ON feedback;
DROP POLICY IF EXISTS "Feedback update policy" ON feedback;
CREATE POLICY "Feedback update policy" ON feedback 
FOR UPDATE TO authenticated 
USING (user_id = (SELECT auth.uid()) OR has_role('admin'));

DROP POLICY IF EXISTS "Admins can insert feedback" ON feedback;
DROP POLICY IF EXISTS "Users can insert feedback" ON feedback;
DROP POLICY IF EXISTS "Users can insert their own feedback" ON feedback;
CREATE POLICY "Feedback insert policy" ON feedback 
FOR INSERT TO authenticated 
WITH CHECK (user_id = (SELECT auth.uid()) OR has_role('admin'));

-- Table: performance_reviews
DROP POLICY IF EXISTS "Admins can view all reviews" ON performance_reviews;
DROP POLICY IF EXISTS "Reviewers can view own reviews" ON performance_reviews;
DROP POLICY IF EXISTS "Users can view their own reviews" ON performance_reviews;
DROP POLICY IF EXISTS "Users can view own reviews" ON performance_reviews;
DROP POLICY IF EXISTS "Performance reviews view policy" ON performance_reviews;
CREATE POLICY "Performance reviews view policy" ON performance_reviews 
FOR SELECT TO authenticated 
USING (
    user_id = (SELECT auth.uid()) OR 
    reviewer_id = (SELECT auth.uid()) OR 
    has_role('admin')
);

-- Table: starlink_sites
DROP POLICY IF EXISTS "Admins can manage starlink sites" ON starlink_sites;
DROP POLICY IF EXISTS "Authenticated users can view starlink sites" ON starlink_sites;
DROP POLICY IF EXISTS "Only super admins can delete starlink sites" ON starlink_sites;
DROP POLICY IF EXISTS "Super admins and admins can insert starlink sites" ON starlink_sites;
DROP POLICY IF EXISTS "Super admins and admins can update starlink sites" ON starlink_sites;
DROP POLICY IF EXISTS "Super admins and admins can view starlink sites" ON starlink_sites;
DROP POLICY IF EXISTS "Starlink sites management" ON starlink_sites;
CREATE POLICY "Starlink sites management" ON starlink_sites 
FOR ALL TO authenticated 
USING (has_role('admin') OR has_role('staff'));

-- Table: starlink_documents
DROP POLICY IF EXISTS "Admins can manage starlink documents" ON starlink_documents;
DROP POLICY IF EXISTS "Authenticated users can view starlink documents" ON starlink_documents;
DROP POLICY IF EXISTS "Starlink documents management" ON starlink_documents;
CREATE POLICY "Starlink documents management" ON starlink_documents 
FOR ALL TO authenticated 
USING (has_role('admin') OR has_role('staff'));

-- Table: projects
DROP POLICY IF EXISTS "Admins can manage projects" ON projects;
DROP POLICY IF EXISTS "Project managers can manage projects" ON projects;
DROP POLICY IF EXISTS "Project members can view projects" ON projects;
DROP POLICY IF EXISTS "Users can view their projects" ON projects;
DROP POLICY IF EXISTS "Leads/admin/super_admin can create projects" ON projects;
DROP POLICY IF EXISTS "Only admin can delete projects" ON projects;
DROP POLICY IF EXISTS "Project stakeholders can update projects" ON projects;
DROP POLICY IF EXISTS "Projects management policy" ON projects;
CREATE POLICY "Projects management policy" ON projects 
FOR ALL TO authenticated 
USING (
    has_role('admin') OR 
    project_manager_id = (SELECT auth.uid()) OR 
    EXISTS (SELECT 1 FROM project_members WHERE project_id = projects.id AND user_id = (SELECT auth.uid()))
);

-- Table: profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Profiles view policy" ON profiles;
CREATE POLICY "Profiles view policy" ON profiles 
FOR SELECT TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Profiles insert policy" ON profiles 
FOR INSERT TO authenticated 
WITH CHECK (has_role('admin'));

-- Table: leave_requests
DROP POLICY IF EXISTS "Users can view own leave requests" ON leave_requests;
DROP POLICY IF EXISTS "Admins can view all leave requests" ON leave_requests;
DROP POLICY IF EXISTS "Leads can view own department leave requests" ON leave_requests;
DROP POLICY IF EXISTS "Department leads can view department leave requests" ON leave_requests;
DROP POLICY IF EXISTS "Leave requests select policy" ON leave_requests;
CREATE POLICY "Leave requests select policy" ON leave_requests 
FOR SELECT TO authenticated 
USING (
    user_id = (SELECT auth.uid()) OR 
    has_role('admin') OR 
    (has_role('lead') AND EXISTS (
        SELECT 1 FROM profiles p1
        WHERE p1.id = leave_requests.user_id 
        AND p1.department = (SELECT department FROM profiles WHERE id = (SELECT auth.uid()) LIMIT 1)
    ))
);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
