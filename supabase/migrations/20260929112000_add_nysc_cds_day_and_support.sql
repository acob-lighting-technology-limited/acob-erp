-- Migration: Add NYSC CDS day tracking to profiles and pending_users, and support in approval / conversion functions

-- 1. Add nysc_cds_day column to profiles and pending_users
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS nysc_cds_day text CHECK (nysc_cds_day IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday'));

ALTER TABLE public.pending_users
ADD COLUMN IF NOT EXISTS nysc_cds_day text CHECK (nysc_cds_day IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday'));

-- 2. Populate CDS day for the 5 verified NYSC corps members
UPDATE public.profiles
SET nysc_cds_day = 'wednesday', updated_at = now()
WHERE id = 'acc4120b-7fea-4e10-afe8-eb0f4391d5cf'; -- Farouk Mustapha

UPDATE public.profiles
SET nysc_cds_day = 'thursday', updated_at = now()
WHERE id IN (
  '7ee0401a-8ec5-4dbc-97f5-37d852b09303', -- Olorunyomi Shola
  '56a51cde-48b0-49bf-aa11-762fd548c072'  -- Vinny Obikwelu
);

UPDATE public.profiles
SET nysc_cds_day = 'friday', updated_at = now()
WHERE id IN (
  'a7378235-c09f-41d3-b588-7fe6b47232af', -- Blessing Funsho
  '1ea60cc3-3ed2-4a87-8f35-869c77bb4cd3'  -- Chinonyerem Isiguzo
);

-- 3. Update convert_employment_type to support p_cds_day
DROP FUNCTION IF EXISTS public.convert_employment_type(uuid, text, text, uuid);
DROP FUNCTION IF EXISTS public.convert_employment_type(uuid, text, text, uuid, text);

CREATE OR REPLACE FUNCTION public.convert_employment_type(
    p_profile_id uuid,
    p_new_type text,
    p_new_category_code text,
    p_actor uuid,
    p_cds_day text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_number text;
    v_old_type text;
    v_new_number text;
    v_category_id uuid;
    v_clean_cds text;
BEGIN
    -- Get current info
    SELECT employee_number, employment_type
    INTO v_old_number, v_old_type
    FROM public.profiles
    WHERE id = p_profile_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile not found';
    END IF;

    -- Validate new type
    IF p_new_type NOT IN ('full_time', 'part_time', 'contract') THEN
        RAISE EXCEPTION 'Invalid employment type: %', p_new_type;
    END IF;

    -- Resolve category ID if contract
    IF p_new_type = 'contract' THEN
        IF p_new_category_code IS NULL OR trim(p_new_category_code) = '' THEN
            RAISE EXCEPTION 'Category code is required for contract type';
        END IF;

        SELECT id INTO v_category_id
        FROM public.contract_categories
        WHERE code = upper(trim(p_new_category_code)) AND is_active = true;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Active contract category not found for code: %', p_new_category_code;
        END IF;
    ELSE
        v_category_id := NULL;
    END IF;

    -- Generate new number
    v_new_number := public.generate_staff_number(p_new_type, p_new_category_code);

    -- Log to history
    INSERT INTO public.employee_number_history (
        profile_id,
        old_number,
        old_employment_type,
        reason,
        changed_by
    )
    VALUES (
        p_profile_id,
        COALESCE(v_old_number, 'N/A'),
        COALESCE(v_old_type, 'full_time'),
        format('Conversion from %s to %s', COALESCE(v_old_type, 'full_time'), p_new_type),
        p_actor
    );

    -- Validate CDS day if NYSC
    IF upper(trim(COALESCE(p_new_category_code, ''))) = 'NYSC' THEN
        v_clean_cds := lower(nullif(trim(COALESCE(p_cds_day, '')), ''));
        IF v_clean_cds IS NOT NULL AND v_clean_cds NOT IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday') THEN
            RAISE EXCEPTION 'Invalid CDS day: %', p_cds_day;
        END IF;
    ELSE
        v_clean_cds := NULL;
    END IF;

    -- Perform update by temporarily overriding employee number block
    PERFORM set_config('app.allow_employee_number_change', 'on', true);

    UPDATE public.profiles
    SET
        employee_number = v_new_number,
        employment_type = p_new_type,
        contract_category_id = v_category_id,
        nysc_cds_day = v_clean_cds,
        updated_at = now()
    WHERE id = p_profile_id;

    RETURN v_new_number;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.convert_employment_type(uuid, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.convert_employment_type(uuid, text, text, uuid, text) TO service_role;

-- 4. Update atomic_complete_user_approval to persist nysc_cds_day
DROP FUNCTION IF EXISTS public.atomic_complete_user_approval(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, date, text, smallint, text, uuid, text
);
DROP FUNCTION IF EXISTS public.atomic_complete_user_approval(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, date, text, smallint, text, uuid, text, text
);

CREATE OR REPLACE FUNCTION public.atomic_complete_user_approval(
  p_auth_user_id uuid,
  p_pending_user_id uuid,
  p_employee_number text,
  p_first_name text,
  p_last_name text,
  p_other_names text,
  p_department text,
  p_designation text,
  p_company_email text,
  p_personal_email text,
  p_phone_number text,
  p_additional_phone text,
  p_residential_address text,
  p_office_location text,
  p_employment_date date,
  p_birthday text DEFAULT NULL::text,
  p_birth_year smallint DEFAULT NULL::smallint,
  p_employment_type text DEFAULT 'full_time'::text,
  p_contract_category_id uuid DEFAULT NULL::uuid,
  p_gender text DEFAULT NULL::text,
  p_nysc_cds_day text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_department_id uuid;
  v_gender text;
  v_cds_day text;
BEGIN
  SELECT d.id
  INTO v_department_id
  FROM public.departments d
  WHERE lower(trim(d.name)) = lower(trim(p_department))
  LIMIT 1;

  v_gender := lower(nullif(trim(coalesce(p_gender, '')), ''));
  IF v_gender NOT IN ('male', 'female') THEN
    v_gender := NULL;
  END IF;

  -- Fallback to pending_users.nysc_cds_day if not passed explicitly
  v_cds_day := lower(nullif(trim(coalesce(p_nysc_cds_day, '')), ''));
  IF v_cds_day IS NULL AND p_pending_user_id IS NOT NULL THEN
    SELECT lower(nullif(trim(coalesce(nysc_cds_day, '')), ''))
    INTO v_cds_day
    FROM public.pending_users
    WHERE id = p_pending_user_id;
  END IF;

  IF v_cds_day NOT IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday') THEN
    v_cds_day := NULL;
  END IF;

  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    other_names,
    department,
    department_id,
    designation,
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
    birthday,
    birth_year,
    employment_type,
    contract_category_id,
    gender,
    nysc_cds_day,
    updated_at,
    setup_token,
    setup_token_expires_at,
    must_reset_password,
    mailbox_credentials_sent_at
  )
  VALUES (
    p_auth_user_id,
    p_first_name,
    p_last_name,
    p_other_names,
    p_department,
    v_department_id,
    p_designation,
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
    p_birthday,
    p_birth_year,
    p_employment_type,
    p_contract_category_id,
    v_gender,
    v_cds_day,
    now(),
    NULL,
    NULL,
    false,
    NULL
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name             = EXCLUDED.first_name,
    last_name              = EXCLUDED.last_name,
    other_names            = EXCLUDED.other_names,
    department             = EXCLUDED.department,
    department_id          = EXCLUDED.department_id,
    designation            = EXCLUDED.designation,
    role                   = 'employee',
    employment_status      = 'active',
    employee_number        = EXCLUDED.employee_number,
    company_email          = EXCLUDED.company_email,
    personal_email         = EXCLUDED.personal_email,
    phone_number           = EXCLUDED.phone_number,
    additional_phone       = EXCLUDED.additional_phone,
    residential_address    = EXCLUDED.residential_address,
    office_location        = EXCLUDED.office_location,
    employment_date        = EXCLUDED.employment_date,
    birthday               = COALESCE(EXCLUDED.birthday, public.profiles.birthday),
    birth_year             = COALESCE(EXCLUDED.birth_year, public.profiles.birth_year),
    employment_type        = EXCLUDED.employment_type,
    contract_category_id   = EXCLUDED.contract_category_id,
    gender                 = COALESCE(EXCLUDED.gender, public.profiles.gender),
    nysc_cds_day           = COALESCE(EXCLUDED.nysc_cds_day, public.profiles.nysc_cds_day),
    updated_at             = now(),
    setup_token            = NULL,
    setup_token_expires_at = NULL,
    must_reset_password    = false;

  IF p_pending_user_id IS NOT NULL THEN
    DELETE FROM public.pending_users WHERE id = p_pending_user_id;
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.atomic_complete_user_approval(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, date, text, smallint, text, uuid, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_complete_user_approval(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, date, text, smallint, text, uuid, text, text
) TO service_role;
