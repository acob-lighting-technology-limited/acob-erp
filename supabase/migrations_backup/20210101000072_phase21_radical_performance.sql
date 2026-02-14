-- Migration: Phase 21 Radical Performance Optimization (V2)
-- Description: Consolidates remaining redundant policies and applies 
-- the InitPlan (SELECT auth.uid()) optimization to ALL remaining public schema policies.

-- =====================================================
-- 1. CONSOLIDATE SYSTEM SETTINGS (Redundancy)
-- =====================================================
DROP POLICY IF EXISTS "Super admins can view system settings" ON system_settings;
DROP POLICY IF EXISTS "Super admins can update system settings" ON system_settings;
DROP POLICY IF EXISTS "System settings select" ON system_settings;
DROP POLICY IF EXISTS "System settings update" ON system_settings;
DROP POLICY IF EXISTS "System settings select policy" ON system_settings;
DROP POLICY IF EXISTS "System settings update policy" ON system_settings;

CREATE POLICY "System settings select policy" ON system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "System settings update policy" ON system_settings FOR UPDATE TO authenticated USING ((SELECT has_role('admin')) OR (SELECT has_role('super_admin')));


-- =====================================================
-- 2. CONSOLIDATE OVERTIME REQUESTS (Redundancy)
-- =====================================================
DROP POLICY IF EXISTS "Only admins can view overtime requests" ON overtime_requests;
DROP POLICY IF EXISTS "Overtime requests select policy" ON overtime_requests;
DROP POLICY IF EXISTS "Only admins can manage overtime requests" ON overtime_requests;
DROP POLICY IF EXISTS "Overtime requests manage policy" ON overtime_requests;

CREATE POLICY "Overtime requests select policy" ON overtime_requests 
FOR SELECT TO authenticated 
USING (
    user_id = (SELECT auth.uid()) OR 
    (SELECT has_role('admin')) OR 
    ((SELECT has_role('lead')) AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = overtime_requests.user_id 
        AND profiles.department_id = (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid()))
    ))
);

CREATE POLICY "Overtime requests insert policy" ON overtime_requests FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "Overtime requests update policy" ON overtime_requests FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Overtime requests delete policy" ON overtime_requests FOR DELETE TO authenticated USING ((SELECT has_role('admin')));


-- =====================================================
-- 3. CONSOLIDATE PENDING USERS (Redundancy)
-- =====================================================
DROP POLICY IF EXISTS "Admins can view pending users" ON pending_users;
DROP POLICY IF EXISTS "Admins can update pending users" ON pending_users;
DROP POLICY IF EXISTS "Admins can delete pending users" ON pending_users;
DROP POLICY IF EXISTS "Pending users insert policy" ON pending_users;
DROP POLICY IF EXISTS "Pending users select policy" ON pending_users;
DROP POLICY IF EXISTS "Pending users manage policy" ON pending_users;
DROP POLICY IF EXISTS "Pending users update policy" ON pending_users;
DROP POLICY IF EXISTS "Pending users delete policy" ON pending_users;

CREATE POLICY "Pending users select policy" ON pending_users FOR SELECT TO authenticated USING ((SELECT has_role('admin')) OR (SELECT has_role('super_admin')));
CREATE POLICY "Pending users insert policy" ON pending_users FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Pending users update policy" ON pending_users FOR UPDATE TO authenticated USING ((SELECT has_role('admin')) OR (SELECT has_role('super_admin')));
CREATE POLICY "Pending users delete policy" ON pending_users FOR DELETE TO authenticated USING ((SELECT has_role('admin')) OR (SELECT has_role('super_admin')));


-- =====================================================
-- 4. INITPLAN OPTIMIZATION (Wrap all auth calls)
-- =====================================================

-- Table: admin_logs
DROP POLICY IF EXISTS "Admins can insert admin logs" ON admin_logs;
DROP POLICY IF EXISTS "Admin logs insert policy" ON admin_logs;
CREATE POLICY "Admin logs insert policy" ON admin_logs FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));

