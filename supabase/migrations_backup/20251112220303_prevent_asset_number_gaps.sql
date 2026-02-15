-- Migration: Prevent asset serial number gaps
-- Prevents deletion of assets if higher-numbered assets exist for the same type and year
-- Business rule: Cannot delete ACOB/HQ/CHAIR/2023/014 if ACOB/HQ/CHAIR/2023/015 exists

-- Helper function to extract serial number from unique_code
CREATE OR REPLACE FUNCTION extract_serial_number(unique_code TEXT)
RETURNS INTEGER AS $$
DECLARE
  parts TEXT[];
  serial_str TEXT;
BEGIN
  -- Split by '/' and get the last part (serial number)
  parts := string_to_array(unique_code, '/');
  IF array_length(parts, 1) >= 5 THEN
    serial_str := parts[5];
    -- Try to parse as integer
    BEGIN
      RETURN serial_str::INTEGER;
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if higher-numbered assets exist
CREATE OR REPLACE FUNCTION check_asset_deletion_allowed()
RETURNS TRIGGER AS $$
DECLARE
  current_serial INTEGER;
  asset_type_val TEXT;
  year_val INTEGER;
  higher_serial_exists BOOLEAN;
BEGIN
  -- Only check on DELETE
  IF TG_OP = 'DELETE' THEN
    -- Extract serial number from unique_code
    current_serial := extract_serial_number(OLD.unique_code);
    
    -- If we can't extract serial number, allow deletion (might be old format)
    IF current_serial IS NULL THEN
      RETURN OLD;
    END IF;
    
    asset_type_val := OLD.asset_type;
    year_val := OLD.acquisition_year;
    
    -- Check if any asset with same type and year has a higher serial number
    SELECT EXISTS(
      SELECT 1
      FROM assets
      WHERE asset_type = asset_type_val
        AND acquisition_year = year_val
        AND id != OLD.id
        AND extract_serial_number(unique_code) > current_serial
        AND extract_serial_number(unique_code) IS NOT NULL
    ) INTO higher_serial_exists;
    
    -- If higher-numbered asset exists, prevent deletion
    IF higher_serial_exists THEN
      RAISE EXCEPTION 
        'Cannot delete asset %. Higher-numbered assets exist for asset type % and year %. Delete assets in reverse order (highest number first) to maintain sequential numbering.',
        OLD.unique_code,
        asset_type_val,
        year_val
        USING ERRCODE = '23514'; -- check_violation
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce sequential deletion
DROP TRIGGER IF EXISTS prevent_asset_number_gaps ON assets;
CREATE TRIGGER prevent_asset_number_gaps
  BEFORE DELETE ON assets
  FOR EACH ROW
  EXECUTE FUNCTION check_asset_deletion_allowed();

-- Add comment for documentation
COMMENT ON FUNCTION check_asset_deletion_allowed IS 
  'Prevents deletion of assets if higher-numbered assets exist for the same type and year. '
  'Example: Cannot delete ACOB/HQ/CHAIR/2023/014 if ACOB/HQ/CHAIR/2023/015 exists. '
  'Enforces sequential numbering by requiring deletion in reverse order.';

COMMENT ON FUNCTION extract_serial_number IS 
  'Extracts the serial number (last part) from asset unique_code format: ACOB/HQ/TYPE/YEAR/NUMBER';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

