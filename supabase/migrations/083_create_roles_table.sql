-- Create roles table to store role metadata and permissions
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions TEXT[] DEFAULT '{}',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Turn on RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Everyone can view roles (needed for UI to show roles to admins/managers, and potentially for permission checks)
CREATE POLICY "Authenticated users can view roles" ON roles
  FOR SELECT TO authenticated
  USING (true);

-- Only admins/super_admins can manage roles
CREATE POLICY "Admins can manage roles" ON roles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Insert default system roles
INSERT INTO roles (name, description, permissions, is_system)
VALUES 
  ('super_admin', 'Full system access', ARRAY['users.view', 'users.manage', 'roles.manage', 'hr.view', 'hr.manage', 'finance.view', 'finance.manage', 'inventory.view', 'inventory.manage', 'purchasing.view', 'purchasing.manage', 'settings.manage', 'reports.view'], true),
  ('admin', 'Administrative access', ARRAY['users.view', 'users.manage', 'hr.view', 'hr.manage', 'finance.view', 'reports.view'], true),
  ('manager', 'Department manager access', ARRAY['hr.view', 'finance.view', 'inventory.view', 'reports.view'], true),
  ('employee', 'Standard employee access', ARRAY['hr.view'], true),
  ('lead', 'Team lead access', ARRAY['hr.view', 'reports.view'], true),
  ('visitor', 'Read-only guest access', ARRAY[]::TEXT[], true)
ON CONFLICT (name) DO UPDATE SET 
  permissions = EXCLUDED.permissions,
  description = EXCLUDED.description;

-- Function to update timestamp
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
