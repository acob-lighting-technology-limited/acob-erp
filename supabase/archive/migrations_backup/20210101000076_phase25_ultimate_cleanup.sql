-- Migration: Phase 25 Ultimate Performance Cleanup
-- Description: Addressing the remaining lints for Customers, Project Items, and Event Notifications.

-- =====================================================
-- 1. CUSTOMERS (Redundancy)
-- =====================================================
DROP POLICY IF EXISTS "Admin full access to customers" ON customers;
DROP POLICY IF EXISTS "Customers insert policy" ON customers;
DROP POLICY IF EXISTS "Customers view policy" ON customers;
DROP POLICY IF EXISTS "Customers update policy" ON customers;
DROP POLICY IF EXISTS "Customers delete policy" ON customers;

CREATE POLICY "Customers select policy" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Customers insert policy" ON customers FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "Customers update policy" ON customers FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Customers delete policy" ON customers FOR DELETE TO authenticated USING ((SELECT has_role('admin')));


-- =====================================================
-- 2. PROJECT ITEMS (InitPlan & Redundancy)
-- =====================================================
DROP POLICY IF EXISTS "Users can view project items" ON project_items;
DROP POLICY IF EXISTS "Project members can add items" ON project_items;
DROP POLICY IF EXISTS "Project managers can update items" ON project_items;
DROP POLICY IF EXISTS "Project items select policy" ON project_items;
DROP POLICY IF EXISTS "Project items insert policy" ON project_items;
DROP POLICY IF EXISTS "Project items update policy" ON project_items;
DROP POLICY IF EXISTS "Project items delete policy" ON project_items;

CREATE POLICY "Project items select policy" ON project_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Project items insert policy" ON project_items 
FOR INSERT TO authenticated 
WITH CHECK (
    (EXISTS (
        SELECT 1 FROM project_members 
        WHERE project_members.project_id = project_items.project_id 
        AND project_members.user_id = (SELECT auth.uid())
    )) OR 
    (SELECT has_role('admin'))
);

CREATE POLICY "Project items update policy" ON project_items 
FOR UPDATE TO authenticated 
USING (
    (EXISTS (
        SELECT 1 FROM project_members 
        WHERE project_members.project_id = project_items.project_id 
        AND project_members.user_id = (SELECT auth.uid())
    )) OR 
    (SELECT has_role('admin'))
);

CREATE POLICY "Project items delete policy" ON project_items 
FOR DELETE TO authenticated 
USING ((SELECT has_role('admin')));


-- =====================================================
-- 3. EVENT NOTIFICATIONS (Redundancy)
-- =====================================================
DROP POLICY IF EXISTS "Admin full access to events" ON event_notifications;
DROP POLICY IF EXISTS "employee read events" ON event_notifications;
DROP POLICY IF EXISTS "employee acknowledge events" ON event_notifications;
DROP POLICY IF EXISTS "Events select policy" ON event_notifications;
DROP POLICY IF EXISTS "Events update policy" ON event_notifications;
DROP POLICY IF EXISTS "Events employee acknowledge" ON event_notifications;
DROP POLICY IF EXISTS "Events insert policy" ON event_notifications;
DROP POLICY IF EXISTS "Events delete policy" ON event_notifications;

CREATE POLICY "Events select policy" ON event_notifications FOR SELECT TO authenticated USING (true);

CREATE POLICY "Events insert policy" ON event_notifications FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));

CREATE POLICY "Events update policy" ON event_notifications 
FOR UPDATE TO authenticated 
USING (
    (SELECT has_role('admin')) OR 
    (SELECT has_role('employee'))
)
WITH CHECK (
    (SELECT has_role('admin')) OR 
    (acknowledged = true AND acknowledged_by = (SELECT auth.uid()))
);

CREATE POLICY "Events delete policy" ON event_notifications FOR DELETE TO authenticated USING ((SELECT has_role('admin')));


-- =====================================================
-- 4. LEAVE BALANCES (Remaining Redundancy)
-- =====================================================
DROP POLICY IF EXISTS "Leave balances select policy" ON leave_balances;
DROP POLICY IF EXISTS "Leave balances insert policy" ON leave_balances;
DROP POLICY IF EXISTS "Leave balances update policy" ON leave_balances;
DROP POLICY IF EXISTS "Leave balances delete policy" ON leave_balances;

CREATE POLICY "Leave balances select policy" ON leave_balances 
FOR SELECT TO authenticated 
USING (
    user_id = (SELECT auth.uid()) OR 
    (SELECT has_role('admin')) OR 
    ((SELECT has_role('lead')) AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = leave_balances.user_id 
        AND profiles.department_id = (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid()))
    ))
);

CREATE POLICY "Leave balances insert policy" ON leave_balances FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "Leave balances update policy" ON leave_balances FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Leave balances delete policy" ON leave_balances FOR DELETE TO authenticated USING ((SELECT has_role('admin')));


-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
