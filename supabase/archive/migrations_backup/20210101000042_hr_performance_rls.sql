-- HR Module: Performance Reviews RLS Policies
-- Enable user-specific access for performance management

-- =====================================================
-- 1. DROP EXISTING ADMIN-ONLY POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Only admins can view performance reviews" ON performance_reviews;
DROP POLICY IF EXISTS "Only admins can manage performance reviews" ON performance_reviews;
DROP POLICY IF EXISTS "Admins can view all reviews" ON performance_reviews;
DROP POLICY IF EXISTS "Users can view own reviews" ON performance_reviews;

DROP POLICY IF EXISTS "Only admins can view review cycles" ON review_cycles;
DROP POLICY IF EXISTS "Only admins can manage review cycles" ON review_cycles;

DROP POLICY IF EXISTS "Only admins can view goals" ON goals_objectives;
DROP POLICY IF EXISTS "Only admins can manage goals" ON goals_objectives;

DROP POLICY IF EXISTS "Only admins can view performance ratings" ON performance_ratings;
DROP POLICY IF EXISTS "Only admins can manage performance ratings" ON performance_ratings;

-- =====================================================
-- 2. PERFORMANCE REVIEWS - USER-SPECIFIC POLICIES
-- =====================================================

-- Users can view their own reviews
CREATE POLICY "Users can view own reviews"
  ON performance_reviews FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = reviewer_id);

-- Department leads can view department reviews
CREATE POLICY "Department leads can view department reviews"
  ON performance_reviews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p1
      JOIN profiles p2 ON p2.id = performance_reviews.user_id
      WHERE p1.id = auth.uid()
        AND p1.is_department_lead = true
        AND p1.department_id = p2.department_id
        AND p1.department_id IS NOT NULL
    )
  );

-- Admins can view all reviews
CREATE POLICY "Admins can view all reviews"
  ON performance_reviews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Department leads and admins can create reviews
CREATE POLICY "Leads and admins can create reviews"
  ON performance_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reviewer_id
    AND (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
          AND role IN ('admin', 'super_admin')
      )
      OR EXISTS (
        SELECT 1 FROM profiles p1
        JOIN profiles p2 ON p2.id = performance_reviews.user_id
        WHERE p1.id = auth.uid()
          AND p1.is_department_lead = true
          AND p1.department_id = p2.department_id
          AND p1.department_id IS NOT NULL
      )
    )
  );

-- Reviewers can update their reviews
CREATE POLICY "Reviewers can update own reviews"
  ON performance_reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = reviewer_id)
  WITH CHECK (auth.uid() = reviewer_id);

-- Only admins can delete reviews
CREATE POLICY "Admins can delete reviews"
  ON performance_reviews FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- =====================================================
-- 3. REVIEW CYCLES - READ-ONLY FOR ALL, ADMIN MANAGE
-- =====================================================

-- All authenticated users can view review cycles
CREATE POLICY "All users can view review cycles"
  ON review_cycles FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage review cycles
CREATE POLICY "Only admins can manage review cycles"
  ON review_cycles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- =====================================================
-- 4. GOALS & OBJECTIVES - USER-SPECIFIC ACCESS
-- =====================================================

-- Users can view their own goals
CREATE POLICY "Users can view own goals"
  ON goals_objectives FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Department leads can view department goals
CREATE POLICY "Department leads can view department goals"
  ON goals_objectives FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p1
      JOIN profiles p2 ON p2.id = goals_objectives.user_id
      WHERE p1.id = auth.uid()
        AND p1.is_department_lead = true
        AND p1.department_id = p2.department_id
        AND p1.department_id IS NOT NULL
    )
  );

-- Admins can view all goals
CREATE POLICY "Admins can view all goals"
  ON goals_objectives FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Users and managers can create goals
CREATE POLICY "Users and managers can create goals"
  ON goals_objectives FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND (role IN ('admin', 'super_admin') OR is_department_lead = true)
    )
  );

-- Users can update their own goals
CREATE POLICY "Users can update own goals"
  ON goals_objectives FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 5. PERFORMANCE RATINGS - READ-ONLY FOR ALL
-- =====================================================

-- All authenticated users can view rating scales
CREATE POLICY "All users can view ratings"
  ON performance_ratings FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage ratings
CREATE POLICY "Only admins can manage ratings"
  ON performance_ratings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
