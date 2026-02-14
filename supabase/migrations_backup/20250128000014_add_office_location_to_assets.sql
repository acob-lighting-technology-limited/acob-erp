-- ============================================
-- Add office_location column to assets table
-- ============================================

-- Add office_location column to assets table if it doesn't exist
ALTER TABLE assets
ADD COLUMN IF NOT EXISTS office_location TEXT;

-- Add office_location column to asset_assignments table if it doesn't exist
ALTER TABLE asset_assignments
ADD COLUMN IF NOT EXISTS office_location TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_assets_office_location ON assets(office_location);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_office_location ON asset_assignments(office_location);
