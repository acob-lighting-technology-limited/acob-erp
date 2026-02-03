-- Migration: Phase 22 The Final Performance Polish (V2)
-- Description: Consolidates remaining redundant policies in the Leave and Task modules 
-- and finalizes all remaining InitPlan optimizations. Corrects column names for employee_suspensions.

-- =====================================================
-- 1. CONSOLIDATE LEAVE MODULE (Redundancy)
-- =====================================================

-- Table: leave_requests (Consolidate 3 UPDATE policies)
DROP POLICY IF EXISTS "Admins can update all leave requests" ON leave_requests;
DROP POLICY IF EXISTS "Department leads can approve department leave" ON leave_requests;
DROP POLICY IF EXISTS "Users can update own pending leave requests" ON leave_requests;
DROP POLICY IF EXISTS "Leave requests update policy" ON leave_requests;

CREATE POLICY "Leave requests update policy" ON leave_requests 
FOR UPDATE TO authenticated 
USING (
    (SELECT has_role('admin')) OR 
    ((SELECT has_role('lead')) AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = leave_requests.user_id 
        AND profiles.department_id = (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid()))
    )) OR 
    (user_id = (SELECT auth.uid()) AND status = 'pending')
);

-- Table: leave_types (Consolidate 2 SELECT policies)
DROP POLICY IF EXISTS "Leave types select policy" ON leave_types;
DROP POLICY IF EXISTS "Only admins can manage leave types" ON leave_types;
DROP POLICY IF EXISTS "Leave types manage policy" ON leave_types;
DROP POLICY IF EXISTS "Leave types insert policy" ON leave_types;
DROP POLICY IF EXISTS "Leave types update policy" ON leave_types;
DROP POLICY IF EXISTS "Leave types delete policy" ON leave_types;

CREATE POLICY "Leave types select policy" ON leave_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Leave types insert policy" ON leave_types FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "Leave types update policy" ON leave_types FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Leave types delete policy" ON leave_types FOR DELETE TO authenticated USING ((SELECT has_role('admin')));


-- =====================================================
-- 2. CONSOLIDATE TASK MODULE (Redundancy & InitPlan)
-- =====================================================

-- Table: tasks
DROP POLICY IF EXISTS "Admins can manage tasks" ON tasks;
DROP POLICY IF EXISTS "Only admins can manage tasks" ON tasks;
DROP POLICY IF EXISTS "Tasks select policy" ON tasks;
DROP POLICY IF EXISTS "Tasks manage policy" ON tasks;
DROP POLICY IF EXISTS "Tasks insert policy" ON tasks;
DROP POLICY IF EXISTS "Tasks update policy" ON tasks;
DROP POLICY IF EXISTS "Tasks delete policy" ON tasks;

CREATE POLICY "Tasks select policy" ON tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tasks insert policy" ON tasks FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')) OR (SELECT has_role('lead')));
CREATE POLICY "Tasks update policy" ON tasks FOR UPDATE TO authenticated USING ((SELECT has_role('admin')) OR (SELECT has_role('lead')));
CREATE POLICY "Tasks delete policy" ON tasks FOR DELETE TO authenticated USING ((SELECT has_role('admin')));

-- Table: task_assignments
DROP POLICY IF EXISTS "Only super_admin/admin can create task assignments" ON task_assignments;
DROP POLICY IF EXISTS "Only super_admin/admin can update task assignments" ON task_assignments;
DROP POLICY IF EXISTS "Only super_admin/admin can delete task assignments" ON task_assignments;
DROP POLICY IF EXISTS "Users can view their own task assignments" ON task_assignments;
DROP POLICY IF EXISTS "Task assignments select policy" ON task_assignments;
DROP POLICY IF EXISTS "Task assignments insert policy" ON task_assignments;
DROP POLICY IF EXISTS "Task assignments update policy" ON task_assignments;
DROP POLICY IF EXISTS "Task assignments delete policy" ON task_assignments;

CREATE POLICY "Task assignments select policy" ON task_assignments 
FOR SELECT TO authenticated 
USING (
    user_id = (SELECT auth.uid()) OR 
    (SELECT has_role('admin')) OR 
    ((SELECT has_role('lead')) AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = task_assignments.user_id 
        AND profiles.department_id = (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid()))
    ))
);

CREATE POLICY "Task assignments insert policy" ON task_assignments FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')) OR (SELECT has_role('lead')));
CREATE POLICY "Task assignments update policy" ON task_assignments FOR UPDATE TO authenticated USING ((SELECT has_role('admin')) OR (SELECT has_role('lead')));
CREATE POLICY "Task assignments delete policy" ON task_assignments FOR DELETE TO authenticated USING ((SELECT has_role('admin')));

-- Table: task_user_completion
DROP POLICY IF EXISTS "Users can mark their own tasks as complete" ON task_user_completion;
DROP POLICY IF EXISTS "Task user completion select policy" ON task_user_completion;
DROP POLICY IF EXISTS "Task user completion insert policy" ON task_user_completion;

CREATE POLICY "Task user completion select policy" ON task_user_completion 
FOR SELECT TO authenticated 
USING (user_id = (SELECT auth.uid()) OR (SELECT has_role('admin')));

CREATE POLICY "Task user completion insert policy" ON task_user_completion 
FOR INSERT TO authenticated 
WITH CHECK (user_id = (SELECT auth.uid()));


-- =====================================================
-- 3. FINAL INITPLAN CLEANUP
-- =====================================================

-- Table: audit_logs
DROP POLICY IF EXISTS "Allow authenticated select" ON audit_logs;
DROP POLICY IF EXISTS "Audit logs select policy" ON audit_logs;
CREATE POLICY "Audit logs select policy" ON audit_logs FOR SELECT TO authenticated USING ((SELECT has_role('admin')));

-- Table: employee_suspensions
DROP POLICY IF EXISTS "Employee suspensions select policy" ON employee_suspensions;
DROP POLICY IF EXISTS "Admins can create suspensions" ON employee_suspensions;
DROP POLICY IF EXISTS "Admins can update suspensions" ON employee_suspensions;
DROP POLICY IF EXISTS "Employee suspensions insert policy" ON employee_suspensions;
DROP POLICY IF EXISTS "Employee suspensions update policy" ON employee_suspensions;

CREATE POLICY "Employee suspensions select policy" ON employee_suspensions 
FOR SELECT TO authenticated 
USING (employee_id = (SELECT auth.uid()) OR (SELECT has_role('admin')));

CREATE POLICY "Employee suspensions insert policy" ON employee_suspensions FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "Employee suspensions update policy" ON employee_suspensions FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));


-- Table: profiles (Remaining InitPlan)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Profiles select policy" ON profiles;
CREATE POLICY "Profiles select policy" ON profiles FOR SELECT TO authenticated USING (true);


-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
