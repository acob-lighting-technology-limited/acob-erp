-- Migration: Phase 14 The Universal Consolidator
-- Description: The ultimate cleanup pass for any remaining RLS redundancy and performance issues.

-- =====================================================
-- 1. CONSOLIDATION & OPTIMIZATION
-- =====================================================

-- Table: notification_preferences
DROP POLICY IF EXISTS "Users can view their own preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can insert their own preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON notification_preferences;

CREATE POLICY "Notification preferences select" ON notification_preferences FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Notification preferences insert" ON notification_preferences FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Notification preferences update" ON notification_preferences FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()));

-- Table: performance_ratings
DROP POLICY IF EXISTS "All users can view ratings" ON performance_ratings;
DROP POLICY IF EXISTS "Only admins can manage ratings" ON performance_ratings;

CREATE POLICY "Performance ratings select" ON performance_ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Performance ratings admin insert" ON performance_ratings FOR INSERT TO authenticated WITH CHECK (has_role('admin'));
CREATE POLICY "Performance ratings admin update" ON performance_ratings FOR UPDATE TO authenticated USING (has_role('admin'));
CREATE POLICY "Performance ratings admin delete" ON performance_ratings FOR DELETE TO authenticated USING (has_role('admin'));

-- Table: performance_reviews
DROP POLICY IF EXISTS "Performance reviews view policy" ON performance_reviews;
DROP POLICY IF EXISTS "Department leads can view department reviews" ON performance_reviews;
DROP POLICY IF EXISTS "Leads and admins can create reviews" ON performance_reviews;
DROP POLICY IF EXISTS "Reviewers can update own reviews" ON performance_reviews;
DROP POLICY IF EXISTS "Admins can delete reviews" ON performance_reviews;

CREATE POLICY "Performance reviews select" ON performance_reviews 
FOR SELECT TO authenticated 
USING (
    user_id = (SELECT auth.uid()) OR 
    reviewer_id = (SELECT auth.uid()) OR 
    has_role('admin') OR 
    (has_role('lead') AND user_id IN (SELECT id FROM profiles WHERE department_id = (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid()))))
);

CREATE POLICY "Performance reviews insert" ON performance_reviews FOR INSERT TO authenticated WITH CHECK (has_role('lead') OR has_role('admin'));
CREATE POLICY "Performance reviews update" ON performance_reviews FOR UPDATE TO authenticated USING (reviewer_id = (SELECT auth.uid()) OR has_role('admin'));
CREATE POLICY "Performance reviews delete" ON performance_reviews FOR DELETE TO authenticated USING (has_role('admin'));

-- Table: profiles
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Profiles update policy" ON profiles;

CREATE POLICY "Profiles update policy" ON profiles 
FOR UPDATE TO authenticated 
USING (has_role('admin') OR id = (SELECT auth.uid()))
WITH CHECK (has_role('admin') OR id = (SELECT auth.uid()));

-- Table: task_assignments
DROP POLICY IF EXISTS "Task assignments select policy" ON task_assignments;
CREATE POLICY "Task assignments select policy" ON task_assignments 
FOR SELECT TO authenticated 
USING (
    user_id = (SELECT auth.uid()) OR 
    has_role('admin') OR 
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_assignments.task_id AND tasks.assigned_by = (SELECT auth.uid()))
);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
