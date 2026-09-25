-- Fix insert policy on system_satisfaction_surveys to allow user_id = auth.uid() regardless of is_anonymous
DROP POLICY IF EXISTS "Users can insert satisfaction survey" ON system_satisfaction_surveys;

CREATE POLICY "Users can insert satisfaction survey" ON system_satisfaction_surveys
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR (user_id IS NULL AND is_anonymous = true)
  );
