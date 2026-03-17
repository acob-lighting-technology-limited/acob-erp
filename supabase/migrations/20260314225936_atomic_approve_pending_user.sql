
-- ----------------------------------------------------------------
-- Item 3: Atomic user approval flow.
-- Wraps profile upsert + pending_users delete in a single
-- transaction so they both succeed or both roll back.
-- Auth user creation still happens in the API (requires service key)
-- but profile + cleanup are now atomic at the DB level.
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.atomic_complete_user_approval(
  p_auth_user_id        uuid,
  p_pending_user_id     uuid,
  p_employee_number     text,
  p_first_name          text,
  p_last_name           text,
  p_other_names         text,
  p_department          text,
  p_company_role        text,
  p_company_email       text,
  p_personal_email      text,
  p_phone_number        text,
  p_additional_phone    text,
  p_residential_address text,
  p_office_location     text,
  p_employment_date     date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Upsert the profile record
  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    other_names,
    department,
    company_role,
    role,
    employment_status,
    employee_number,
    company_email,
    personal_email,
    phone_number,
    additional_phone,
    residential_address,
    office_location,
    employment_date,
    updated_at,
    setup_token,
    setup_token_expires_at,
    must_reset_password
  )
  VALUES (
    p_auth_user_id,
    p_first_name,
    p_last_name,
    p_other_names,
    p_department,
    p_company_role,
    'employee',
    'active',
    p_employee_number,
    p_company_email,
    p_personal_email,
    p_phone_number,
    p_additional_phone,
    p_residential_address,
    p_office_location,
    COALESCE(p_employment_date, CURRENT_DATE),
    now(),
    NULL,
    NULL,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name          = EXCLUDED.first_name,
    last_name           = EXCLUDED.last_name,
    other_names         = EXCLUDED.other_names,
    department          = EXCLUDED.department,
    company_role        = EXCLUDED.company_role,
    role                = 'employee',
    employment_status   = 'active',
    employee_number     = EXCLUDED.employee_number,
    company_email       = EXCLUDED.company_email,
    personal_email      = EXCLUDED.personal_email,
    phone_number        = EXCLUDED.phone_number,
    additional_phone    = EXCLUDED.additional_phone,
    residential_address = EXCLUDED.residential_address,
    office_location     = EXCLUDED.office_location,
    employment_date     = EXCLUDED.employment_date,
    updated_at          = now(),
    setup_token         = NULL,
    setup_token_expires_at = NULL,
    must_reset_password = false;

  -- 2. Delete from pending_users atomically in the same transaction
  DELETE FROM public.pending_users WHERE id = p_pending_user_id;

  -- If DELETE affected 0 rows that's acceptable (already cleaned up),
  -- but profile upsert failure will roll back everything.
END;
$$;

COMMENT ON FUNCTION public.atomic_complete_user_approval IS
  'Atomically upserts the approved employee profile and removes the pending_users '
  'record in a single transaction. If either step fails, both roll back — '
  'eliminating the ghost-user data integrity issue.';
;
