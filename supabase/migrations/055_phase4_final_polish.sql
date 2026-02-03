-- Migration: Phase 4 Final Polishing
-- Description: Final performance and security fixes to address remaining advisor issues

-- 1. Final missing indexes on foreign keys
CREATE INDEX IF NOT EXISTS idx_employee_suspensions_suspended_by ON employee_suspensions(suspended_by);
CREATE INDEX IF NOT EXISTS idx_event_notifications_acknowledged_by ON event_notifications(acknowledged_by);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_task_updates_task_id_fk ON task_updates(task_id);

-- 2. Hardening more permissive policies
-- audit_logs: Only allow insert if authenticated
DROP POLICY IF EXISTS "Allow public insert for sync" ON audit_logs;
CREATE POLICY "Authenticated users can insert audit logs" ON audit_logs 
FOR INSERT TO authenticated 
WITH CHECK (true);

-- crm_activities: Only allow insert if authenticated and has role
DROP POLICY IF EXISTS "Authenticated users can create activities" ON crm_activities;
CREATE POLICY "Staff can create crm activities" ON crm_activities 
FOR INSERT TO authenticated 
WITH CHECK (has_role('staff') OR has_role('admin'));

-- 3. Consolidating multiple permissive policies to improve query performance
-- token_records
DROP POLICY IF EXISTS "Admins manage all token records" ON token_records;
DROP POLICY IF EXISTS "Staff read token records" ON token_records;
DROP POLICY IF EXISTS "Staff create token records" ON token_records;
CREATE POLICY "Token records management" ON token_records 
FOR ALL TO authenticated 
USING (has_role('admin') OR has_role('staff'))
WITH CHECK (has_role('admin') OR has_role('staff'));

-- user_roles
DROP POLICY IF EXISTS "Admins can manage all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "User roles management" ON user_roles;

CREATE POLICY "User roles select (self or admin)" ON user_roles 
FOR SELECT TO authenticated 
USING (user_id = auth.uid() OR has_role('admin') OR has_role('super_admin'));

CREATE POLICY "User roles admin write" ON user_roles 
FOR INSERT, UPDATE, DELETE TO authenticated 
USING (has_role('admin') OR has_role('super_admin'))
WITH CHECK (has_role('admin') OR has_role('super_admin'));

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
