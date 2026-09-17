-- Migration: Rebuild the risk register around the ACOB Risk Register template
-- Description: The first risk_register table was modelled on weekly-report
-- challenges. The register Corporate Services actually runs is a spreadsheet
-- template (one sheet per department) with these columns:
--   S/N · Department/Unit · Risk Name · Description · Causes · Potential Impact ·
--   Inherent Impact (1-5) · Inherent Likelihood (1-5) · Control Owner ·
--   Mitigation Plans · Implementation Timeline · Risk Status
-- This replaces the table with that shape. The old table held no rows in
-- production when this was written (verified 2026-09-17), and nothing depends on it.
--
-- Deliberate additions beyond the spreadsheet:
--   * rating is derived from impact x likelihood (Green 1-4, Yellow 5-12, Red 15-25)
--     and kept separate from status, because the sample sheets used "Risk Status"
--     for both a colour (BGI: "Yellow") and a lifecycle state (HR Admin: "Open").
--   * control owner = department(s) plus an optional accountable person.
--   * timeline = a target date or "continuous", plus a free-text note, so
--     mitigations can be flagged overdue.

DROP TABLE IF EXISTS public.risk_register;

CREATE TABLE public.risk_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- S/N, numbered within the lead department (each department is its own sheet).
  serial_no INT NOT NULL,

  -- "Risk Category/ — Department or Unit". The first unit is the lead and owns
  -- the S/N; joint entries such as "BGI/TECH" list the others as supporting.
  department TEXT NOT NULL REFERENCES public.departments(name) ON UPDATE CASCADE,
  supporting_departments TEXT[] NOT NULL DEFAULT '{}',

  risk_name TEXT NOT NULL CHECK (char_length(btrim(risk_name)) BETWEEN 3 AND 200),
  description TEXT NOT NULL CHECK (char_length(btrim(description)) > 0),
  causes TEXT,
  consequence TEXT,

  impact SMALLINT NOT NULL CHECK (impact BETWEEN 1 AND 5),
  likelihood SMALLINT NOT NULL CHECK (likelihood BETWEEN 1 AND 5),
  score SMALLINT GENERATED ALWAYS AS (impact * likelihood) STORED,
  rating TEXT GENERATED ALWAYS AS (
    CASE
      WHEN impact * likelihood >= 15 THEN 'red'
      WHEN impact * likelihood >= 5 THEN 'yellow'
      ELSE 'green'
    END
  ) STORED,

  control_owner_departments TEXT[] NOT NULL DEFAULT '{}',
  control_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  mitigation_plan TEXT,

  timeline_type TEXT NOT NULL DEFAULT 'by_date' CHECK (timeline_type IN ('by_date', 'continuous')),
  target_date DATE,
  timeline_note TEXT,

  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
  closed_at TIMESTAMPTZ,

  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT risk_register_department_serial_key UNIQUE (department, serial_no),
  CONSTRAINT risk_register_continuous_has_no_date CHECK (timeline_type = 'by_date' OR target_date IS NULL)
);

CREATE INDEX idx_risk_register_department ON public.risk_register(department);
CREATE INDEX idx_risk_register_status ON public.risk_register(status);
CREATE INDEX idx_risk_register_control_owner_id ON public.risk_register(control_owner_id);
CREATE INDEX idx_risk_register_supporting_departments ON public.risk_register USING GIN (supporting_departments);
CREATE INDEX idx_risk_register_control_owner_departments ON public.risk_register USING GIN (control_owner_departments);

-- ---------------------------------------------------------------------------
-- Bookkeeping trigger: S/N per department, audit columns, closed_at.
-- SECURITY DEFINER so the next S/N is computed over every row in the
-- department, not only the rows the caller's RLS lets them see.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.risk_register_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.department IS DISTINCT FROM OLD.department THEN
    PERFORM pg_advisory_xact_lock(hashtext('risk_register:' || NEW.department));
    SELECT COALESCE(MAX(serial_no), 0) + 1
      INTO NEW.serial_no
      FROM public.risk_register
     WHERE department = NEW.department;
  END IF;

  -- A department never supports its own risk.
  NEW.supporting_departments := array_remove(NEW.supporting_departments, NEW.department);

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    NEW.created_at := now();
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;

  NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  NEW.updated_at := now();

  IF NEW.status = 'closed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'closed') THEN
    NEW.closed_at := now();
  ELSIF NEW.status <> 'closed' THEN
    NEW.closed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.risk_register_before_write() FROM anon, authenticated, PUBLIC;

CREATE TRIGGER tr_risk_register_before_write
  BEFORE INSERT OR UPDATE ON public.risk_register
  FOR EACH ROW EXECUTE FUNCTION public.risk_register_before_write();

-- ---------------------------------------------------------------------------
-- RLS
--   read:   admins; anyone whose department is involved (lead, supporting or
--           control owner); leads of an involved department; the named owner
--   create: admins; the lead of the lead department
--   update: admins; the lead of the lead department; the named owner
--   delete: admins
-- ---------------------------------------------------------------------------
ALTER TABLE public.risk_register ENABLE ROW LEVEL SECURITY;

CREATE POLICY "risk_register_select"
ON public.risk_register FOR SELECT TO authenticated
USING (
  public.is_admin_like()
  OR control_owner_id = auth.uid()
  OR (ARRAY[department] || supporting_departments || control_owner_departments)
     && public.current_user_lead_departments()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.department = ANY (ARRAY[risk_register.department]
        || risk_register.supporting_departments
        || risk_register.control_owner_departments)
  )
);

CREATE POLICY "risk_register_insert"
ON public.risk_register FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin_like()
  OR department = ANY (public.current_user_lead_departments())
);

CREATE POLICY "risk_register_update"
ON public.risk_register FOR UPDATE TO authenticated
USING (
  public.is_admin_like()
  OR department = ANY (public.current_user_lead_departments())
  OR control_owner_id = auth.uid()
)
WITH CHECK (
  public.is_admin_like()
  OR department = ANY (public.current_user_lead_departments())
  OR control_owner_id = auth.uid()
);

CREATE POLICY "risk_register_delete"
ON public.risk_register FOR DELETE TO authenticated
USING (public.is_admin_like());

REVOKE ALL ON public.risk_register FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_register TO authenticated;
GRANT ALL ON public.risk_register TO service_role;
