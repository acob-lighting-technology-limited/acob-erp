-- Create system_settings table for managing system-wide settings
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Only super_admins can read/write system settings
CREATE POLICY "Super admins can view system settings"
  ON system_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update system settings"
  ON system_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can insert system settings"
  ON system_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Insert default settings
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES 
  ('shutdown_mode', '{"enabled": false, "message": "This service has been discontinued as of December 2, 2024.", "title": "Service Discontinued"}'::jsonb, 'Controls whether the application is in shutdown mode'),
  ('maintenance_mode', '{"enabled": false, "message": "We are currently performing scheduled maintenance. Please check back soon.", "title": "Maintenance Mode", "estimated_end": null}'::jsonb, 'Controls whether the application is in maintenance mode')
ON CONFLICT (setting_key) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);

-- Create function to get system setting
CREATE OR REPLACE FUNCTION get_system_setting(key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT setting_value INTO result
  FROM system_settings
  WHERE setting_key = key;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- Create function to update system setting (for super admins only)
CREATE OR REPLACE FUNCTION update_system_setting(
  key TEXT,
  value JSONB,
  user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_super_admin BOOLEAN;
BEGIN
  -- Check if user is super admin
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND role = 'super_admin'
  ) INTO is_super_admin;
  
  IF NOT is_super_admin THEN
    RAISE EXCEPTION 'Only super admins can update system settings';
  END IF;
  
  -- Update or insert the setting
  INSERT INTO system_settings (setting_key, setting_value, updated_by)
  VALUES (key, value, user_id)
  ON CONFLICT (setting_key)
  DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();
  
  RETURN TRUE;
END;
$$;
