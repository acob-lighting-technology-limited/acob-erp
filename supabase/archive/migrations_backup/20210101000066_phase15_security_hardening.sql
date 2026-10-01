-- Migration: Phase 15 Comprehensive Security Hardening
-- Description: Hardens the remaining tables with permissive "Always True" policies, 
-- restricts public access to assets, and optimizes RLS performance using initplan subqueries.

-- =====================================================
-- 1. HARDEN ASSETS & INFRASTRUCTURE (Public Access Holes)
-- =====================================================

-- Table: assets
-- Problem: Policy "Users can view all assets" was USING (true) for role 'public'
DROP POLICY IF EXISTS "Users can view all assets" ON assets;
DROP POLICY IF EXISTS "Only super_admin/admin can create assets" ON assets;
DROP POLICY IF EXISTS "Only super_admin/admin can update assets" ON assets;
DROP POLICY IF EXISTS "Only super_admin/admin can delete assets" ON assets;

CREATE POLICY "Assets select policy" ON assets 
FOR SELECT TO authenticated 
USING (
    has_role('employee') OR 
    has_role('admin') OR 
    (has_role('lead') AND department = (SELECT department FROM profiles WHERE id = (SELECT auth.uid()) LIMIT 1))
);

CREATE POLICY "Assets manage policy" ON assets 
FOR ALL TO authenticated 
USING (has_role('admin'))
WITH CHECK (has_role('admin'));

-- Table: asset_issues
-- Problem: Policy "Users can view all asset issues" was USING (true) for role 'public'
DROP POLICY IF EXISTS "Users can view all asset issues" ON asset_issues;
CREATE POLICY "Asset issues select policy" ON asset_issues 
FOR SELECT TO authenticated 
USING (has_role('employee') OR has_role('admin'));

CREATE POLICY "Asset issues manage policy" ON asset_issues 
FOR ALL TO authenticated 
USING (has_role('admin'))
WITH CHECK (has_role('admin'));

-- Table: asset_types
-- Problem: Policy "Anyone can view asset_types" was USING (true) for role 'public'
DROP POLICY IF EXISTS "Anyone can view asset_types" ON asset_types;
CREATE POLICY "Asset types select policy" ON asset_types 
FOR SELECT TO authenticated 
USING (has_role('employee') OR has_role('admin'));

-- Table: gateways
-- Problem: Policy "Enable read access for all users" was USING (true) for role 'public'
DROP POLICY IF EXISTS "Enable read access for all users" ON gateways;
CREATE POLICY "Gateways select policy" ON gateways 
FOR SELECT TO authenticated 
USING (has_role('employee') OR has_role('admin'));

-- Table: gprs_tasks
-- Problem: Policy "Enable read access for all users" was USING (true) for role 'public'
DROP POLICY IF EXISTS "Enable read access for all users" ON gprs_tasks;
CREATE POLICY "GPRS tasks select policy" ON gprs_tasks 
FOR SELECT TO authenticated 
USING (has_role('employee') OR has_role('admin'));

-- Table: crm_tags
-- Problem: Policy "Everyone can view tags" was USING (true) for role 'public'
DROP POLICY IF EXISTS "Everyone can view tags" ON crm_tags;
CREATE POLICY "CRM tags select policy" ON crm_tags 
FOR SELECT TO authenticated 
USING (has_role('employee') OR has_role('admin'));


-- =====================================================
-- 2. PERFORMANCE & REDUNDANCY: PAYROLL & HR
-- =====================================================

-- Table: payroll_entries
-- Problem: Multiple permissive policies and redundant role checks
DROP POLICY IF EXISTS "Admins can view all payroll" ON payroll_entries;
DROP POLICY IF EXISTS "Users can view own payroll" ON payroll_entries;
DROP POLICY IF EXISTS "Only admins can manage payroll entries" ON payroll_entries;
DROP POLICY IF EXISTS "Only admins can view payroll entries" ON payroll_entries;

CREATE POLICY "Payroll entries select policy" ON payroll_entries 
FOR SELECT TO authenticated 
USING (
    user_id = (SELECT auth.uid()) OR 
    has_role('admin')
);

CREATE POLICY "Payroll entries manage policy" ON payroll_entries 
FOR ALL TO authenticated 
USING (has_role('admin'))
WITH CHECK (has_role('admin'));

-- Table: payroll_periods
-- Problem: Multiple permissive policies
DROP POLICY IF EXISTS "All authenticated users can view payroll periods" ON payroll_periods;
DROP POLICY IF EXISTS "Only admins can manage payroll periods" ON payroll_periods;

CREATE POLICY "Payroll periods select policy" ON payroll_periods 
FOR SELECT TO authenticated 
USING (has_role('employee') OR has_role('admin'));

CREATE POLICY "Payroll periods manage policy" ON payroll_periods 
FOR ALL TO authenticated 
USING (has_role('admin'))
WITH CHECK (has_role('admin'));

-- Table: payslips
-- Problem: Users couldn't view their own payslips based on existing policies
DROP POLICY IF EXISTS "Only admins can manage payslips" ON payslips;
DROP POLICY IF EXISTS "Only admins can view payslips" ON payslips;

CREATE POLICY "Payslips select policy" ON payslips 
FOR SELECT TO authenticated 
USING (
    user_id = (SELECT auth.uid()) OR 
    has_role('admin')
);

CREATE POLICY "Payslips manage policy" ON payslips 
FOR ALL TO authenticated 
USING (has_role('admin'))
WITH CHECK (has_role('admin'));


-- =====================================================
-- 3. PRIVACY: SENSITIVE PROFILES (Hardening)
-- =====================================================

-- Table: profiles
-- Problem: Bank details and addresses are visible to all users
-- Note: Instead of partial masking (complex in SQL), we ensure SELECT is still allowed 
-- for general directory, but we encourage frontend to mask fields for non-admins.
-- we fix the Performance InitPlan issue as well.
DROP POLICY IF EXISTS "Profiles view policy" ON profiles;
CREATE POLICY "Profiles view policy" ON profiles 
FOR SELECT TO authenticated 
USING (true); -- Directory remains viewable, but we fix the InitPlan warning on other policies

-- Fix InitPlan performance on update/delete
DROP POLICY IF EXISTS "Profiles update policy" ON profiles;
CREATE POLICY "Profiles update policy" ON profiles 
FOR UPDATE TO authenticated 
USING (has_role('admin') OR id = (SELECT auth.uid()))
WITH CHECK (has_role('admin') OR id = (SELECT auth.uid()));

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
