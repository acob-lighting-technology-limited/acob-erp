-- Migration: Phase 31 Audit Major Fixes (V2)
-- Description: Addressing major and critical security/logic issues identified by audit.
-- Correcting syntax for command-specific policies.

-- =====================================================
-- 1. USER ROLES (Super-Admin protection)
-- =====================================================
-- Restrict admin access to only non-admin/non-super_admin roles
DROP POLICY IF EXISTS "User roles admin write" ON user_roles;
DROP POLICY IF EXISTS "User roles admin insert" ON user_roles;
DROP POLICY IF EXISTS "User roles admin update" ON user_roles;
DROP POLICY IF EXISTS "User roles admin delete" ON user_roles;

CREATE POLICY "User roles admin insert" ON user_roles 
FOR INSERT TO authenticated 
WITH CHECK (
    (SELECT has_role('super_admin')) OR 
    ((SELECT has_role('admin')) AND role NOT IN ('admin', 'super_admin'))
);

CREATE POLICY "User roles admin update" ON user_roles 
FOR UPDATE TO authenticated 
USING (
    (SELECT has_role('super_admin')) OR 
    ((SELECT has_role('admin')) AND NOT EXISTS (
        SELECT 1 FROM user_roles ur2 
        WHERE ur2.id = user_roles.id 
        AND ur2.role IN ('admin', 'super_admin')
    ))
)
WITH CHECK (
    (SELECT has_role('super_admin')) OR 
    ((SELECT has_role('admin')) AND role NOT IN ('admin', 'super_admin'))
);

CREATE POLICY "User roles admin delete" ON user_roles 
FOR DELETE TO authenticated 
USING (
    (SELECT has_role('super_admin')) OR 
    ((SELECT has_role('admin')) AND NOT EXISTS (
        SELECT 1 FROM user_roles ur2 
        WHERE ur2.id = user_roles.id 
        AND ur2.role IN ('admin', 'super_admin')
    ))
);


-- =====================================================
-- 2. NOTIFICATIONS & AUDIT LOGS (Harden Insert)
-- =====================================================
DROP POLICY IF EXISTS "System and Staff can create notifications" ON notifications;
CREATE POLICY "Staff can create notifications" ON notifications 
FOR INSERT TO authenticated 
WITH CHECK ((SELECT has_role('staff')) OR (SELECT has_role('admin')));

DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
CREATE POLICY "Admins can insert audit logs" ON audit_logs 
FOR INSERT TO authenticated 
WITH CHECK ((SELECT has_role('admin')));


-- =====================================================
-- 3. PENDING USERS (Harden Insert)
-- =====================================================
DROP POLICY IF EXISTS "Pending users insert policy" ON pending_users;
CREATE POLICY "Pending users insert policy" ON pending_users 
FOR INSERT TO authenticated 
WITH CHECK ((SELECT has_role('admin')) OR (SELECT has_role('super_admin')));


-- =====================================================
-- 4. STARLINK PAYMENTS (Restrict Select)
-- =====================================================
DROP POLICY IF EXISTS "Starlink payments select policy" ON starlink_payments;
CREATE POLICY "Starlink payments select policy" ON starlink_payments 
FOR SELECT TO authenticated 
USING ((SELECT has_role('admin')) OR (SELECT has_role('super_admin')));


-- =====================================================
-- 5. EVENT NOTIFICATIONS (Refine Staff Acknowledge)
-- =====================================================
DROP POLICY IF EXISTS "Events staff acknowledge" ON event_notifications;
CREATE POLICY "Events staff acknowledge" ON event_notifications 
FOR UPDATE TO authenticated 
USING (
    (SELECT has_role('staff')) AND 
    acknowledged = false
) 
WITH CHECK (
    acknowledged = true AND 
    acknowledged_by = (SELECT auth.uid())
);


-- =====================================================
-- 6. TASK ASSIGNMENTS (Lead Scoping for Write)
-- =====================================================
DROP POLICY IF EXISTS "Task assignments insert policy" ON task_assignments;
CREATE POLICY "Task assignments insert policy" ON task_assignments 
FOR INSERT TO authenticated 
WITH CHECK (
    (SELECT has_role('admin')) OR 
    ((SELECT has_role('lead')) AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = task_assignments.user_id 
        AND profiles.department_id = (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid()))
    ))
);

DROP POLICY IF EXISTS "Task assignments update policy" ON task_assignments;
CREATE POLICY "Task assignments update policy" ON task_assignments 
FOR UPDATE TO authenticated 
USING (
    (SELECT has_role('admin')) OR 
    ((SELECT has_role('lead')) AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = task_assignments.user_id 
        AND profiles.department_id = (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid()))
    ))
);


-- =====================================================
-- 7. TASK USER COMPLETION (Validate Assignment)
-- =====================================================
DROP POLICY IF EXISTS "Task user completion insert policy" ON task_user_completion;
CREATE POLICY "Task user completion insert policy" ON task_user_completion 
FOR INSERT TO authenticated 
WITH CHECK (
    user_id = (SELECT auth.uid()) AND 
    EXISTS (
        SELECT 1 FROM task_assignments 
        WHERE task_assignments.task_id = task_user_completion.task_id 
        AND task_assignments.user_id = (SELECT auth.uid())
    )
);


-- =====================================================
-- 8. TARIFFS (Restore Admin Write)
-- =====================================================
DROP POLICY IF EXISTS "Tariffs admin manage" ON tariffs;
CREATE POLICY "Tariffs admin manage" ON tariffs 
FOR ALL TO authenticated 
USING ((SELECT has_role('admin')) OR (SELECT has_role('super_admin')))
WITH CHECK ((SELECT has_role('admin')) OR (SELECT has_role('super_admin')));


-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
