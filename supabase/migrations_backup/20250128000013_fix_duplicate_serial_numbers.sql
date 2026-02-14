-- ============================================
-- Fix Duplicate Serial Numbers
-- This migration will:
-- 1. Update the get_next_asset_serial function to work correctly
-- 2. Fix all existing assets with duplicate serial numbers
-- ============================================

-- First, drop and recreate the function to ensure it's correct
DROP FUNCTION IF EXISTS get_next_asset_serial(TEXT, INTEGER);

-- Create the corrected function
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
  WHERE unique_code ~ ('^ACOB/HQ/' || asset_code || '/[0-9]{4}/[0-9]{3}$');
  -- Using regex to ensure we only match valid codes

  -- Format as 3-digit serial (001, 002, etc.)
  serial_str := LPAD(next_serial::TEXT, 3, '0');

  RETURN 'ACOB/HQ/' || asset_code || '/' || year::text || '/' || serial_str;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_next_asset_serial(TEXT, INTEGER) TO authenticated;

-- Comment explaining the logic
COMMENT ON FUNCTION get_next_asset_serial(TEXT, INTEGER) IS 'Generates unique asset code with serial number unique across all years for the same asset type. Format: ACOB/HQ/{ASSET_CODE}/{YEAR}/{SERIAL}. Serial number increments globally for each asset type regardless of year.';

-- ============================================
-- Now fix all existing duplicate serial numbers
-- ============================================

-- Create a temporary function to recalculate all unique codes
CREATE OR REPLACE FUNCTION fix_duplicate_serials()
RETURNS void AS $$
DECLARE
  asset_record RECORD;
  current_serial INTEGER;
  new_unique_code TEXT;
  asset_type_code TEXT;
BEGIN
  -- Process each asset type separately
  FOR asset_type_code IN
    SELECT DISTINCT asset_type FROM assets ORDER BY asset_type
  LOOP
    current_serial := 0;

    -- For each asset of this type, ordered by year then creation date
    FOR asset_record IN
      SELECT id, asset_type, acquisition_year, unique_code, created_at
      FROM assets
      WHERE asset_type = asset_type_code
      ORDER BY acquisition_year ASC, created_at ASC
    LOOP
      current_serial := current_serial + 1;

      -- Generate new unique code with incremented serial
      new_unique_code := 'ACOB/HQ/' || asset_record.asset_type || '/' ||
                        asset_record.acquisition_year::text || '/' ||
                        LPAD(current_serial::TEXT, 3, '0');

      -- Update only if the code has changed
      IF asset_record.unique_code != new_unique_code THEN
        UPDATE assets
        SET unique_code = new_unique_code
        WHERE id = asset_record.id;

        RAISE NOTICE 'Updated asset % from % to %',
          asset_record.id, asset_record.unique_code, new_unique_code;
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the fix
SELECT fix_duplicate_serials();

-- Drop the temporary function
DROP FUNCTION fix_duplicate_serials();

-- ============================================
-- Verify the fix
-- ============================================

-- This will show any remaining duplicates (should be none)
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT unique_code, COUNT(*) as cnt
    FROM assets
    GROUP BY unique_code
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE WARNING 'Still have % duplicate unique codes!', duplicate_count;
  ELSE
    RAISE NOTICE 'All unique codes are now unique! ✓';
  END IF;
END $$;

-- Show summary of serial numbers by asset type
DO $$
DECLARE
  summary_record RECORD;
BEGIN
  RAISE NOTICE '=== Asset Serial Number Summary ===';
  FOR summary_record IN
    SELECT
      asset_type,
      COUNT(*) as total_count,
      MIN(CAST(SUBSTRING(unique_code FROM '[0-9]+$') AS INTEGER)) as min_serial,
      MAX(CAST(SUBSTRING(unique_code FROM '[0-9]+$') AS INTEGER)) as max_serial
    FROM assets
    GROUP BY asset_type
    ORDER BY asset_type
  LOOP
    RAISE NOTICE 'Type: %, Count: %, Serials: % to %',
      summary_record.asset_type,
      summary_record.total_count,
      summary_record.min_serial,
      summary_record.max_serial;
  END LOOP;
END $$;
