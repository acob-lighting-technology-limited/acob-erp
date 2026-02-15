-- Migration Verification Script
-- Run this SQL to verify all migrations have been applied correctly

-- =====================================================
-- 1. RLS POLICY VERIFICATION
-- =====================================================

SELECT 
  'RLS Policies' as test_category,
  tablename,
  CASE WHEN rowsecurity THEN '✓ ENABLED' ELSE '✗ DISABLED' END as rls_status,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND pg_policies.tablename = pt.tablename) as policy_count
FROM pg_tables pt
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'leave_requests', 'attendance_records', 'performance_reviews',
    'department_payments', 'assets', 'tasks', 'office_locations'
  )
ORDER BY tablename;

-- =====================================================
-- 2. CONSTRAINT VERIFICATION
-- =====================================================

-- NOT NULL constraints
SELECT 
  'NOT NULL Constraints' as test_category,
  table_name,
  column_name,
  CASE WHEN is_nullable = 'NO' THEN '✓ NOT NULL' ELSE '✗ NULLABLE' END as constraint_status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'profiles' AND column_name IN ('company_email', 'first_name', 'last_name', 'role'))
    OR (table_name = 'department_payments' AND column_name IN ('department_id', 'title', 'currency', 'status'))
    OR (table_name = 'assets' AND column_name IN ('asset_name', 'asset_type', 'status', 'created_by'))
  )
ORDER BY table_name, column_name;

-- CHECK constraints
SELECT 
  'CHECK Constraints' as test_category,
  constraint_name,
  '✓ EXISTS' as status
FROM information_schema.check_constraints
WHERE constraint_schema = 'public'
  AND constraint_name IN (
    'department_payments_status_check',
    'department_payments_payment_type_check',
    'assets_status_check',
    'tasks_status_check'
  )
ORDER BY constraint_name;

-- UNIQUE constraints
SELECT 
  'UNIQUE Constraints' as test_category,
  constraint_name,
  table_name,
  '✓ EXISTS' as status
FROM information_schema.table_constraints
WHERE constraint_schema = 'public'
  AND constraint_type = 'UNIQUE'
  AND constraint_name IN (
    'departments_name_unique',
    'office_locations_name_unique',
    'profiles_company_email_unique'
  )
ORDER BY constraint_name;

-- =====================================================
-- 3. FOREIGN KEY VERIFICATION
-- =====================================================

SELECT 
  'Foreign Keys' as test_category,
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  '✓ EXISTS' as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.constraint_name IN (
    'department_payments_department_id_fkey',
    'department_payments_created_by_fkey',
    'assets_created_by_fkey',
    'tasks_assigned_to_fkey',
    'leave_requests_user_id_fkey'
  )
ORDER BY tc.table_name, tc.constraint_name;

-- =====================================================
-- 4. INDEX VERIFICATION
-- =====================================================

SELECT 
  'Performance Indexes' as test_category,
  indexname,
  tablename,
  '✓ EXISTS' as status
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_department_payments_status',
    'idx_department_payments_category',
    'idx_tasks_status',
    'idx_tasks_assigned_to',
    'idx_assets_status',
    'idx_profiles_role'
  )
ORDER BY indexname;

-- =====================================================
-- 5. COMPUTED COLUMN VERIFICATION
-- =====================================================

SELECT 
  'Computed Columns' as test_category,
  table_name,
  column_name,
  CASE WHEN is_generated = 'ALWAYS' THEN '✓ COMPUTED' ELSE '✓ EXISTS' END as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'profiles' AND column_name = 'full_name')
    OR (table_name = 'profiles' AND column_name = 'department_id')
    OR (table_name = 'office_locations' AND column_name = 'site')
  )
ORDER BY table_name, column_name;

-- =====================================================
-- 6. PAYMENT CONSOLIDATION VERIFICATION
-- =====================================================

SELECT 
  'Payment Consolidation' as test_category,
  column_name,
  data_type,
  '✓ EXISTS' as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'department_payments'
  AND column_name IN ('category', 'site_id', 'invoice_number', 'site_name')
ORDER BY column_name;

-- =====================================================
-- 7. HR MODULE TABLE VERIFICATION
-- =====================================================

SELECT 
  'HR Module Tables' as test_category,
  tablename,
  '✓ EXISTS' as status,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND pg_policies.tablename = pt.tablename) as policy_count
FROM pg_tables pt
WHERE schemaname = 'public'
  AND tablename IN (
    'leave_requests', 'leave_types', 'leave_balances', 'leave_approvals',
    'attendance_records', 'timesheets', 'shifts',
    'performance_reviews', 'review_cycles', 'goals_objectives', 'performance_ratings'
  )
ORDER BY tablename;

-- =====================================================
-- 8. FUNCTION SECURITY VERIFICATION
-- =====================================================

SELECT 
  'Function Security' as test_category,
  p.proname as function_name,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END as security_type,
  CASE WHEN p.proconfig IS NOT NULL THEN '✓ HAS search_path' ELSE '✗ NO search_path' END as search_path_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND p.prosecdef = true
ORDER BY p.proname
LIMIT 10;

-- =====================================================
-- SUMMARY
-- =====================================================

SELECT 
  '=== MIGRATION VERIFICATION SUMMARY ===' as summary,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true) as tables_with_rls,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as total_rls_policies,
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND constraint_type = 'FOREIGN KEY') as total_foreign_keys,
  (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%') as total_custom_indexes,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%leave%' OR tablename LIKE '%attendance%' OR tablename LIKE '%performance%' OR tablename LIKE '%goal%') as hr_tables;
