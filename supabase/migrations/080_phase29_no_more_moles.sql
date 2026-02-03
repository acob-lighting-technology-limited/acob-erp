-- Migration: Phase 29 No More Moles (V2)
-- Description: Addressing the literal last performance warnings in the entire database.

-- =====================================================
-- 1. DEPARTMENT PAYMENTS (InitPlan)
-- =====================================================
DROP POLICY IF EXISTS "Users can delete their own payments" ON department_payments;
DROP POLICY IF EXISTS "Department payments delete policy" ON department_payments;
CREATE POLICY "Department payments delete policy" ON department_payments FOR DELETE TO authenticated 
USING (created_by = (SELECT auth.uid()) OR (SELECT has_role('admin')));


-- =====================================================
-- 2. OFFICE LOCATIONS (Redundancy Recovery)
-- =====================================================
DROP POLICY IF EXISTS "All authenticated users can view office locations" ON office_locations;


-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
