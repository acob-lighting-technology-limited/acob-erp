-- Migration: Phase 13 Final Polish
-- Description: Final performance cleanup of redundant policies and initplan optimizations across remaining tables.

-- =====================================================
-- 1. CONSOLIDATION: REDUNDANT SELECT POLICIES
-- =====================================================

-- Table: payment_categories
DROP POLICY IF EXISTS "Anyone can view categories" ON payment_categories;
DROP POLICY IF EXISTS "Anyone can view payment categories" ON payment_categories;
DROP POLICY IF EXISTS "Categories view policy" ON payment_categories;
CREATE POLICY "Categories view policy" ON payment_categories FOR SELECT TO authenticated USING (true);

-- Table: review_cycles
DROP POLICY IF EXISTS "All authenticated users can view review cycles" ON review_cycles;
DROP POLICY IF EXISTS "All users can view review cycles" ON review_cycles;
DROP POLICY IF EXISTS "Only admins can manage review cycles" ON review_cycles;

CREATE POLICY "Review cycles select policy" ON review_cycles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Review cycles admin insert" ON review_cycles FOR INSERT TO authenticated WITH CHECK (has_role('admin'));
CREATE POLICY "Review cycles admin update" ON review_cycles FOR UPDATE TO authenticated USING (has_role('admin'));
CREATE POLICY "Review cycles admin delete" ON review_cycles FOR DELETE TO authenticated USING (has_role('admin'));

-- Table: salary_components
DROP POLICY IF EXISTS "All authenticated users can view salary components" ON salary_components;
DROP POLICY IF EXISTS "Only admins can manage salary components" ON salary_components;

CREATE POLICY "Salary components select policy" ON salary_components FOR SELECT TO authenticated USING (true);
CREATE POLICY "Salary components admin insert" ON salary_components FOR INSERT TO authenticated WITH CHECK (has_role('admin'));
CREATE POLICY "Salary components admin update" ON salary_components FOR UPDATE TO authenticated USING (has_role('admin'));
CREATE POLICY "Salary components admin delete" ON salary_components FOR DELETE TO authenticated USING (has_role('admin'));

-- Table: remote_tasks
DROP POLICY IF EXISTS "Admins can manage remote tasks" ON remote_tasks;
DROP POLICY IF EXISTS "Staff can view remote tasks" ON remote_tasks;

CREATE POLICY "Remote tasks select policy" ON remote_tasks FOR SELECT TO authenticated USING (has_role('staff') OR has_role('admin'));
CREATE POLICY "Remote tasks admin insert" ON remote_tasks FOR INSERT TO authenticated WITH CHECK (has_role('admin'));
CREATE POLICY "Remote tasks admin update" ON remote_tasks FOR UPDATE TO authenticated USING (has_role('admin'));
CREATE POLICY "Remote tasks admin delete" ON remote_tasks FOR DELETE TO authenticated USING (has_role('admin'));

-- =====================================================
-- 2. PERFORMANCE: FIX auth_rls_initplan (Subqueries)
-- =====================================================

-- Table: task_updates
DROP POLICY IF EXISTS "Users can view task updates for their tasks" ON task_updates;
CREATE POLICY "Task updates select policy" ON task_updates 
FOR SELECT TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM tasks 
        WHERE tasks.id = task_updates.task_id 
        AND (tasks.assigned_to = (SELECT auth.uid()) OR tasks.assigned_by = (SELECT auth.uid()) OR has_role('admin'))
    )
);

-- Table: user_documentation
DROP POLICY IF EXISTS "Users can create their own documentation" ON user_documentation;
DROP POLICY IF EXISTS "Users can delete their own documentation" ON user_documentation;
DROP POLICY IF EXISTS "Users can update their own documentation" ON user_documentation;
DROP POLICY IF EXISTS "Users can view their own documentation" ON user_documentation;

CREATE POLICY "User documentation select policy" ON user_documentation FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "User documentation insert policy" ON user_documentation FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "User documentation update policy" ON user_documentation FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "User documentation delete policy" ON user_documentation FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
