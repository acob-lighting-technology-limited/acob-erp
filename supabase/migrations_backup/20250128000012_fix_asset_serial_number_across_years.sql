-- ============================================
-- Fix Asset Serial Number Generation
-- Serial numbers should be unique across ALL years for the same asset type
-- Example: ACOB/HQ/DSKST/2024/001, ACOB/HQ/DSKST/2025/002 (NOT 001)
-- ============================================

-- Drop the old function
DROP FUNCTION IF EXISTS get_next_asset_serial(TEXT, INTEGER);

-- Create new function that generates serial numbers unique across all years
CREATE OR REPLACE FUNCTION get_next_asset_serial(asset_code TEXT, year INTEGER)
RETURNS TEXT AS $$
DECLARE
  next_serial INTEGER;
  serial_str TEXT;
BEGIN
  -- Find the highest serial number for this asset type across ALL years
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(unique_code FROM '[0-9]+$') AS INTEGER
    )
  ), 0) + 1
  INTO next_serial
  FROM assets
  WHERE unique_code LIKE 'ACOB/HQ/' || asset_code || '/%';
  -- Note: Removed the year filter to search across all years

  -- Format as 3-digit serial (001, 002, etc.)
  serial_str := LPAD(next_serial::TEXT, 3, '0');

  RETURN 'ACOB/HQ/' || asset_code || '/' || year::text || '/' || serial_str;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_next_asset_serial(TEXT, INTEGER) TO authenticated;

-- Comment explaining the logic
COMMENT ON FUNCTION get_next_asset_serial(TEXT, INTEGER) IS 'Generates unique asset code with serial number unique across all years for the same asset type. Format: ACOB/HQ/{ASSET_CODE}/{YEAR}/{SERIAL}. Serial number increments globally for each asset type regardless of year.';
