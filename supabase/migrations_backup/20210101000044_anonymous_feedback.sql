-- Migration: Add anonymous feedback support
-- This adds the is_anonymous column and makes user_id nullable

-- Add is_anonymous column to feedback table
ALTER TABLE feedback 
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;

-- Make user_id nullable (to support truly anonymous feedback)
ALTER TABLE feedback 
ALTER COLUMN user_id DROP NOT NULL;

-- Update RLS policies to allow anonymous feedback insertion
-- Drop existing insert policy if it exists
DROP POLICY IF EXISTS "Users can insert own feedback" ON feedback;

-- Create new insert policy that allows inserting with null user_id
CREATE POLICY "Users can insert feedback" ON feedback
  FOR INSERT
  WITH CHECK (
    -- Either user is inserting their own feedback
    user_id = auth.uid() 
    -- Or it's an anonymous submission (user_id is null)
    OR user_id IS NULL
  );

-- Update select policy to allow viewing anonymous feedback
DROP POLICY IF EXISTS "Users can view own feedback" ON feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON feedback;

-- Users can see their own feedback
CREATE POLICY "Users can view own feedback" ON feedback
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can see all feedback (including anonymous)
CREATE POLICY "Admins can view all feedback" ON feedback
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_admin = true OR profiles.role IN ('admin', 'super_admin'))
    )
  );

-- Add comment to document the anonymous feature
COMMENT ON COLUMN feedback.is_anonymous IS 'When true, user_id is null and the submission is truly anonymous';
COMMENT ON COLUMN feedback.user_id IS 'Nullable - null indicates anonymous feedback submission';
