-- Migration: Create Risk Register table, indexes, RLS policies, and backfill from weekly reports
-- Description: Automatically tracks operational and strategic risks, including challenges ingested from weekly reports.

CREATE TABLE IF NOT EXISTS public.risk_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  department TEXT REFERENCES public.departments(name) ON UPDATE CASCADE ON DELETE SET NULL,
  week_number INT,
  year INT,
  category TEXT NOT NULL DEFAULT 'operational' CHECK (category IN ('operational', 'financial', 'strategic', 'compliance', 'technical', 'reputational', 'health_safety')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  likelihood INT DEFAULT 2 CHECK (likelihood BETWEEN 1 AND 5),
  impact INT DEFAULT 2 CHECK (impact BETWEEN 1 AND 5),
  risk_score INT GENERATED ALWAYS AS (COALESCE(likelihood, 1) * COALESCE(impact, 1)) STORED,
  mitigation_plan TEXT,
  contingency_plan TEXT,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'mitigating', 'resolved', 'closed')),
  report_id UUID REFERENCES public.weekly_reports(id) ON DELETE SET NULL,
  position INT DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for search and filtration
CREATE INDEX IF NOT EXISTS idx_risk_register_department ON public.risk_register(department);
CREATE INDEX IF NOT EXISTS idx_risk_register_report_id ON public.risk_register(report_id);
CREATE INDEX IF NOT EXISTS idx_risk_register_status ON public.risk_register(status);
CREATE INDEX IF NOT EXISTS idx_risk_register_severity ON public.risk_register(severity);
CREATE INDEX IF NOT EXISTS idx_risk_register_week_year ON public.risk_register(year, week_number);
CREATE INDEX IF NOT EXISTS idx_risk_register_owner_id ON public.risk_register(owner_id);

-- Enable RLS
ALTER TABLE public.risk_register ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "risk_register_select" ON public.risk_register;
CREATE POLICY "risk_register_select"
ON public.risk_register FOR SELECT TO authenticated
USING (
  public.is_admin_like()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.is_department_lead = true OR p.department = risk_register.department)
  )
);

DROP POLICY IF EXISTS "risk_register_insert" ON public.risk_register;
CREATE POLICY "risk_register_insert"
ON public.risk_register FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin_like()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_department_lead = true
      AND (p.department = risk_register.department OR risk_register.department IS NULL)
  )
);

DROP POLICY IF EXISTS "risk_register_update" ON public.risk_register;
CREATE POLICY "risk_register_update"
ON public.risk_register FOR UPDATE TO authenticated
USING (
  public.is_admin_like()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.is_department_lead = true AND p.department = risk_register.department
        OR risk_register.owner_id = auth.uid()
      )
  )
)
WITH CHECK (
  public.is_admin_like()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.is_department_lead = true AND p.department = risk_register.department
        OR risk_register.owner_id = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS "risk_register_delete" ON public.risk_register;
CREATE POLICY "risk_register_delete"
ON public.risk_register FOR DELETE TO authenticated
USING (public.is_admin_like());

-- Grants
REVOKE ALL ON public.risk_register FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_register TO authenticated;
GRANT ALL ON public.risk_register TO service_role;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS tr_risk_register_updated_at ON public.risk_register;
CREATE TRIGGER tr_risk_register_updated_at
  BEFORE UPDATE ON public.risk_register
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Historical Backfill: Ingest challenges from already-submitted weekly reports
INSERT INTO public.risk_register (
  title,
  department,
  week_number,
  year,
  category,
  severity,
  likelihood,
  impact,
  status,
  report_id,
  position,
  created_by,
  created_at
)
SELECT
  regexp_replace(trim(raw_line), '^(?:[0-9]+[.)]|[-*•])\s*', '') AS title,
  CASE WHEN EXISTS (SELECT 1 FROM public.departments d WHERE d.name = wr.department) THEN wr.department ELSE NULL END AS department,
  wr.week_number,
  wr.year,
  'operational' AS category,
  'medium' AS severity,
  2 AS likelihood,
  2 AS impact,
  'open' AS status,
  wr.id AS report_id,
  line_idx::int AS position,
  wr.user_id AS created_by,
  wr.created_at
FROM public.weekly_reports wr,
LATERAL unnest(regexp_split_to_array(wr.challenges, E'\r?\n')) WITH ORDINALITY AS t(raw_line, line_idx)
WHERE wr.status = 'submitted'
  AND wr.challenges IS NOT NULL
  AND trim(raw_line) <> ''
  AND length(regexp_replace(trim(raw_line), '^(?:[0-9]+[.)]|[-*•])\s*', '')) > 2
  AND NOT EXISTS (
    SELECT 1 FROM public.risk_register rr
    WHERE rr.report_id = wr.id
      AND rr.position = line_idx::int
  );
