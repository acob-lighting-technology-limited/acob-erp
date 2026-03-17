
-- ----------------------------------------------------------------
-- Item 2: Fix race condition in employee ID generation.
-- Use a PostgreSQL sequence so concurrent approvals never collide.
-- The sequence starts at the next number after the highest existing one.
-- ----------------------------------------------------------------

DO $$
DECLARE
  v_last_num  INT;
  v_start     INT;
BEGIN
  -- Find highest existing sequence number across all years
  SELECT COALESCE(MAX(CAST(split_part(employee_number, '/', 3) AS INT)), 0)
  INTO   v_last_num
  FROM   public.profiles
  WHERE  employee_number ~ '^ACOB/[0-9]{4}/[0-9]{3}$';

  v_start := v_last_num + 1;

  -- Create sequence if it doesn't exist, otherwise advance it
  IF NOT EXISTS (
    SELECT 1 FROM pg_sequences
    WHERE schemaname = 'public' AND sequencename = 'employee_number_seq'
  ) THEN
    EXECUTE format('CREATE SEQUENCE public.employee_number_seq START %s', v_start);
  ELSE
    -- Ensure the sequence is ahead of the current max
    PERFORM setval('public.employee_number_seq', v_start, false);
  END IF;
END;
$$;

-- ----------------------------------------------------------------
-- Helper function: generate the next employee number atomically.
-- Called by the API route instead of doing check-then-insert.
-- Returns e.g. "ACOB/2026/042"
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.next_employee_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT format('ACOB/%s/%s',
    EXTRACT(YEAR FROM now())::int,
    LPAD(nextval('public.employee_number_seq')::text, 3, '0')
  );
$$;

COMMENT ON FUNCTION public.next_employee_number() IS
  'Atomically generates the next employee number from a sequence. '
  'Eliminates the check-then-insert race condition in the approval flow.';
;
