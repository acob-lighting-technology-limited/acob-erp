DROP FUNCTION IF EXISTS public.extract_serial_number(text) CASCADE;

CREATE OR REPLACE FUNCTION public.extract_serial_number(asset_code text)
 RETURNS text
 LANGUAGE plpgsql
 AS $function$
DECLARE
  v_serial text;
BEGIN
  -- 1. Try Slash Format (ACOB/HQ/TYPE/YEAR/SERIAL)
  -- This handles formats like ACOB/HQ/TELV/2026/006
  v_serial := split_part(asset_code, '/', 5);
  
  -- 2. If empty, try Hyphen Format (Legacy)
  IF v_serial = '' THEN
    v_serial := split_part(asset_code, '-', 3);
  END IF;

  -- 3. Validation: Must be numeric to be a valid serial number
  IF v_serial ~ '^[0-9]+$' THEN
    RETURN v_serial;
  ELSE
    RETURN NULL;
  END IF;
END;
$function$;
;