-- Table: starlink_payments
DROP POLICY IF EXISTS "Starlink payments select policy" ON starlink_payments;
DROP POLICY IF EXISTS "Starlink payments admin insert" ON starlink_payments;
DROP POLICY IF EXISTS "Starlink payments admin update" ON starlink_payments;
DROP POLICY IF EXISTS "Starlink payments admin delete" ON starlink_payments;
DROP POLICY IF EXISTS "Starlink payments manage policy" ON starlink_payments;
DROP POLICY IF EXISTS "Starlink payments insert policy" ON starlink_payments;
DROP POLICY IF EXISTS "Starlink payments update policy" ON starlink_payments;
DROP POLICY IF EXISTS "Starlink payments delete policy" ON starlink_payments;

CREATE POLICY "Starlink payments select policy" ON starlink_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Starlink payments insert policy" ON starlink_payments FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "Starlink payments update policy" ON starlink_payments FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Starlink payments delete policy" ON starlink_payments FOR DELETE TO authenticated USING ((SELECT has_role('admin')));

-- Table: task_updates
DROP POLICY IF EXISTS "Authenticated users can create task updates" ON task_updates;
DROP POLICY IF EXISTS "Admins can view all task updates" ON task_updates;
DROP POLICY IF EXISTS "Manager see team task updates" ON task_updates;
DROP POLICY IF EXISTS "Users see own task updates" ON task_updates;
DROP POLICY IF EXISTS "Task updates select policy" ON task_updates;
DROP POLICY IF EXISTS "Task updates insert policy" ON task_updates;

CREATE POLICY "Task updates select policy" ON task_updates 
FOR SELECT TO authenticated 
USING (
    user_id = (SELECT auth.uid()) OR 
    (SELECT has_role('admin')) OR 
    ((SELECT has_role('lead')) AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = task_updates.user_id 
        AND profiles.department_id = (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid()))
    ))
);

CREATE POLICY "Task updates insert policy" ON task_updates 
FOR INSERT TO authenticated 
WITH CHECK (user_id = (SELECT auth.uid()));

-- Table: task_user_completion
DROP POLICY IF EXISTS "Task user completion select policy" ON task_user_completion;
CREATE POLICY "Task user completion select policy" ON task_user_completion 
FOR SELECT TO authenticated 
USING (user_id = (SELECT auth.uid()) OR (SELECT has_role('admin')));

-- Table: notification_preferences
DROP POLICY IF EXISTS "Notification preferences select" ON notification_preferences;
DROP POLICY IF EXISTS "Notification preferences select policy" ON notification_preferences;
CREATE POLICY "Notification preferences select policy" ON notification_preferences 
FOR SELECT TO authenticated 
USING (user_id = (SELECT auth.uid()));

-- Table: firmware_tasks
DROP POLICY IF EXISTS "Admins manage firmware tasks" ON firmware_tasks;
DROP POLICY IF EXISTS "Firmware tasks select policy" ON firmware_tasks;
DROP POLICY IF EXISTS "Firmware tasks insert policy" ON firmware_tasks;
DROP POLICY IF EXISTS "Firmware tasks update policy" ON firmware_tasks;
DROP POLICY IF EXISTS "Firmware tasks delete policy" ON firmware_tasks;

CREATE POLICY "Firmware tasks select policy" ON firmware_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Firmware tasks insert policy" ON firmware_tasks FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "Firmware tasks update policy" ON firmware_tasks FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Firmware tasks delete policy" ON firmware_tasks FOR DELETE TO authenticated USING ((SELECT has_role('admin')));

-- Table: firmware_updates
DROP POLICY IF EXISTS "Admins manage firmware updates" ON firmware_updates;
DROP POLICY IF EXISTS "Firmware updates select policy" ON firmware_updates;
DROP POLICY IF EXISTS "Firmware updates insert policy" ON firmware_updates;
DROP POLICY IF EXISTS "Firmware updates update policy" ON firmware_updates;
DROP POLICY IF EXISTS "Firmware updates delete policy" ON firmware_updates;

CREATE POLICY "Firmware updates select policy" ON firmware_updates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Firmware updates insert policy" ON firmware_updates FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "Firmware updates update policy" ON firmware_updates FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Firmware updates delete policy" ON firmware_updates FOR DELETE TO authenticated USING ((SELECT has_role('admin')));

