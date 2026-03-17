CREATE OR REPLACE FUNCTION public.check_asset_deletion_allowed()
 RETURNS trigger
 LANGUAGE plpgsql
 AS $function$
DECLARE
  current_serial INTEGER;
  asset_type_val TEXT;
  higher_serial_exists BOOLEAN;
BEGIN
  -- Only check on DELETE
  IF TG_OP = 'DELETE' THEN
    -- Extract serial number from unique_code
    -- We cast the text return to INTEGER. If it is NULL, current_serial will be NULL.
    current_serial := public.extract_serial_number(OLD.unique_code)::INTEGER;
    
    -- If we can't extract serial number, allow deletion (might be old format)
    IF current_serial IS NULL THEN
      RETURN OLD;
    END IF;
    
    asset_type_val := OLD.asset_type;
    
    -- Check if any asset with same type (regardless of year) has a higher serial number
    SELECT EXISTS(
      SELECT 1
      FROM public.assets
      WHERE asset_type = asset_type_val
        AND id != OLD.id
        -- Cast the extracted serial number to INTEGER for comparison
        AND (public.extract_serial_number(unique_code))::INTEGER > current_serial
        AND public.extract_serial_number(unique_code) IS NOT NULL
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
$function$;
;
