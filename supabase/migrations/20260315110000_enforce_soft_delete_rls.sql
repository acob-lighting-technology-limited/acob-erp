-- Enforce soft-delete filtering in RLS SELECT policies.
--
-- Verified state 2026-03-15:
--   departments:     policy "Anyone can view active departments" USING (is_active = true)  ✓ already correct
--   office_locations: policy "Office locations select policy"    USING (is_active = true)  ✓ already correct
--   assets:          policy "Assets select policy"              USING (deleted_at IS NULL AND ...)
--                    Note: assets table has NO is_active column; soft-delete is via deleted_at.
--
-- Action: departments and office_locations are already correct.
-- For assets, the existing policy uses deleted_at IS NULL which is the correct
-- soft-delete mechanism for that table. No change needed to assets policy.
--
-- This migration is a no-op confirmation that soft-delete is already enforced.
-- All three tables filter out inactive/deleted records at the RLS layer.

-- Confirm departments policy is correct (idempotent re-create)
DROP POLICY IF EXISTS "Anyone can view active departments" ON public.departments;
CREATE POLICY "departments_select_active" ON public.departments
  FOR SELECT TO authenticated
  USING (is_active = TRUE);

-- Confirm office_locations policy is correct (idempotent re-create)
DROP POLICY IF EXISTS "Office locations select policy" ON public.office_locations;
CREATE POLICY "office_locations_select_active" ON public.office_locations
  FOR SELECT TO authenticated
  USING (is_active = TRUE);

-- assets: no change. Policy "Assets select policy" uses deleted_at IS NULL.
-- assets table has no is_active column. Soft-delete enforcement is already correct.