-- Table: remote_tasks
DROP POLICY IF EXISTS "Remote tasks select policy" ON remote_tasks;
DROP POLICY IF EXISTS "Remote tasks manage policy" ON remote_tasks;
DROP POLICY IF EXISTS "Remote tasks insert policy" ON remote_tasks;
DROP POLICY IF EXISTS "Remote tasks update policy" ON remote_tasks;
DROP POLICY IF EXISTS "Remote tasks delete policy" ON remote_tasks;
DROP POLICY IF EXISTS "Remote tasks admin insert" ON remote_tasks;
DROP POLICY IF EXISTS "Remote tasks admin update" ON remote_tasks;
DROP POLICY IF EXISTS "Remote tasks admin delete" ON remote_tasks;

CREATE POLICY "Remote tasks select policy" ON remote_tasks FOR SELECT TO authenticated USING ((SELECT has_role('employee')) OR (SELECT has_role('admin')));
CREATE POLICY "Remote tasks insert policy" ON remote_tasks FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "Remote tasks update policy" ON remote_tasks FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Remote tasks delete policy" ON remote_tasks FOR DELETE TO authenticated USING ((SELECT has_role('admin')));

-- Table: meter_readings
DROP POLICY IF EXISTS "Admin full access to meter_readings" ON meter_readings;
DROP POLICY IF EXISTS "employee read meter_readings" ON meter_readings;
DROP POLICY IF EXISTS "Meter readings select policy" ON meter_readings;
DROP POLICY IF EXISTS "Meter readings insert policy" ON meter_readings;
DROP POLICY IF EXISTS "Meter readings update policy" ON meter_readings;
DROP POLICY IF EXISTS "Meter readings delete policy" ON meter_readings;

CREATE POLICY "Meter readings select policy" ON meter_readings FOR SELECT TO authenticated USING ((SELECT has_role('employee')) OR (SELECT has_role('admin')));
CREATE POLICY "Meter readings insert policy" ON meter_readings FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "Meter readings update policy" ON meter_readings FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Meter readings delete policy" ON meter_readings FOR DELETE TO authenticated USING ((SELECT has_role('admin')));

-- Table: gprs_status
DROP POLICY IF EXISTS "Admin full access to gprs_status" ON gprs_status;
DROP POLICY IF EXISTS "employee read gprs_status" ON gprs_status;
DROP POLICY IF EXISTS "GPRS status select policy" ON gprs_status;
DROP POLICY IF EXISTS "GPRS status insert policy" ON gprs_status;
DROP POLICY IF EXISTS "GPRS status update policy" ON gprs_status;
DROP POLICY IF EXISTS "GPRS status delete policy" ON gprs_status;

CREATE POLICY "GPRS status select policy" ON gprs_status FOR SELECT TO authenticated USING ((SELECT has_role('employee')) OR (SELECT has_role('admin')));
CREATE POLICY "GPRS status insert policy" ON gprs_status FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "GPRS status update policy" ON gprs_status FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "GPRS status delete policy" ON gprs_status FOR DELETE TO authenticated USING ((SELECT has_role('admin')));

-- Table: event_notifications
DROP POLICY IF EXISTS "Admin full access to events" ON event_notifications;
DROP POLICY IF EXISTS "employee read events" ON event_notifications;
DROP POLICY IF EXISTS "employee acknowledge events" ON event_notifications;
DROP POLICY IF EXISTS "Events select policy" ON event_notifications;
DROP POLICY IF EXISTS "Events insert policy" ON event_notifications;
DROP POLICY IF EXISTS "Events update policy" ON event_notifications;
DROP POLICY IF EXISTS "Events delete policy" ON event_notifications;
DROP POLICY IF EXISTS "Events employee acknowledge" ON event_notifications;

CREATE POLICY "Events select policy" ON event_notifications FOR SELECT TO authenticated USING ((SELECT has_role('employee')) OR (SELECT has_role('admin')));
CREATE POLICY "Events insert policy" ON event_notifications FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "Events update policy" ON event_notifications FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Events delete policy" ON event_notifications FOR DELETE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Events employee acknowledge" ON event_notifications FOR UPDATE TO authenticated USING ((SELECT has_role('employee'))) WITH CHECK (acknowledged = true AND acknowledged_by = (SELECT auth.uid()));

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
