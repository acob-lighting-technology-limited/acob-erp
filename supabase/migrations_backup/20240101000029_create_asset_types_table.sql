-- ============================================
-- Create Asset Types Table
-- ============================================

CREATE TABLE IF NOT EXISTS asset_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  requires_serial_model BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Insert existing asset types
INSERT INTO asset_types (label, code, requires_serial_model) VALUES
  ('Desktop', 'DSKST', true),
  ('Laptop', 'LAP', true),
  ('Telephone', 'TELPH', false),
  ('Fan', 'FAN', false),
  ('Printer', 'PRINT', false),
  ('Router', 'ROUTER', false),
  ('Television', 'TELV', false),
  ('Office Safe Drawer', 'SAVEDRW', false),
  ('Extension Box', 'EXTEN', false),
  ('Notice Board (White)', 'WHITE/BRD', false),
  ('Notice Board (Black)', 'BLACK/BRD', false),
  ('Office Table', 'TB', false),
  ('Table Side Drawer', 'OFF/DRAW', false),
  ('Chair', 'CHAIR', false),
  ('Executive Chair', 'EX/CHAIR', false),
  ('Deep Freezer', 'D/FREEZER', false),
  ('Microwave', 'MICROWAVE', false),
  ('Air Conditioner', 'AC', false),
  ('Visibility Banner', 'VBANNER', false),
  ('Generator', 'GEN', false)
ON CONFLICT (code) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_asset_types_code ON asset_types(code);
CREATE INDEX IF NOT EXISTS idx_asset_types_label ON asset_types(label);

-- RLS Policies
ALTER TABLE asset_types ENABLE ROW LEVEL SECURITY;

-- Everyone can view asset types
CREATE POLICY "Anyone can view asset types" ON asset_types FOR SELECT USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "Admins can manage asset types" ON asset_types FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('super_admin', 'admin')
  )
);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_asset_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_asset_types_updated_at
  BEFORE UPDATE ON asset_types
  FOR EACH ROW
  EXECUTE FUNCTION update_asset_types_updated_at();

