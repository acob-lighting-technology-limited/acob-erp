-- RLS Policy Audit Script
-- Test RLS policies with different user roles to ensure proper access control

-- This script helps verify that RLS policies are working correctly
-- Run these queries while logged in as different users to test access

-- =====================================================
-- 1. TEST AS VISITOR (should have minimal access)
-- =====================================================

-- Visitors should NOT be able to:
-- - View profiles (except their own)
-- - View department_payments
-- - View assets
-- - Modify anything

SELECT 'Testing visitor access to profiles' as test;
SELECT COUNT(*) as profile_count FROM profiles; -- Should only see own profile

SELECT 'Testing visitor access to payments' as test;
SELECT COUNT(*) as payment_count FROM department_payments; -- Should see 0

SELECT 'Testing visitor access to assets' as test;
SELECT COUNT(*) as asset_count FROM assets; -- Should see 0

-- =====================================================
-- 2. TEST AS employee (should have limited access)
-- =====================================================

-- employee should be able to:
-- - View their own profile
-- - View office locations
-- - View their own tasks
-- - View their own asset assignments

SELECT 'Testing employee access to profiles' as test;
SELECT COUNT(*) as profile_count FROM profiles; -- Should see all profiles

SELECT 'Testing employee access to office locations' as test;
SELECT COUNT(*) as location_count FROM office_locations; -- Should see all

SELECT 'Testing employee access to payments' as test;
SELECT COUNT(*) as payment_count FROM department_payments; -- Should see 0 (not authorized)

-- =====================================================
-- 3. TEST AS DEPARTMENT LEAD (should have department-scoped access)
-- =====================================================

-- Department leads should be able to:
-- - View all profiles in their department(s)
-- - View department payments for their department(s)
-- - Manage tasks for their department
-- - View assets assigned to their department

SELECT 'Testing lead access to profiles' as test;
SELECT COUNT(*) as profile_count FROM profiles; -- Should see all profiles

SELECT 'Testing lead access to payments' as test;
SELECT COUNT(*) as payment_count FROM department_payments; -- Should see their department's payments

SELECT 'Testing lead access to tasks' as test;
SELECT COUNT(*) as task_count FROM tasks; -- Should see department tasks

-- =====================================================
-- 4. TEST AS ADMIN (should have broad access)
-- =====================================================

-- Admins should be able to:
-- - View and modify all profiles (except super_admin role assignment)
-- - View and manage all payments
-- - View and manage all assets
-- - View and manage all tasks

SELECT 'Testing admin access to profiles' as test;
SELECT COUNT(*) as profile_count FROM profiles; -- Should see all

SELECT 'Testing admin access to payments' as test;
SELECT COUNT(*) as payment_count FROM department_payments; -- Should see all

SELECT 'Testing admin access to assets' as test;
SELECT COUNT(*) as asset_count FROM assets; -- Should see all

SELECT 'Testing admin access to tasks' as test;
SELECT COUNT(*) as task_count FROM tasks; -- Should see all

-- =====================================================
-- 5. TEST AS SUPER_ADMIN (should have full access)
-- =====================================================

-- Super admins should be able to:
-- - Do everything admins can do
-- - Assign super_admin role
-- - Delete critical records
-- - Access all HR tables

SELECT 'Testing super_admin access to profiles' as test;
SELECT COUNT(*) as profile_count FROM profiles; -- Should see all

SELECT 'Testing super_admin access to HR tables' as test;
SELECT COUNT(*) as leave_count FROM leave_requests; -- Should see all

-- =====================================================
-- 6. TEST WRITE OPERATIONS
-- =====================================================

-- Test INSERT permissions
-- (These should fail for unauthorized users)

-- Try to create a payment (should fail for employee/visitor)
-- INSERT INTO department_payments (department_id, title, amount, currency, status, payment_type, category)
-- VALUES ('test-uuid', 'Test Payment', 1000, 'NGN', 'due', 'one-time', 'Test');

-- Try to create a profile (should fail for everyone except super_admin via handle_new_user)
-- INSERT INTO profiles (id, first_name, last_name, company_email, role)
-- VALUES (gen_random_uuid(), 'Test', 'User', 'test@example.com', 'employee');

-- =====================================================
-- 7. VERIFY CRITICAL TABLES HAVE RLS ENABLED
-- =====================================================

SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'department_payments', 'assets', 'tasks', 
    'office_locations', 'departments', 'audit_logs',
    'leave_requests', 'employee_salaries', 'payroll_entries'
  )
ORDER BY tablename;

-- =====================================================
-- 8. LIST ALL RLS POLICIES
-- =====================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =====================================================
-- EXPECTED RESULTS
-- =====================================================

/*
VISITOR:
- profiles: 1 (own profile only)
- department_payments: 0
- assets: 0
- tasks: own tasks only

employee:
- profiles: all (read-only)
- department_payments: 0 (no access)
- assets: own assignments only
- tasks: own tasks + department tasks (read)

LEAD:
- profiles: all (read-only)
- department_payments: department payments (read/write for own dept)
- assets: department assets (read/write)
- tasks: department tasks (read/write)

ADMIN:
- profiles: all (read/write, cannot assign super_admin)
- department_payments: all (read/write)
- assets: all (read/write)
- tasks: all (read/write)

SUPER_ADMIN:
- Everything (full access)
- Can assign super_admin role
- Can delete critical records
*/
