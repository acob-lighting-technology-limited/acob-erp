-- Remove hardcoded demo users that polluted employee numbering and
-- repair the 2026 employee numbers that jumped into the 900 range.

DO $$
DECLARE
  v_current_year INT := 2026;
  v_next_serial INT;
BEGIN
  DROP TRIGGER IF EXISTS trg_profiles_prevent_delete ON public.profiles;
  DROP TRIGGER IF EXISTS trg_profiles_prevent_employee_number_mutation ON public.profiles;

  UPDATE public.audit_logs
  SET user_id = NULL
  WHERE user_id IN (
    '11ed535c-4e96-492c-9877-b03b2b46403e'::UUID,
    'cd8921dc-ea5e-448d-9245-62c01d87887d'::UUID,
    'b98864b7-7287-41de-a19d-82f967e5282b'::UUID,
    '027397f6-4367-419f-bdec-eac4c72c0316'::UUID,
    '1f275142-467e-4dd3-ab49-466561f724a1'::UUID
  );

  -- Delete demo auth users. The profiles row cascades from auth.users.
  DELETE FROM auth.users
  WHERE lower(email) IN (
    'demo.employee@acoblighting.com',
    'demo.reliever@acoblighting.com',
    'demo.lead@acoblighting.com',
    'demo.hr.admin@acoblighting.com',
    'demo.ops.admin@acoblighting.com'
  );

  -- Reassign any real 2026 employees that were pushed into the 900 range
  -- after the demo users reserved 901-905.
  WITH base AS (
    SELECT COALESCE(MAX(CAST(split_part(employee_number, '/', 3) AS INT)), 0) AS max_serial
    FROM public.profiles
    WHERE employee_number ~ ('^ACOB/' || v_current_year::TEXT || '/[0-9]{3}$')
      AND CAST(split_part(employee_number, '/', 3) AS INT) < 900
  ),
  affected AS (
    SELECT
      id,
      ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
    FROM public.profiles
    WHERE employee_number ~ ('^ACOB/' || v_current_year::TEXT || '/[0-9]{3}$')
      AND CAST(split_part(employee_number, '/', 3) AS INT) >= 900
      AND lower(COALESCE(company_email, '')) NOT LIKE 'demo.%@acoblighting.com'
  )
  UPDATE public.profiles AS p
  SET employee_number = format(
    'ACOB/%s/%s',
    v_current_year,
    LPAD((base.max_serial + affected.rn)::TEXT, 3, '0')
  )
  FROM base, affected
  WHERE p.id = affected.id;

  SELECT COALESCE(MAX(CAST(split_part(employee_number, '/', 3) AS INT)), 0) + 1
  INTO v_next_serial
  FROM public.profiles
  WHERE employee_number ~ '^ACOB/[0-9]{4}/[0-9]{3}$';

  PERFORM setval('public.employee_number_seq', v_next_serial, false);

  CREATE TRIGGER trg_profiles_prevent_employee_number_mutation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_employee_number_mutation();

  CREATE TRIGGER trg_profiles_prevent_delete
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_delete();
END;
$$;
