-- Migration: Phase 3 Security and Performance Cleanup
-- Description: Removes duplicate indexes and consolidates overlapping RLS policies

-- 1. Remove duplicate indexes on token_records
-- Both idx_unique_token_records and idx_token_records_odyssey_id are redundant with token_records_odyssey_token_id_key
DROP INDEX IF EXISTS idx_unique_token_records;
DROP INDEX IF EXISTS idx_token_records_odyssey_id;

-- 2. Consolidate overlapping policies on token_sales
-- Merging "employee read token sales" and "Visitor read token sales" into a single efficient policy
DROP POLICY IF EXISTS "employee read token sales" ON token_sales;
DROP POLICY IF EXISTS "Visitor read token sales" ON token_sales;
CREATE POLICY "Users with access can read token sales" ON token_sales 
FOR SELECT TO authenticated 
USING (has_role('employee') OR has_role('visitor') OR has_role('admin') OR has_role('super_admin'));

-- 3. Cleanup overlapping policies on meters (optional but recommended)
-- Merging employee and Visitor read policies
DROP POLICY IF EXISTS "employee read meters" ON meters;
DROP POLICY IF EXISTS "Visitor read meters" ON meters;
CREATE POLICY "Users with access can read meters" ON meters 
FOR SELECT TO authenticated 
USING (has_role('employee') OR has_role('visitor') OR has_role('admin') OR has_role('super_admin'));

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
