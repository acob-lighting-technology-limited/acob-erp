-- Backfill target_value on kpi_assignments from corporate_kpis.target_text
DO $$
DECLARE
  rec RECORD;
  extracted_val numeric;
  cleaned_text text;
  matches text[];
BEGIN
  FOR rec IN 
    SELECT a.id, k.target_text, k.measure_type 
    FROM kpi_assignments a 
    JOIN corporate_kpis k ON k.id = a.kpi_id 
    WHERE a.target_value IS NULL AND k.target_text IS NOT NULL
  LOOP
    extracted_val := NULL;
    cleaned_text := rec.target_text;

    -- 1. Check for billions (e.g. ₦27.2 billion, ₦8 billion)
    IF cleaned_text ~* 'billion' THEN
      matches := regexp_match(cleaned_text, '([0-9]+(?:\.[0-9]+)?)\s*billion', 'i');
      IF matches IS NOT NULL THEN
        extracted_val := matches[1]::numeric;
      END IF;

    -- 2. Check for millions (e.g. $5 million, $15 million)
    ELSIF cleaned_text ~* 'million' THEN
      matches := regexp_match(cleaned_text, '([0-9]+(?:\.[0-9]+)?)\s*million', 'i');
      IF matches IS NOT NULL THEN
        extracted_val := matches[1]::numeric;
      END IF;

    -- 3. Check for percentage (e.g. 100%, 70%, 98%, 3.5%)
    ELSIF cleaned_text ~* '%' THEN
      -- Pick the last percentage in text (e.g. 70% by Q3; 100% by October -> 100)
      matches := regexp_match(cleaned_text, '([0-9]+(?:\.[0-9]+)?)\s*%(?!.*%)', 'i');
      IF matches IS NOT NULL THEN
        extracted_val := matches[1]::numeric;
      ELSIF rec.measure_type = 'percentage' THEN
        extracted_val := 100;
      END IF;

    -- 4. Check for milestones
    ELSIF rec.measure_type = 'milestone' THEN
      matches := regexp_match(cleaned_text, '([0-9]+)\s*milestone', 'i');
      IF matches IS NOT NULL THEN
        extracted_val := matches[1]::numeric;
      ELSE
        extracted_val := 3;
      END IF;

    -- 5. Standard count / numbers
    ELSE
      -- Strip dates (e.g. 31/12/2026) and years (2026)
      cleaned_text := regexp_replace(cleaned_text, '\m\d{1,2}/\d{1,2}/\d{4}\M', '', 'g');
      cleaned_text := regexp_replace(cleaned_text, '\m202[0-9]\M', '', 'g');

      IF cleaned_text ~* '^\s*Both\M' THEN
        extracted_val := 2;
      ELSE
        matches := regexp_match(cleaned_text, '([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+(?:\.[0-9]+)?)');
        IF matches IS NOT NULL THEN
          extracted_val := replace(matches[1], ',', '')::numeric;
        END IF;
      END IF;
    END IF;

    -- If percentage measure type has no number found, default to 100
    IF extracted_val IS NULL AND rec.measure_type = 'percentage' THEN
      extracted_val := 100;
    END IF;

    IF extracted_val IS NOT NULL AND extracted_val > 0 THEN
      UPDATE kpi_assignments 
      SET target_value = extracted_val, updated_at = now() 
      WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;
