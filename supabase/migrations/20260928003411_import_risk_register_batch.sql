-- Preserve spreadsheet owner wording that is not a department or named profile,
-- then provide an atomic, idempotent-by-name Admin import RPC.
ALTER TABLE public.risk_register
  ADD COLUMN IF NOT EXISTS control_owner_note TEXT;

CREATE OR REPLACE FUNCTION public.import_risk_register_batch(p_rows JSONB)
RETURNS SETOF public.risk_register
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  inserted public.risk_register%ROWTYPE;
  row_count INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin_like() THEN
    RAISE EXCEPTION 'Only administrators can import the risk register'
      USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Import rows must be a JSON array'
      USING ERRCODE = '22023';
  END IF;

  row_count := jsonb_array_length(p_rows);
  IF row_count < 1 OR row_count > 200 THEN
    RAISE EXCEPTION 'An import must contain between 1 and 200 rows'
      USING ERRCODE = '22023';
  END IF;

  -- Serial allocation and duplicate detection must see one stable register.
  PERFORM pg_advisory_xact_lock(hashtext('risk_register:batch_import'));

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_rows) AS source(department TEXT, risk_name TEXT)
    GROUP BY lower(btrim(source.department)), lower(btrim(source.risk_name))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'The import contains duplicate risk names for one department'
      USING ERRCODE = '23505';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_rows) AS source(department TEXT, risk_name TEXT)
    JOIN public.risk_register existing
      ON lower(btrim(existing.department)) = lower(btrim(source.department))
     AND lower(btrim(existing.risk_name)) = lower(btrim(source.risk_name))
  ) THEN
    RAISE EXCEPTION 'One or more risks already exist in the register'
      USING ERRCODE = '23505';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    INSERT INTO public.risk_register (
      serial_no,
      department,
      supporting_departments,
      risk_name,
      description,
      causes,
      consequence,
      impact,
      likelihood,
      control_owner_departments,
      control_owner_id,
      control_owner_note,
      mitigation_plan,
      timeline_type,
      target_date,
      timeline_note,
      status
    ) VALUES (
      0,
      item->>'department',
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'supporting_departments', '[]'::jsonb))),
      item->>'risk_name',
      item->>'description',
      NULLIF(item->>'causes', ''),
      NULLIF(item->>'consequence', ''),
      (item->>'impact')::SMALLINT,
      (item->>'likelihood')::SMALLINT,
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'control_owner_departments', '[]'::jsonb))),
      NULLIF(item->>'control_owner_id', '')::UUID,
      NULLIF(item->>'control_owner_note', ''),
      NULLIF(item->>'mitigation_plan', ''),
      item->>'timeline_type',
      NULLIF(item->>'target_date', '')::DATE,
      NULLIF(item->>'timeline_note', ''),
      item->>'status'
    )
    RETURNING * INTO inserted;

    RETURN NEXT inserted;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.import_risk_register_batch(JSONB) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_risk_register_batch(JSONB) TO authenticated, service_role;
