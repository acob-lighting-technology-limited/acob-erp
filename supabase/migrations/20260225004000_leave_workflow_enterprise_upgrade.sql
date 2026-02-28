-- Enterprise leave workflow and policy upgrade

-- Profiles data quality fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS employment_type text,
  ADD COLUMN IF NOT EXISTS work_location text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_gender_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_gender_check
      CHECK (gender IS NULL OR gender IN ('male', 'female', 'prefer_not_to_say', 'unspecified'));
  END IF;
END $$;

-- Leave policy configuration
CREATE TABLE IF NOT EXISTS public.leave_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  annual_days integer NOT NULL DEFAULT 0 CHECK (annual_days >= 0),
  eligibility text NOT NULL DEFAULT 'all' CHECK (eligibility IN ('all', 'female_only', 'male_only', 'custom')),
  min_tenure_months integer NOT NULL DEFAULT 0 CHECK (min_tenure_months >= 0),
  notice_days integer NOT NULL DEFAULT 0 CHECK (notice_days >= 0),
  accrual_mode text NOT NULL DEFAULT 'calendar_days' CHECK (accrual_mode IN ('calendar_days', 'business_days')),
  carry_forward_cap integer NOT NULL DEFAULT 0 CHECK (carry_forward_cap >= 0),
  carry_forward_expiry date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (leave_type_id)
);

CREATE TABLE IF NOT EXISTS public.holiday_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL,
  location text NOT NULL,
  name text NOT NULL,
  is_business_day boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (holiday_date, location)
);

CREATE TABLE IF NOT EXISTS public.approval_sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage text NOT NULL CHECK (stage IN ('reliever_pending', 'supervisor_pending', 'hr_pending')),
  due_hours integer NOT NULL DEFAULT 24 CHECK (due_hours > 0),
  reminder_hours_before integer NOT NULL DEFAULT 4 CHECK (reminder_hours_before >= 0),
  escalate_to_role text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stage)
);

-- Seed SLA defaults
INSERT INTO public.approval_sla_policies (stage, due_hours, reminder_hours_before, escalate_to_role)
VALUES
  ('reliever_pending', 24, 4, 'lead'),
  ('supervisor_pending', 24, 4, 'admin'),
  ('hr_pending', 24, 4, 'super_admin')
ON CONFLICT (stage) DO NOTHING;

-- Backfill leave policies from leave types where absent
INSERT INTO public.leave_policies (leave_type_id, annual_days, eligibility, min_tenure_months, notice_days, accrual_mode)
SELECT lt.id, GREATEST(lt.max_days, 0), 'all', 0, 0, 'calendar_days'
FROM public.leave_types lt
LEFT JOIN public.leave_policies lp ON lp.leave_type_id = lt.id
WHERE lp.id IS NULL;

-- Leave request workflow columns
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS reliever_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS supervisor_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approval_stage text,
  ADD COLUMN IF NOT EXISTS resume_date date,
  ADD COLUMN IF NOT EXISTS reliever_decision_at timestamptz,
  ADD COLUMN IF NOT EXISTS supervisor_decision_at timestamptz,
  ADD COLUMN IF NOT EXISTS hr_decision_at timestamptz,
  ADD COLUMN IF NOT EXISTS reliever_comment text,
  ADD COLUMN IF NOT EXISTS supervisor_comment text,
  ADD COLUMN IF NOT EXISTS hr_comment text,
  ADD COLUMN IF NOT EXISTS workflow_rejection_stage text,
  ADD COLUMN IF NOT EXISTS handover_note text,
  ADD COLUMN IF NOT EXISTS handover_checklist_url text,
  ADD COLUMN IF NOT EXISTS requested_days_mode text,
  ADD COLUMN IF NOT EXISTS original_request_id uuid REFERENCES public.leave_requests(id),
  ADD COLUMN IF NOT EXISTS request_kind text;

UPDATE public.leave_requests
SET approval_stage = CASE
  WHEN status = 'approved' THEN 'completed'
  WHEN status = 'rejected' THEN 'rejected'
  WHEN status = 'cancelled' THEN 'cancelled'
  ELSE 'reliever_pending'
END
WHERE approval_stage IS NULL;

UPDATE public.leave_requests
SET requested_days_mode = 'calendar_days'
WHERE requested_days_mode IS NULL;

UPDATE public.leave_requests
SET request_kind = 'standard'
WHERE request_kind IS NULL;

UPDATE public.leave_requests
SET resume_date = (end_date + INTERVAL '1 day')::date
WHERE resume_date IS NULL;

ALTER TABLE public.leave_requests
  ALTER COLUMN approval_stage SET DEFAULT 'reliever_pending',
  ALTER COLUMN approval_stage SET NOT NULL,
  ALTER COLUMN requested_days_mode SET DEFAULT 'calendar_days',
  ALTER COLUMN requested_days_mode SET NOT NULL,
  ALTER COLUMN request_kind SET DEFAULT 'standard',
  ALTER COLUMN request_kind SET NOT NULL,
  ALTER COLUMN resume_date SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leave_requests_approval_stage_check'
  ) THEN
    ALTER TABLE public.leave_requests
      ADD CONSTRAINT leave_requests_approval_stage_check
      CHECK (approval_stage IN ('reliever_pending', 'supervisor_pending', 'hr_pending', 'completed', 'rejected', 'cancelled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leave_requests_workflow_rejection_stage_check'
  ) THEN
    ALTER TABLE public.leave_requests
      ADD CONSTRAINT leave_requests_workflow_rejection_stage_check
      CHECK (workflow_rejection_stage IS NULL OR workflow_rejection_stage IN ('reliever', 'supervisor', 'hr'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leave_requests_requested_days_mode_check'
  ) THEN
    ALTER TABLE public.leave_requests
      ADD CONSTRAINT leave_requests_requested_days_mode_check
      CHECK (requested_days_mode IN ('calendar_days', 'business_days'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leave_requests_request_kind_check'
  ) THEN
    ALTER TABLE public.leave_requests
      ADD CONSTRAINT leave_requests_request_kind_check
      CHECK (request_kind IN ('standard', 'extension'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leave_requests_reliever_id ON public.leave_requests(reliever_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_supervisor_id ON public.leave_requests(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_approval_stage ON public.leave_requests(approval_stage);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status_stage ON public.leave_requests(status, approval_stage);
CREATE INDEX IF NOT EXISTS idx_holiday_calendar_location_date ON public.holiday_calendar(location, holiday_date);

-- RLS + policies for new tables
ALTER TABLE public.leave_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holiday_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_sla_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leave policies select policy" ON public.leave_policies;
CREATE POLICY "Leave policies select policy" ON public.leave_policies
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Leave policies manage policy" ON public.leave_policies;
CREATE POLICY "Leave policies manage policy" ON public.leave_policies
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS "Holiday calendar select policy" ON public.holiday_calendar;
CREATE POLICY "Holiday calendar select policy" ON public.holiday_calendar
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Holiday calendar manage policy" ON public.holiday_calendar;
CREATE POLICY "Holiday calendar manage policy" ON public.holiday_calendar
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS "SLA policies select policy" ON public.approval_sla_policies;
CREATE POLICY "SLA policies select policy" ON public.approval_sla_policies
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "SLA policies manage policy" ON public.approval_sla_policies;
CREATE POLICY "SLA policies manage policy" ON public.approval_sla_policies
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));
