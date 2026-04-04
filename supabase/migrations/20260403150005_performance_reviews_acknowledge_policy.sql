DROP POLICY IF EXISTS "Performance reviews update" ON public.performance_reviews;

CREATE POLICY "Performance reviews update" ON public.performance_reviews
  FOR UPDATE TO authenticated
  USING (
    reviewer_id = auth.uid()
    OR user_id = auth.uid()
    OR has_role('admin')
  );
