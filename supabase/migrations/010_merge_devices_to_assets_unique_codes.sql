-- ============================================
-- Merge Devices into Assets System with Unique Codes
-- ============================================

-- DELETE ALL EXISTING DATA (fresh start with new system)
-- Delete from tables only if they exist
DO $$
BEGIN
  -- Delete all device assignments if table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'device_assignments') THEN
    DELETE FROM device_assignments WHERE 1=1;
  END IF;

  -- Delete all devices if table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'devices') THEN
    DELETE FROM devices WHERE 1=1;
  END IF;

  -- Delete all asset assignments if table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'asset_assignments') THEN
    DELETE FROM asset_assignments WHERE 1=1;
  END IF;

  -- Delete all assets if table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'assets') THEN
    DELETE FROM assets WHERE 1=1;
  END IF;
END $$;

-- Add new columns to assets table (without unique constraint first)
ALTER TABLE assets
ADD COLUMN IF NOT EXISTS unique_code TEXT,
ADD COLUMN IF NOT EXISTS acquisition_year INTEGER,
ADD COLUMN IF NOT EXISTS assignment_type TEXT DEFAULT 'individual' CHECK (assignment_type IN ('individual', 'department', 'office')),
ADD COLUMN IF NOT EXISTS department TEXT;

-- Make asset_name nullable since we're using asset_type now
ALTER TABLE assets
ALTER COLUMN asset_name DROP NOT NULL;

-- Drop purchase_date and purchase_cost columns
ALTER TABLE assets
DROP COLUMN IF EXISTS purchase_date,
DROP COLUMN IF EXISTS purchase_cost;

-- Update asset_assignments table to support office assignments
ALTER TABLE asset_assignments
ADD COLUMN IF NOT EXISTS assignment_type TEXT DEFAULT 'individual' CHECK (assignment_type IN ('individual', 'department', 'office')),
ADD COLUMN IF NOT EXISTS department TEXT;

-- Drop existing unique constraint if it exists
ALTER TABLE assets
DROP CONSTRAINT IF EXISTS assets_unique_code_key;

-- Now make unique_code NOT NULL and add unique constraint
ALTER TABLE assets
ALTER COLUMN unique_code SET NOT NULL;

-- Add unique constraint
ALTER TABLE assets
ADD CONSTRAINT assets_unique_code_key UNIQUE (unique_code);

-- Create index for unique_code for fast searches
CREATE INDEX IF NOT EXISTS idx_assets_unique_code ON assets(unique_code);
CREATE INDEX IF NOT EXISTS idx_assets_acquisition_year ON assets(acquisition_year);
CREATE INDEX IF NOT EXISTS idx_assets_department ON assets(department);

-- Function to generate next serial number for an asset type and year
CREATE OR REPLACE FUNCTION get_next_asset_serial(asset_code TEXT, year INTEGER)
RETURNS TEXT AS $$
DECLARE
  next_serial INTEGER;
  serial_str TEXT;
BEGIN
  -- Find the highest serial number for this asset type and year
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(unique_code FROM '[0-9]+$') AS INTEGER
    )
  ), 0) + 1
  INTO next_serial
  FROM assets
  WHERE unique_code LIKE 'ACOB/HQ/' || asset_code || '/' || year::text || '/%';

  -- Format as 3-digit serial (001, 002, etc.)
  serial_str := LPAD(next_serial::TEXT, 3, '0');

  RETURN 'ACOB/HQ/' || asset_code || '/' || year::text || '/' || serial_str;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_next_asset_serial(TEXT, INTEGER) TO authenticated;

-- Update RLS policies for new assignment types
DROP POLICY IF EXISTS "Users can view their own asset assignments" ON asset_assignments;

CREATE POLICY "Users can view their own asset assignments" ON asset_assignments FOR SELECT USING (
  assigned_to = auth.uid() OR
  (assignment_type = 'department' AND department IN (
    SELECT unnest(lead_departments) FROM profiles WHERE id = auth.uid()
  )) OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role IN ('super_admin', 'admin', 'lead'))
  )
);

-- Update assets view policy to include department filtering for leads
DROP POLICY IF EXISTS "Users can view all assets" ON assets;

CREATE POLICY "Users can view all assets" ON assets FOR SELECT USING (
  true -- All authenticated users can view all assets
);

-- Comment explaining the asset type codes
COMMENT ON COLUMN assets.asset_type IS 'Asset type with codes: Desktop (DSKST), Laptop (LAP), Telephone (TELPH), FAN (FAN), Printer (PRINT), Router (ROUTER), Television (TELV), Office Save Drawer (SAVEDRW), Extension Box (EXTEN), Notice Board White (WHITE/BRD), Notice Board Black (BLACK/BRD), Office Table (TB), Table Side Drawer (OFF/DRAW), Chair (CHAIR), Executive Chair (EX/CHAIR), Deep Freezer (D/FREEZER), Microwave (MICROWAVE), Air Conditioner (AC), Visibility Banner (VBANNER), Generator (GEN)';

COMMENT ON COLUMN assets.unique_code IS 'Unique asset identifier in format: ACOB/HQ/{TYPE_CODE}/{YEAR}/{SERIAL} e.g., ACOB/HQ/DSKST/24/001';

-- Drop device tables since we're starting fresh
DROP TABLE IF EXISTS device_assignments CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
