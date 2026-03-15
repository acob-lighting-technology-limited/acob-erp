-- =============================================================================
-- Migration: Atomic user approval + critical indexes + updated_at triggers
-- Date: 2026-03-14
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. ATOMIC EMPLOYEE NUMBER GENERATION FUNCTION
--    Uses pg_advisory_xact_lock to prevent race conditions when two admins
--    approve users simultaneously. The lock is automatically released at the
--    end of the transaction.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_next_employee_number(p_year INT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_number  INT := 0;
  v_last_profile RECORD;
  v_parts        TEXT[];
BEGIN
  -- Acquire an exclusive advisory lock scoped to this transaction.
  -- Key: arbitrary but stable integer (hash of 'employee_number_gen').
  -- This ensures only ONE call to this function executes at a time,
  -- eliminating the check-then-insert race condition.
  PERFORM pg_advisory_xact_lock(7891234567);

  SELECT employee_number
  INTO   v_last_profile
  FROM   public.profiles
  WHERE  employee_number IS NOT NULL
    AND  employee_number LIKE 'ACOB/' || p_year::TEXT || '/%'
  ORDER BY employee_number DESC
  LIMIT 1;

  IF FOUND AND v_last_profile.employee_number IS NOT NULL THEN
    v_parts := string_to_array(v_last_profile.employee_number, '/');
    IF array_length(v_parts, 1) = 3 THEN
      v_last_number := v_parts[3]::INT;
    END IF;
  END IF;

  RETURN 'ACOB/' || p_year::TEXT || '/' || lpad((v_last_number + 1)::TEXT, 3, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.generate_next_employee_number(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_next_employee_number(INT) TO service_role;

COMMENT ON FUNCTION public.generate_next_employee_number(INT) IS
  'Atomically generates the next available employee number for a given year using an
   exclusive advisory lock. Safe for concurrent admin approvals.';


-- ---------------------------------------------------------------------------
-- 2. ATOMIC PROFILE UPSERT + PENDING USER DELETION
--    Wraps the two critical writes in a single DB transaction so they either
--    both succeed or both roll back — eliminating the ghost-record risk.
--
--    Called by the /api/admin/approve-user route after auth user creation.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_user_approval(
  p_auth_user_id          UUID,
  p_pending_user_id       UUID,
  p_employee_number       TEXT,
  p_first_name            TEXT,
  p_last_name             TEXT,
  p_other_names           TEXT,
  p_department            TEXT,
  p_company_role          TEXT,
  p_company_email         TEXT,
  p_personal_email        TEXT,
  p_phone_number          TEXT,
  p_additional_phone      TEXT,
  p_residential_address   TEXT,
  p_office_location       TEXT,
  p_employment_date       TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Upsert profile
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
    p_employment_date,
    NOW(),
    NULL,
    NULL,
    FALSE
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name            = EXCLUDED.first_name,
    last_name             = EXCLUDED.last_name,
    other_names           = EXCLUDED.other_names,
    department            = EXCLUDED.department,
    company_role          = EXCLUDED.company_role,
    role                  = EXCLUDED.role,
    employment_status     = EXCLUDED.employment_status,
    employee_number       = EXCLUDED.employee_number,
    company_email         = EXCLUDED.company_email,
    personal_email        = EXCLUDED.personal_email,
    phone_number          = EXCLUDED.phone_number,
    additional_phone      = EXCLUDED.additional_phone,
    residential_address   = EXCLUDED.residential_address,
    office_location       = EXCLUDED.office_location,
    employment_date       = EXCLUDED.employment_date,
    updated_at            = NOW(),
    setup_token           = NULL,
    setup_token_expires_at= NULL,
    must_reset_password   = FALSE;

  -- Delete the pending user record IN THE SAME TRANSACTION.
  -- If this fails, the profile insert above is also rolled back,
  -- preventing ghost records in either direction.
  DELETE FROM public.pending_users WHERE id = p_pending_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending user % not found during atomic deletion', p_pending_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_user_approval(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_user_approval(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION public.complete_user_approval IS
  'Atomically upserts the employee profile and deletes the pending_users record
   in a single transaction. Called by the approve-user API after auth user creation.';


-- ---------------------------------------------------------------------------
-- 3. UPDATED_AT AUTO-TRIGGER
--    Applies to key tables that have an updated_at column but no trigger.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- profiles
DROP TRIGGER IF EXISTS trg_profiles_set_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- departments
DROP TRIGGER IF EXISTS trg_departments_set_updated_at ON public.departments;
CREATE TRIGGER trg_departments_set_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- assets (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assets') THEN
    DROP TRIGGER IF EXISTS trg_assets_set_updated_at ON public.assets;
    EXECUTE 'CREATE TRIGGER trg_assets_set_updated_at
      BEFORE UPDATE ON public.assets
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
  END IF;
END $$;

-- leave_requests (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leave_requests') THEN
    DROP TRIGGER IF EXISTS trg_leave_requests_set_updated_at ON public.leave_requests;
    EXECUTE 'CREATE TRIGGER trg_leave_requests_set_updated_at
      BEFORE UPDATE ON public.leave_requests
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
  END IF;
END $$;

-- help_desk_tickets (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'help_desk_tickets') THEN
    DROP TRIGGER IF EXISTS trg_help_desk_tickets_set_updated_at ON public.help_desk_tickets;
    EXECUTE 'CREATE TRIGGER trg_help_desk_tickets_set_updated_at
      BEFORE UPDATE ON public.help_desk_tickets
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 4. CRITICAL MISSING INDEXES
-- ---------------------------------------------------------------------------

-- profiles: employment_status — hit on every authenticated request (middleware)
CREATE INDEX IF NOT EXISTS idx_profiles_employment_status
  ON public.profiles (employment_status);

-- profiles: department — used in RLS policies and many queries
CREATE INDEX IF NOT EXISTS idx_profiles_department
  ON public.profiles (department);

-- profiles: lead_departments — array column, requires GIN index for @> / ANY() operators
CREATE INDEX IF NOT EXISTS idx_profiles_lead_departments
  ON public.profiles USING GIN (lead_departments);

-- profiles: company_email — used in auth checks and approval flow
CREATE INDEX IF NOT EXISTS idx_profiles_company_email
  ON public.profiles (company_email);

-- leave_requests: creator_id — user's own leave history
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leave_requests') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_leave_requests_creator_id
      ON public.leave_requests (creator_id)';
  END IF;
END $$;

-- help_desk_tickets: requester timeline queries
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'help_desk_tickets') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_help_desk_tickets_requester_created
      ON public.help_desk_tickets (requester_id, created_at DESC)';
  END IF;
END $$;

-- notifications: user timeline
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notifications_user_created
      ON public.notifications (user_id, created_at DESC)';
  END IF;
END $$;

-- notification_queue: worker batch processing
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notification_queue') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notification_queue_status_process
      ON public.notification_queue (status, process_after)';
  END IF;
END $$;

-- audit_logs: user audit trail
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
      ON public.audit_logs (user_id, created_at DESC)';
  END IF;
END $$;

-- asset_assignments: enforce at most one is_current=TRUE per asset (partial unique index)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'asset_assignments') THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_assignments_one_current_per_asset
      ON public.asset_assignments (asset_id)
      WHERE is_current = TRUE';
  END IF;
END $$;
