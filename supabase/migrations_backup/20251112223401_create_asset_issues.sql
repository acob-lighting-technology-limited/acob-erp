-- Migration: Create asset_issues table for tracking asset problems

-- Create asset_issues table
CREATE TABLE IF NOT EXISTS asset_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE asset_issues IS 'Tracks issues/problems with assets (e.g., faulty RAM, broken screen)';
COMMENT ON COLUMN asset_issues.asset_id IS 'The asset this issue belongs to';
COMMENT ON COLUMN asset_issues.description IS 'Description of the issue';
COMMENT ON COLUMN asset_issues.resolved IS 'Whether the issue has been fixed';
COMMENT ON COLUMN asset_issues.resolved_at IS 'When the issue was marked as resolved';
COMMENT ON COLUMN asset_issues.resolved_by IS 'Who marked the issue as resolved';
COMMENT ON COLUMN asset_issues.created_by IS 'Who created the issue';

-- Create indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_asset_issues_asset_id ON asset_issues(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_issues_resolved ON asset_issues(resolved);
CREATE INDEX IF NOT EXISTS idx_asset_issues_created_at ON asset_issues(created_at DESC);

-- Enable Row Level Security
ALTER TABLE asset_issues ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all asset issues
CREATE POLICY "Users can view all asset issues" ON asset_issues
FOR SELECT USING (true);

-- Policy: Authenticated users can insert asset issues
CREATE POLICY "Authenticated users can insert asset issues" ON asset_issues
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy: Users can update asset issues (mark as resolved)
CREATE POLICY "Users can update asset issues" ON asset_issues
FOR UPDATE USING (auth.role() = 'authenticated');

-- Policy: Only admins can delete asset issues
CREATE POLICY "Admins can delete asset issues" ON asset_issues
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_asset_issues_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.resolved = TRUE AND OLD.resolved = FALSE THEN
    NEW.resolved_at = NOW();
    NEW.resolved_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
CREATE TRIGGER set_asset_issues_updated_at
BEFORE UPDATE ON asset_issues
FOR EACH ROW
EXECUTE FUNCTION update_asset_issues_updated_at();

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

