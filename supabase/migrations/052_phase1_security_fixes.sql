-- Migration: Phase 1 Security Fixes
-- Description: Addresses the most critical security issues reported by the Security Advisor

-- =====================================================
-- 1. HARDEN PERMISSIVE "ALWAYS TRUE" POLICIES
-- =====================================================

-- Table: public.meters
-- Restrict "Emergency" policies to authenticated admins instead of 'true'
DROP POLICY IF EXISTS "Emergency Insert Meters" ON meters;
CREATE POLICY "Emergency Insert Meters" ON meters 
FOR INSERT TO authenticated 
WITH CHECK (has_role('admin'));

DROP POLICY IF EXISTS "Emergency Update Meters" ON meters;
CREATE POLICY "Emergency Update Meters" ON meters 
FOR UPDATE TO authenticated 
USING (has_role('admin'));

-- Table: public.pending_users
-- Restrict public insert and view access
DROP POLICY IF EXISTS "Anyone can create pending user" ON pending_users;
DROP POLICY IF EXISTS "Anyone can insert pending users" ON pending_users;
CREATE POLICY "Authenticated users can create pending user" ON pending_users 
FOR INSERT TO authenticated 
WITH CHECK (true); -- Allow any authenticated user to sign up, but restricted to auth

DROP POLICY IF EXISTS "Anyone can view pending users" ON pending_users;
CREATE POLICY "Admins can view pending users" ON pending_users 
FOR SELECT TO authenticated 
USING (has_role('admin') OR has_role('super_admin'));

-- Table: public.task_updates
-- Restrict creation to authenticated users
DROP POLICY IF EXISTS "Users can create task updates" ON task_updates;
CREATE POLICY "Authenticated users can create task updates" ON task_updates 
FOR INSERT TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM tasks
        WHERE tasks.id = task_updates.task_id
        AND (tasks.assigned_to = auth.uid() OR tasks.assigned_by = auth.uid())
    ) OR has_role('admin') OR has_role('super_admin') OR has_role('lead')
);

-- =====================================================
-- 2. ADD POLICIES FOR TABLES WITH RLS BUT NO POLICIES
-- =====================================================

-- Table: public.consumption_data
CREATE POLICY "Staff can view consumption data" ON consumption_data 
FOR SELECT TO authenticated 
USING (has_role('staff') OR has_role('visitor'));

CREATE POLICY "Admins can manage consumption data" ON consumption_data 
FOR ALL TO authenticated 
USING (has_role('admin'))
WITH CHECK (has_role('admin'));

-- Table: public.remote_tasks
CREATE POLICY "Staff can view remote tasks" ON remote_tasks 
FOR SELECT TO authenticated 
USING (has_role('staff'));

CREATE POLICY "Admins can manage remote tasks" ON remote_tasks 
FOR ALL TO authenticated 
USING (has_role('admin'))
WITH CHECK (has_role('admin'));

-- Table: public.user_roles
CREATE POLICY "Users can view their own roles" ON user_roles 
FOR SELECT TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all user roles" ON user_roles 
FOR ALL TO authenticated 
USING (has_role('admin') OR has_role('super_admin'))
WITH CHECK (has_role('admin') OR has_role('super_admin'));

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
