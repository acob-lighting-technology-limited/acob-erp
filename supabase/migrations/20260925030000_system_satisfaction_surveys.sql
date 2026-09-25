-- Migration: Add system satisfaction surveys for post-deployment adoption feedback
-- Supports CSAT, usability, speed, module feedback, and qualitative insights

CREATE TABLE IF NOT EXISTS system_satisfaction_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  department TEXT,
  role TEXT,
  overall_rating SMALLINT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  speed_rating SMALLINT NOT NULL CHECK (speed_rating BETWEEN 1 AND 5),
  usability_rating SMALLINT NOT NULL CHECK (usability_rating BETWEEN 1 AND 5),
  modules_used TEXT[] DEFAULT '{}',
  module_ratings JSONB DEFAULT '{}'::jsonb,
  training_rating TEXT CHECK (training_rating IN ('adequate', 'somewhat', 'inadequate')),
  biggest_frustration TEXT,
  desired_features TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexing for analytics and lookups
CREATE INDEX IF NOT EXISTS idx_system_surveys_user_id ON system_satisfaction_surveys(user_id);
CREATE INDEX IF NOT EXISTS idx_system_surveys_department ON system_satisfaction_surveys(department);
CREATE INDEX IF NOT EXISTS idx_system_surveys_created_at ON system_satisfaction_surveys(created_at DESC);

-- Enable RLS immediately
ALTER TABLE system_satisfaction_surveys ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE ON system_satisfaction_surveys TO authenticated;
GRANT ALL ON system_satisfaction_surveys TO service_role;

-- RLS Policies
-- Authenticated users can insert their own survey or anonymous survey
CREATE POLICY "Users can insert satisfaction survey" ON system_satisfaction_surveys
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND is_anonymous = false)
    OR (user_id IS NULL AND is_anonymous = true)
  );

-- Users can view their own non-anonymous survey, and admins can view all surveys
CREATE POLICY "Users can view own satisfaction survey" ON system_satisfaction_surveys
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_admin = true OR profiles.role IN ('admin', 'super_admin', 'developer'))
    )
  );

-- Users can update their own non-anonymous survey
CREATE POLICY "Users can update own satisfaction survey" ON system_satisfaction_surveys
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION set_system_satisfaction_surveys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_system_satisfaction_surveys_updated_at ON system_satisfaction_surveys;
CREATE TRIGGER trigger_system_satisfaction_surveys_updated_at
  BEFORE UPDATE ON system_satisfaction_surveys
  FOR EACH ROW
  EXECUTE FUNCTION set_system_satisfaction_surveys_updated_at();

COMMENT ON TABLE system_satisfaction_surveys IS 'Tracks post-deployment user satisfaction and usability feedback for ACOB Matrix ERP';
