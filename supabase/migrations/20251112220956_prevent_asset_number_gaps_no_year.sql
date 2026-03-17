-- Migration: Update asset deletion prevention to ignore year
-- Prevents deletion of assets if higher-numbered assets exist for the same type (year doesn't matter)
-- Business rule: Cannot delete ACOB/HQ/CHAIR/2023/014 if ACOB/HQ/CHAIR/2024/015 exists

-- Update function to check only asset type, not year
CREATE OR REPLACE FUNCTION check_asset_deletion_allowed()
RETURNS TRIGGER AS $$
DECLARE
  current_serial INTEGER;
  asset_type_val TEXT;
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
    
    -- Check if any asset with same type (regardless of year) has a higher serial number
    SELECT EXISTS(
      SELECT 1
      FROM assets
      WHERE asset_type = asset_type_val
        AND id != OLD.id
        AND extract_serial_number(unique_code) > current_serial
        AND extract_serial_number(unique_code) IS NOT NULL
    ) INTO higher_serial_exists;
    
    -- If higher-numbered asset exists, prevent deletion
    IF higher_serial_exists THEN
      RAISE EXCEPTION 
        'Cannot delete asset %. Higher-numbered assets exist for asset type %. Delete assets in reverse order (highest number first) to maintain sequential numbering.',
        OLD.unique_code,
        asset_type_val
        USING ERRCODE = '23514'; -- check_violation
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Update comment
COMMENT ON FUNCTION check_asset_deletion_allowed IS 
  'Prevents deletion of assets if higher-numbered assets exist for the same type (year doesn''t matter). '
  'Example: Cannot delete ACOB/HQ/CHAIR/2023/014 if ACOB/HQ/CHAIR/2024/015 exists. '
  'Enforces sequential numbering by requiring deletion in reverse order.';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';;
