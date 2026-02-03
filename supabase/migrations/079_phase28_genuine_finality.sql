-- Migration: Phase 28 Genuine Database Finality
-- Description: Addressing the very last stray InitPlan warnings in Office Locations and System Settings.

-- =====================================================
-- 1. OFFICE LOCATIONS (InitPlan)
-- =====================================================
DROP POLICY IF EXISTS "Only super_admin and admin can insert office locations" ON office_locations;
DROP POLICY IF EXISTS "Only super_admin and admin can update office locations" ON office_locations;
DROP POLICY IF EXISTS "Only super_admin can delete office locations" ON office_locations;
DROP POLICY IF EXISTS "Anyone can view office locations" ON office_locations;
DROP POLICY IF EXISTS "Office locations select policy" ON office_locations;
DROP POLICY IF EXISTS "Office locations insert policy" ON office_locations;
DROP POLICY IF EXISTS "Office locations update policy" ON office_locations;
DROP POLICY IF EXISTS "Office locations delete policy" ON office_locations;

CREATE POLICY "Office locations select policy" ON office_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Office locations insert policy" ON office_locations FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "Office locations update policy" ON office_locations FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Office locations delete policy" ON office_locations FOR DELETE TO authenticated USING ((SELECT has_role('super_admin')));


-- =====================================================
-- 2. SYSTEM SETTINGS (InitPlan)
-- =====================================================
DROP POLICY IF EXISTS "Super admins can insert system settings" ON system_settings;
DROP POLICY IF EXISTS "Super admins can update system settings" ON system_settings;
DROP POLICY IF EXISTS "Super admins can delete system settings" ON system_settings;
DROP POLICY IF EXISTS "System settings manage policy" ON system_settings;
DROP POLICY IF EXISTS "System settings insert policy" ON system_settings;
DROP POLICY IF EXISTS "System settings update policy" ON system_settings;
DROP POLICY IF EXISTS "System settings delete policy" ON system_settings;
-- "System settings select policy" exists from Phase 21

CREATE POLICY "System settings insert policy" ON system_settings FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('super_admin')));
CREATE POLICY "System settings update policy" ON system_settings FOR UPDATE TO authenticated USING ((SELECT has_role('admin')) OR (SELECT has_role('super_admin')));
CREATE POLICY "System settings delete policy" ON system_settings FOR DELETE TO authenticated USING ((SELECT has_role('super_admin')));


-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
