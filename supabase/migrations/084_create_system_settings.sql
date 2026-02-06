-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  "key" TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read (public settings need to be accessible)
CREATE POLICY "Authenticated users can read system settings" ON system_settings
  FOR SELECT TO authenticated
  USING (true);

-- Allow anon read for maintenance mode checks (middleware needs this often)
CREATE POLICY "Anon can read system settings" ON system_settings
  FOR SELECT TO anon
  USING (true);

-- Only admins/super_admins can manage settings
CREATE POLICY "Admins can manage system settings" ON system_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Insert default maintenance mode setting
INSERT INTO system_settings ("key", value, description)
VALUES ('maintenance_mode', '{"enabled": false, "message": "System is under maintenance. Please check back later."}', 'Controls system-wide maintenance mode')
ON CONFLICT ("key") DO NOTHING;

-- Trigger for updated_at
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
