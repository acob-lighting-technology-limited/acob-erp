-- Migration: Phase 8 Final Polish & Optimization
-- Description: Fixes auth_rls_initplan optimizations and hardens remaining permissive policies.

-- =====================================================
-- 1. PERFORMANCE: FIX auth_rls_initplan (Select subqueries)
-- =====================================================

-- Table: office_locations
DROP POLICY IF EXISTS "Only super_admin and admin can insert office locations" ON office_locations;
CREATE POLICY "Only super_admin and admin can insert office locations" ON office_locations 
FOR INSERT TO authenticated 
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('super_admin', 'admin')));

DROP POLICY IF EXISTS "Only super_admin and admin can update office locations" ON office_locations;
CREATE POLICY "Only super_admin and admin can update office locations" ON office_locations 
FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('super_admin', 'admin')));

-- Table: starlink_payments
DROP POLICY IF EXISTS "Admins can manage starlink payments" ON starlink_payments;
CREATE POLICY "Admins can manage starlink payments" ON starlink_payments 
FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role IN ('super_admin', 'admin')));

-- Table: notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications 
FOR SELECT TO authenticated 
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications 
FOR UPDATE TO authenticated 
USING ((SELECT auth.uid()) = user_id);

-- =====================================================
-- 2. SECURITY: HARDEN REMAINING PERMISSIVE POLICIES
-- =====================================================

-- Table: audit_logs
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
CREATE POLICY "System can insert audit logs" ON audit_logs 
FOR INSERT TO authenticated 
WITH CHECK (true); -- Keep as true for system convenience but restricted to auth

-- Table: crm_tags
DROP POLICY IF EXISTS "Authenticated users can create tags" ON crm_tags;
CREATE POLICY "employee can create tags" ON crm_tags 
FOR INSERT TO authenticated 
WITH CHECK (has_role('employee') OR has_role('admin'));

-- Table: sync_state (Cleanup)
DROP POLICY IF EXISTS "Admin full access to sync_state" ON sync_state;
DROP POLICY IF EXISTS "employee read sync_state" ON sync_state;
CREATE POLICY "Sync state select policy" ON sync_state 
FOR SELECT TO authenticated 
USING (has_role('employee') OR has_role('admin'));

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
