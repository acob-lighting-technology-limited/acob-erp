-- Migration: Enforce acquisition year order per asset type
-- Prevents creating assets with acquisition years before the latest recorded year for that type
-- Business logic: Cannot "backdate" asset acquisitions after recording newer ones

-- Create function to check acquisition year order
CREATE OR REPLACE FUNCTION check_acquisition_year_order()
RETURNS TRIGGER AS $$
DECLARE
  latest_year INTEGER;
BEGIN
  -- Only check on INSERT (not UPDATE)
  IF TG_OP = 'INSERT' THEN
    -- Get the latest (maximum) acquisition year for this asset type
    SELECT MAX(acquisition_year) INTO latest_year
    FROM assets
    WHERE asset_type = NEW.asset_type;

    -- If there are existing assets of this type and the new year is earlier, reject
    IF latest_year IS NOT NULL AND NEW.acquisition_year < latest_year THEN
      RAISE EXCEPTION 'Cannot create asset with acquisition year %. Latest acquisition year for asset type % is %. New assets must be from year % or later.',
        NEW.acquisition_year,
        NEW.asset_type,
        latest_year,
        latest_year
        USING ERRCODE = '23514'; -- check_violation error code
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce acquisition year order
DROP TRIGGER IF EXISTS enforce_acquisition_year_order ON assets;
CREATE TRIGGER enforce_acquisition_year_order
  BEFORE INSERT ON assets
  FOR EACH ROW
  EXECUTE FUNCTION check_acquisition_year_order();

-- Add comment for documentation
COMMENT ON FUNCTION check_acquisition_year_order IS 
  'Prevents creating assets with acquisition years before the latest year for that asset type. '
  'Example: If TB (Table) exists with year 2025, cannot create TB with year 2024. '
  'Enforces chronological asset acquisition recording.';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

