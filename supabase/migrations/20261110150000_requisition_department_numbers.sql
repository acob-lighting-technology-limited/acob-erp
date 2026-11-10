-- Requisition numbers follow the company's document style:
--   {PR|PC}/{department code}/{YY}/{serial}   e.g. PR/HR/26/001, PC/ACC/26/012
-- PR = Payment Request, PC = Petty Cash. The department code is the one HR sets
-- on the department (departments.department_code), which correspondence uses too.
-- Each form type, department and year counts on its own from 001; the serial
-- widens past 999 rather than wrapping.
--
-- The six requisitions raised before this (REQ-2026-0001..0006, none paid) are
-- renumbered into the new series in the order they were raised. Their old
-- number is kept in previous_number so searches and old notifications still
-- lead to them. Re-running this file changes nothing: only REQ-/PCV- numbers
-- are renumbered.

-- 1. Where an old number is kept -------------------------------------------
ALTER TABLE public.requisitions ADD COLUMN IF NOT EXISTS previous_number text;
COMMENT ON COLUMN public.requisitions.previous_number IS
  'The number this requisition had before the PR/PC department numbering (2026-11). Search only; not shown.';
CREATE INDEX IF NOT EXISTS idx_requisitions_previous_number
  ON public.requisitions (previous_number) WHERE previous_number IS NOT NULL;

-- 2. One counter per form type, department and year ------------------------
ALTER TABLE public.requisition_number_counters
  ADD COLUMN IF NOT EXISTS department_code text NOT NULL DEFAULT '';
ALTER TABLE public.requisition_number_counters
  DROP CONSTRAINT IF EXISTS requisition_number_counters_pkey;
-- The company-wide REQ-/PCV- series is retired with it.
DELETE FROM public.requisition_number_counters WHERE department_code = '';
ALTER TABLE public.requisition_number_counters
  ADD CONSTRAINT requisition_number_counters_pkey PRIMARY KEY (form_type, department_code, year);

-- 3. The format ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.requisition_department_code(p_department text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT upper(btrim(d.department_code))
  FROM public.departments d
  WHERE d.name = p_department
    AND nullif(btrim(d.department_code), '') IS NOT NULL
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.format_requisition_number(
  p_form_type text, p_department_code text, p_year integer, p_serial integer
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_form_type WHEN 'petty_cash' THEN 'PC' ELSE 'PR' END
    || '/' || p_department_code
    || '/' || lpad((p_year % 100)::text, 2, '0')
    || '/' || lpad(p_serial::text, greatest(3, length(p_serial::text)), '0')
$$;

REVOKE ALL ON FUNCTION public.requisition_department_code(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.format_requisition_number(text, text, integer, integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.assign_requisition_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_year integer := extract(year FROM (now() AT TIME ZONE 'Africa/Lagos'))::integer;
  v_code text := public.requisition_department_code(NEW.department);
  v_next integer;
BEGIN
  IF v_code IS NULL THEN
    RAISE EXCEPTION 'requisition_department_code_missing';
  END IF;

  INSERT INTO public.requisition_number_counters (form_type, department_code, year, last_value)
  VALUES (NEW.form_type, v_code, v_year, 1)
  ON CONFLICT (form_type, department_code, year)
  DO UPDATE SET last_value = public.requisition_number_counters.last_value + 1
  RETURNING last_value INTO v_next;

  NEW.requisition_number := public.format_requisition_number(NEW.form_type, v_code, v_year, v_next);
  RETURN NEW;
END;
$$;

-- 4. Renumber the requisitions raised before this ----------------------------
-- The number is otherwise fixed for life; the guard is lifted for this one step.
ALTER TABLE public.requisitions DISABLE TRIGGER trg_requisitions_guard_immutable;

WITH ranked AS (
  SELECT
    r.id,
    r.requisition_number,
    r.form_type,
    public.requisition_department_code(r.department) AS code,
    extract(year FROM (r.created_at AT TIME ZONE 'Africa/Lagos'))::integer AS yr,
    row_number() OVER (
      PARTITION BY r.form_type,
        public.requisition_department_code(r.department),
        extract(year FROM (r.created_at AT TIME ZONE 'Africa/Lagos'))
      ORDER BY r.created_at, r.id
    ) AS n
  FROM public.requisitions r
  WHERE r.requisition_number ~ '^(REQ|PCV)-'
)
UPDATE public.requisitions r
SET previous_number = k.requisition_number,
    -- A department with no code fails here (NOT NULL) rather than getting a bad number.
    requisition_number = public.format_requisition_number(k.form_type, k.code, k.yr, k.n::integer)
FROM ranked k
WHERE r.id = k.id;

ALTER TABLE public.requisitions ENABLE TRIGGER trg_requisitions_guard_immutable;

-- Counters carry on from the renumbered series.
INSERT INTO public.requisition_number_counters (form_type, department_code, year, last_value)
SELECT
  r.form_type,
  split_part(r.requisition_number, '/', 2),
  2000 + split_part(r.requisition_number, '/', 3)::integer,
  max(split_part(r.requisition_number, '/', 4)::integer)
FROM public.requisitions r
WHERE r.requisition_number ~ '^(PR|PC)/[A-Z0-9]+/[0-9]{2}/[0-9]+$'
GROUP BY 1, 2, 3
ON CONFLICT (form_type, department_code, year)
DO UPDATE SET last_value = greatest(public.requisition_number_counters.last_value, EXCLUDED.last_value);
