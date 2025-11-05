-- Verify that assign_device function exists and is accessible
-- Run this in Supabase SQL Editor to check if the function exists

-- Check if function exists
SELECT 
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'assign_device';

-- If the above query returns nothing, run the migration:
-- supabase/migrations/create_assign_device_function.sql

