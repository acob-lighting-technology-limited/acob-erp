-- Create general_meeting_sessions and general_meeting_attendance tables
-- Replaces pen-and-paper tracking with weekly rotating code/QR, biometric verification, and directory dashboard.

BEGIN;

-- 1. General Meeting Sessions (stores the week's 6-digit code, active state, meeting date)
CREATE TABLE IF NOT EXISTS public.general_meeting_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_week integer NOT NULL CHECK (meeting_week BETWEEN 1 AND 53),
  meeting_year integer NOT NULL CHECK (meeting_year BETWEEN 2000 AND 2100),
  meeting_date date NOT NULL,
  code_6_digit varchar(6) NOT NULL CHECK (length(code_6_digit) = 6),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT general_meeting_sessions_week_year UNIQUE (meeting_week, meeting_year)
);

CREATE INDEX IF NOT EXISTS idx_gms_week_year
  ON public.general_meeting_sessions (meeting_week, meeting_year);

DROP TRIGGER IF EXISTS set_general_meeting_sessions_updated_at ON public.general_meeting_sessions;
CREATE TRIGGER set_general_meeting_sessions_updated_at
  BEFORE UPDATE ON public.general_meeting_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. General Meeting Attendance Records
CREATE TABLE IF NOT EXISTS public.general_meeting_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_week integer NOT NULL CHECK (meeting_week BETWEEN 1 AND 53),
  meeting_year integer NOT NULL CHECK (meeting_year BETWEEN 2000 AND 2100),
  meeting_date date NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('present', 'late', 'absent', 'excused', 'on_leave')) DEFAULT 'present',
  attendance_mode text NOT NULL CHECK (attendance_mode IN ('physical', 'virtual', 'hybrid')) DEFAULT 'physical',
  source text NOT NULL CHECK (source IN ('qr_scan', 'code_input', 'manual', 'teams_sync')) DEFAULT 'code_input',
  office_clock_in timestamptz,
  meeting_clock_in timestamptz NOT NULL DEFAULT now(),
  manual_comment text,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT general_meeting_attendance_week_year_user UNIQUE (meeting_week, meeting_year, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gma_week_year
  ON public.general_meeting_attendance (meeting_week, meeting_year);

CREATE INDEX IF NOT EXISTS idx_gma_user_id
  ON public.general_meeting_attendance (user_id);

CREATE INDEX IF NOT EXISTS idx_gma_meeting_date
  ON public.general_meeting_attendance (meeting_date);

DROP TRIGGER IF EXISTS set_general_meeting_attendance_updated_at ON public.general_meeting_attendance;
CREATE TRIGGER set_general_meeting_attendance_updated_at
  BEFORE UPDATE ON public.general_meeting_attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS & Grants
-- ---------------------------------------------------------------------------

ALTER TABLE public.general_meeting_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.general_meeting_sessions FROM anon;

DROP POLICY IF EXISTS "general_meeting_sessions_select" ON public.general_meeting_sessions;
CREATE POLICY "general_meeting_sessions_select"
  ON public.general_meeting_sessions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "general_meeting_sessions_manage" ON public.general_meeting_sessions;
CREATE POLICY "general_meeting_sessions_manage"
  ON public.general_meeting_sessions
  FOR ALL
  TO authenticated
  USING (
    public.is_admin_like()
    OR public.is_corporate_services_member()
  )
  WITH CHECK (
    public.is_admin_like()
    OR public.is_corporate_services_member()
  );

ALTER TABLE public.general_meeting_attendance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.general_meeting_attendance FROM anon;

DROP POLICY IF EXISTS "general_meeting_attendance_select" ON public.general_meeting_attendance;
CREATE POLICY "general_meeting_attendance_select"
  ON public.general_meeting_attendance
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "general_meeting_attendance_insert" ON public.general_meeting_attendance;
CREATE POLICY "general_meeting_attendance_insert"
  ON public.general_meeting_attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_like()
    OR public.is_corporate_services_member()
    OR user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "general_meeting_attendance_update" ON public.general_meeting_attendance;
CREATE POLICY "general_meeting_attendance_update"
  ON public.general_meeting_attendance
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_like()
    OR public.is_corporate_services_member()
    OR user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    public.is_admin_like()
    OR public.is_corporate_services_member()
    OR user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "general_meeting_attendance_delete" ON public.general_meeting_attendance;
CREATE POLICY "general_meeting_attendance_delete"
  ON public.general_meeting_attendance
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin_like()
    OR public.is_corporate_services_member()
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.general_meeting_sessions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.general_meeting_attendance TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
