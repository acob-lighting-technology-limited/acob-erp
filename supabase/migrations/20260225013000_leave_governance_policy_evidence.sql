-- Professional leave governance: policy conditions, evidence, life events

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marital_status text DEFAULT 'unspecified',
  ADD COLUMN IF NOT EXISTS has_children boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pregnancy_status text DEFAULT 'unspecified',
  ADD COLUMN IF NOT EXISTS dependent_count integer DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_marital_status_check') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_marital_status_check
      CHECK (marital_status IN ('single', 'married', 'separated', 'divorced', 'widowed', 'unspecified'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_pregnancy_status_check') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_pregnancy_status_check
      CHECK (pregnancy_status IN ('not_pregnant', 'pregnant', 'postpartum', 'unspecified'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_dependent_count_check') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_dependent_count_check
      CHECK (dependent_count >= 0);
  END IF;
END $$;

ALTER TABLE public.leave_policies
  ADD COLUMN IF NOT EXISTS eligibility_conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS required_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS frequency_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS override_allowed boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.employee_life_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_date date NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_life_events_event_type_check') THEN
    ALTER TABLE public.employee_life_events
      ADD CONSTRAINT employee_life_events_event_type_check
      CHECK (event_type IN ('pregnancy', 'childbirth', 'adoption', 'bereavement'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_employee_life_events_employee_id ON public.employee_life_events(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_life_events_type_date ON public.employee_life_events(event_type, event_date DESC);

CREATE TABLE IF NOT EXISTS public.leave_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id uuid NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  file_url text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'pending',
  verified_by uuid REFERENCES public.profiles(id),
  verified_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_evidence_status_check') THEN
    ALTER TABLE public.leave_evidence
      ADD CONSTRAINT leave_evidence_status_check
      CHECK (status IN ('pending', 'verified', 'rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leave_evidence_leave_request_id ON public.leave_evidence(leave_request_id);
CREATE INDEX IF NOT EXISTS idx_leave_evidence_status ON public.leave_evidence(status);

-- Status support for evidence-gated requests
UPDATE public.leave_requests
SET status = 'pending'
WHERE status IS NULL;

-- Seed policy defaults for current catalog (only set if empty conditions/docs)
UPDATE public.leave_policies lp
SET
  eligibility_conditions = CASE
    WHEN lower(lt.code) = 'maternity' THEN '{"requires_pregnancy_event": true, "event_window_days": 365}'::jsonb
    WHEN lower(lt.code) = 'paternity' THEN '{"requires_childbirth_or_adoption_event": true, "event_window_days": 365}'::jsonb
    WHEN lower(lt.code) = 'study' THEN '{"requires_study_purpose": true}'::jsonb
    WHEN lower(lt.code) = 'bereavement' THEN '{"requires_bereavement_event": true}'::jsonb
    ELSE lp.eligibility_conditions
  END,
  required_documents = CASE
    WHEN lower(lt.code) = 'maternity' THEN '["medical_confirmation"]'::jsonb
    WHEN lower(lt.code) = 'paternity' THEN '["birth_or_adoption_proof"]'::jsonb
    WHEN lower(lt.code) = 'study' THEN '["admission_or_exam_letter"]'::jsonb
    WHEN lower(lt.code) = 'bereavement' THEN '["bereavement_declaration"]'::jsonb
    WHEN lower(lt.code) = 'unpaid' THEN '["reason_statement"]'::jsonb
    ELSE lp.required_documents
  END,
  frequency_rules = CASE
    WHEN lower(lt.code) = 'sick' THEN '{"medical_certificate_after_days": 2}'::jsonb
    ELSE lp.frequency_rules
  END
FROM public.leave_types lt
WHERE lt.id = lp.leave_type_id
  AND (
    lp.eligibility_conditions = '{}'::jsonb
    OR lp.required_documents = '[]'::jsonb
    OR lp.frequency_rules = '{}'::jsonb
  );

ALTER TABLE public.leave_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_life_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leave evidence select policy" ON public.leave_evidence;
CREATE POLICY "Leave evidence select policy" ON public.leave_evidence
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.leave_requests lr
      WHERE lr.id = leave_evidence.leave_request_id
        AND (
          lr.user_id = auth.uid()
          OR lr.reliever_id = auth.uid()
          OR lr.supervisor_id = auth.uid()
          OR public.has_role('admin')
        )
    )
  );

DROP POLICY IF EXISTS "Leave evidence insert policy" ON public.leave_evidence;
CREATE POLICY "Leave evidence insert policy" ON public.leave_evidence
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.leave_requests lr
      WHERE lr.id = leave_evidence.leave_request_id
        AND lr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Leave evidence update policy" ON public.leave_evidence;
CREATE POLICY "Leave evidence update policy" ON public.leave_evidence
  FOR UPDATE TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS "Life events select policy" ON public.employee_life_events;
CREATE POLICY "Life events select policy" ON public.employee_life_events
  FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid() OR public.has_role('admin')
  );

DROP POLICY IF EXISTS "Life events insert policy" ON public.employee_life_events;
CREATE POLICY "Life events insert policy" ON public.employee_life_events
  FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = auth.uid() OR public.has_role('admin')
  );

DROP POLICY IF EXISTS "Life events update policy" ON public.employee_life_events;
CREATE POLICY "Life events update policy" ON public.employee_life_events
  FOR UPDATE TO authenticated
  USING (
    employee_id = auth.uid() OR public.has_role('admin')
  )
  WITH CHECK (
    employee_id = auth.uid() OR public.has_role('admin')
  );
