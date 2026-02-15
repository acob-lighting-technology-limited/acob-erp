-- Check if payment system tables exist and have data
-- Run this in Supabase SQL Editor to verify the migration

-- Check tables exist
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE columns.table_name = tables.table_name) as column_count
FROM information_schema.tables
WHERE table_schema = 'public' 
AND table_name IN ('departments', 'payment_categories', 'department_payments', 'payment_documents')
ORDER BY table_name;

-- Check payment categories
SELECT * FROM payment_categories ORDER BY name;

-- Check departments
SELECT * FROM departments ORDER BY name;

-- Check if RLS is enabled
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('departments', 'payment_categories', 'department_payments', 'payment_documents')
ORDER BY tablename;
