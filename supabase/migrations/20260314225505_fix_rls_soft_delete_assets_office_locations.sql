
-- ----------------------------------------------------------------
-- Fix assets SELECT policy: exclude soft-deleted rows (deleted_at IS NOT NULL)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Assets select policy" ON public.assets;

CREATE POLICY "Assets select policy"
  ON public.assets
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      ( SELECT has_role('staff'::text) AS has_role)
      OR ( SELECT has_role('admin'::text) AS has_role)
      OR (
        ( SELECT has_role('lead'::text) AS has_role)
        AND department = (
          SELECT profiles.department
          FROM profiles
          WHERE profiles.id = ( SELECT auth.uid() AS uid)
          LIMIT 1
        )
      )
    )
  );

-- ----------------------------------------------------------------
-- Fix office_locations SELECT policy: exclude inactive locations
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Office locations select policy" ON public.office_locations;

CREATE POLICY "Office locations select policy"
  ON public.office_locations
  FOR SELECT
  USING (is_active = true);
;
