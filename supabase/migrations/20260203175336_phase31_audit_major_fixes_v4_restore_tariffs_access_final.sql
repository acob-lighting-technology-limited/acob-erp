-- Migration: Phase 31 Audit Major Fixes (V4)
-- Description: Addressing major and critical security/logic issues identified by audit.

-- =====================================================
-- 8. TARIFFS (Restore Admin Write)
-- =====================================================
DROP POLICY IF EXISTS "Tariffs admin manage" ON tariffs;
CREATE POLICY "Tariffs admin manage" ON tariffs 
FOR ALL TO authenticated 
USING ((SELECT has_role('admin')) OR (SELECT has_role('super_admin')))
WITH CHECK ((SELECT has_role('admin')) OR (SELECT has_role('super_admin')));

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
;
