-- Migration: Create meeting_challenges table for general meeting departmental challenges
-- Description: Moves weekly report challenges out of Corporate Services Risk Register into a dedicated general meeting challenges table.

CREATE TABLE IF NOT EXISTS public.meeting_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  department TEXT,
  week_number INT NOT NULL,
  year INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'mitigating', 'resolved', 'closed')),
  resolution_note TEXT,
  report_id UUID REFERENCES public.weekly_reports(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meeting_challenges_department ON public.meeting_challenges(department);
CREATE INDEX IF NOT EXISTS idx_meeting_challenges_week_year ON public.meeting_challenges(year, week_number);
CREATE INDEX IF NOT EXISTS idx_meeting_challenges_status ON public.meeting_challenges(status);
CREATE INDEX IF NOT EXISTS idx_meeting_challenges_report_id ON public.meeting_challenges(report_id);

-- Enable RLS
ALTER TABLE public.meeting_challenges ENABLE ROW LEVEL SECURITY;

-- Read policy: Authenticated staff can view general meeting challenges
DROP POLICY IF EXISTS "meeting_challenges_select" ON public.meeting_challenges;
CREATE POLICY "meeting_challenges_select"
ON public.meeting_challenges FOR SELECT TO authenticated
USING (true);

-- Insert policy: Global admins, department leads, or report submitters
DROP POLICY IF EXISTS "meeting_challenges_insert" ON public.meeting_challenges;
CREATE POLICY "meeting_challenges_insert"
ON public.meeting_challenges FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('developer', 'super_admin', 'admin')
        OR p.is_department_lead = true
        OR p.department = meeting_challenges.department
        OR meeting_challenges.department IS NULL
      )
  )
);

-- Update policy: Global admins, or department leads for their own/lead departments, or challenge owner
DROP POLICY IF EXISTS "meeting_challenges_update" ON public.meeting_challenges;
CREATE POLICY "meeting_challenges_update"
ON public.meeting_challenges FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('developer', 'super_admin', 'admin')
        OR (
          p.is_department_lead = true
          AND (
            p.department = meeting_challenges.department
            OR (p.lead_departments IS NOT NULL AND p.lead_departments @> ARRAY[meeting_challenges.department])
          )
        )
        OR meeting_challenges.owner_id = auth.uid()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('developer', 'super_admin', 'admin')
        OR (
          p.is_department_lead = true
          AND (
            p.department = meeting_challenges.department
            OR (p.lead_departments IS NOT NULL AND p.lead_departments @> ARRAY[meeting_challenges.department])
          )
        )
        OR meeting_challenges.owner_id = auth.uid()
      )
  )
);

-- Delete policy: Global admins or department leads
DROP POLICY IF EXISTS "meeting_challenges_delete" ON public.meeting_challenges;
CREATE POLICY "meeting_challenges_delete"
ON public.meeting_challenges FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.role IN ('developer', 'super_admin', 'admin')
        OR (p.is_department_lead = true AND p.department = meeting_challenges.department)
      )
  )
);

REVOKE ALL ON public.meeting_challenges FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_challenges TO authenticated;
GRANT ALL ON public.meeting_challenges TO service_role;

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.handle_meeting_challenges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_meeting_challenges_updated_at ON public.meeting_challenges;
CREATE TRIGGER tr_meeting_challenges_updated_at
  BEFORE UPDATE ON public.meeting_challenges
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_meeting_challenges_updated_at();

-- Backfill from submitted weekly reports
INSERT INTO public.meeting_challenges (
  title,
  department,
  week_number,
  year,
  status,
  report_id,
  position,
  created_by,
  created_at,
  updated_at
)
SELECT
  b.challenge_line AS title,
  wr.department,
  wr.week_number,
  wr.year,
  'open' AS status,
  wr.id AS report_id,
  b.pos AS position,
  wr.user_id AS created_by,
  wr.created_at,
  wr.updated_at
FROM public.weekly_reports wr
CROSS JOIN LATERAL (
  SELECT
    trim(regexp_replace(line, '^\s*[-*•\d]+[.)\]\s]*', '')) AS challenge_line,
    row_number() OVER () - 1 AS pos
  FROM regexp_split_to_table(coalesce(wr.challenges, ''), E'\r?\n') AS line
  WHERE trim(regexp_replace(line, '^\s*[-*•\d]+[.)\]\s]*', '')) <> ''
    AND length(trim(regexp_replace(line, '^\s*[-*•\d]+[.)\]\s]*', ''))) > 2
    AND lower(trim(regexp_replace(line, '^\s*[-*•\d]+[.)\]\s]*', ''))) NOT IN ('none', 'nil', 'n/a', 'no challenge', 'no challenges', 'nothing to report')
) b
WHERE wr.status = 'submitted'
  AND wr.challenges IS NOT NULL
  AND length(trim(wr.challenges)) > 2
  AND NOT EXISTS (
    SELECT 1 FROM public.meeting_challenges mc
    WHERE mc.report_id = wr.id AND mc.position = b.pos
  );

-- Clean up any risk_register entries that were created strictly from weekly report challenges
DELETE FROM public.risk_register
WHERE report_id IS NOT NULL
  AND (status = 'open' OR status IS NULL)
  AND (mitigation_plan IS NULL OR trim(mitigation_plan) = '');
