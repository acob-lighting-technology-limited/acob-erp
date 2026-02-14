-- Migration: Phase 20 Final Performance Purge (V2)
-- Description: Aggressively removes all overlapping 'FOR ALL' policies and 
-- finalizes all InitPlan subquery optimizations across remaining tables.

-- =====================================================
-- 1. CLEAN UP ASSET ASSIGNMENTS (Performance & InitPlan)
-- =====================================================
DROP POLICY IF EXISTS "Only super_admin/admin can create asset assignments" ON asset_assignments;
DROP POLICY IF EXISTS "Only super_admin/admin can update asset assignments" ON asset_assignments;
DROP POLICY IF EXISTS "Only super_admin/admin can delete asset assignments" ON asset_assignments;
DROP POLICY IF EXISTS "Users can view their own asset assignments" ON asset_assignments;
DROP POLICY IF EXISTS "Asset assignments select policy" ON asset_assignments;
DROP POLICY IF EXISTS "Asset assignments insert policy" ON asset_assignments;
DROP POLICY IF EXISTS "Asset assignments update policy" ON asset_assignments;
DROP POLICY IF EXISTS "Asset assignments delete policy" ON asset_assignments;

CREATE POLICY "Asset assignments select policy" ON asset_assignments 
FOR SELECT TO authenticated 
USING (
    assigned_to = (SELECT auth.uid()) OR 
    (SELECT has_role('admin')) OR 
    ((SELECT has_role('lead')) AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = asset_assignments.assigned_to 
        AND profiles.department_id = (SELECT department_id FROM profiles WHERE id = (SELECT auth.uid()))
    ))
);

CREATE POLICY "Asset assignments insert policy" ON asset_assignments 
FOR INSERT TO authenticated 
WITH CHECK ((SELECT has_role('admin')) OR (SELECT has_role('lead')));

CREATE POLICY "Asset assignments update policy" ON asset_assignments 
FOR UPDATE TO authenticated 
USING ((SELECT has_role('admin')) OR (SELECT has_role('lead')));

CREATE POLICY "Asset assignments delete policy" ON asset_assignments 
FOR DELETE TO authenticated 
USING ((SELECT has_role('admin')));


-- =====================================================
-- 2. ELIMINATE REMAINING 'FOR ALL' REDUNDANCY
-- =====================================================

-- Table: assets
DROP POLICY IF EXISTS "Assets manage policy" ON assets;
DROP POLICY IF EXISTS "Assets insert policy" ON assets;
DROP POLICY IF EXISTS "Assets update policy" ON assets;
DROP POLICY IF EXISTS "Assets delete policy" ON assets;
CREATE POLICY "Assets insert policy" ON assets FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "Assets update policy" ON assets FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Assets delete policy" ON assets FOR DELETE TO authenticated USING ((SELECT has_role('admin')));

-- Table: asset_types
DROP POLICY IF EXISTS "Admins can manage asset_types" ON asset_types;
DROP POLICY IF EXISTS "Asset types insert policy" ON asset_types;
DROP POLICY IF EXISTS "Asset types update policy" ON asset_types;
DROP POLICY IF EXISTS "Asset types delete policy" ON asset_types;
CREATE POLICY "Asset types insert policy" ON asset_types FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "Asset types update policy" ON asset_types FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Asset types delete policy" ON asset_types FOR DELETE TO authenticated USING ((SELECT has_role('admin')));

-- Table: payroll_entries
DROP POLICY IF EXISTS "Payroll entries manage policy" ON payroll_entries;
DROP POLICY IF EXISTS "Payroll entries insert policy" ON payroll_entries;
DROP POLICY IF EXISTS "Payroll entries update policy" ON payroll_entries;
DROP POLICY IF EXISTS "Payroll entries delete policy" ON payroll_entries;
CREATE POLICY "Payroll entries insert policy" ON payroll_entries FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "Payroll entries update policy" ON payroll_entries FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Payroll entries delete policy" ON payroll_entries FOR DELETE TO authenticated USING ((SELECT has_role('admin')));

-- Table: employee_salaries
DROP POLICY IF EXISTS "Employee salaries manage policy" ON employee_salaries;
DROP POLICY IF EXISTS "Employee salaries insert policy" ON employee_salaries;
DROP POLICY IF EXISTS "Employee salaries update policy" ON employee_salaries;
DROP POLICY IF EXISTS "Employee salaries delete policy" ON employee_salaries;
CREATE POLICY "Employee salaries insert policy" ON employee_salaries FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "Employee salaries update policy" ON employee_salaries FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Employee salaries delete policy" ON employee_salaries FOR DELETE TO authenticated USING ((SELECT has_role('admin')));

-- Table: payment_documents
DROP POLICY IF EXISTS "Payment documents manage policy" ON payment_documents;
DROP POLICY IF EXISTS "Payment documents update policy" ON payment_documents;
DROP POLICY IF EXISTS "Payment documents delete policy" ON payment_documents;
CREATE POLICY "Payment documents update policy" ON payment_documents FOR UPDATE TO authenticated USING ((SELECT has_role('admin')) OR uploaded_by = (SELECT auth.uid()));
CREATE POLICY "Payment documents delete policy" ON payment_documents FOR DELETE TO authenticated USING ((SELECT has_role('admin')) OR uploaded_by = (SELECT auth.uid()));

-- Table: user_roles
DROP POLICY IF EXISTS "User roles manage policy" ON user_roles;

-- Table: consumption_data
DROP POLICY IF EXISTS "Admins can manage consumption data" ON consumption_data;
DROP POLICY IF EXISTS "Consumption data insert" ON consumption_data;
DROP POLICY IF EXISTS "Consumption data update" ON consumption_data;
DROP POLICY IF EXISTS "Consumption data delete" ON consumption_data;
CREATE POLICY "Consumption data insert" ON consumption_data FOR INSERT TO authenticated WITH CHECK ((SELECT has_role('admin')));
CREATE POLICY "Consumption data update" ON consumption_data FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Consumption data delete" ON consumption_data FOR DELETE TO authenticated USING ((SELECT has_role('admin')));


-- =====================================================
-- 3. RECRUITMENT & HR POLISH
-- =====================================================

-- Table: applications
DROP POLICY IF EXISTS "Only admins can manage applications" ON applications;
DROP POLICY IF EXISTS "Applications insert policy" ON applications;
DROP POLICY IF EXISTS "Applications update policy" ON applications;
DROP POLICY IF EXISTS "Applications delete policy" ON applications;
CREATE POLICY "Applications insert policy" ON applications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Applications update policy" ON applications FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Applications delete policy" ON applications FOR DELETE TO authenticated USING ((SELECT has_role('admin')));

-- Table: offers
DROP POLICY IF EXISTS "Only admins can manage offers" ON offers;
DROP POLICY IF EXISTS "Offers update policy" ON offers;
DROP POLICY IF EXISTS "Offers delete policy" ON offers;
CREATE POLICY "Offers update policy" ON offers FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));
CREATE POLICY "Offers delete policy" ON offers FOR DELETE TO authenticated USING ((SELECT has_role('admin')));


-- =====================================================
-- 4. FINAL SYSTEM SETTINGS HARDENING
-- =====================================================
DROP POLICY IF EXISTS "Only admins can manage system settings" ON system_settings;
DROP POLICY IF EXISTS "System settings select" ON system_settings;
DROP POLICY IF EXISTS "System settings update" ON system_settings;
CREATE POLICY "System settings select" ON system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "System settings update" ON system_settings FOR UPDATE TO authenticated USING ((SELECT has_role('admin')));

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
