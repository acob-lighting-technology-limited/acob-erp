CREATE TABLE IF NOT EXISTS public.kss_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roster_id uuid NOT NULL REFERENCES public.kss_weekly_roster(id) ON DELETE CASCADE,
  presenter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  evaluator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score numeric NOT NULL CHECK (score >= 0 AND score <= 100),
  feedback text,
  meeting_week integer NOT NULL,
  meeting_year integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(roster_id, evaluator_id)
);

ALTER TABLE public.kss_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kss_results_insert" ON public.kss_results
  FOR INSERT TO authenticated
  WITH CHECK (evaluator_id = auth.uid());

CREATE POLICY "kss_results_select" ON public.kss_results
  FOR SELECT TO authenticated
  USING (
    presenter_id = auth.uid()
    OR evaluator_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(p.role::text)) IN ('developer', 'super_admin', 'admin')
    )
  );

CREATE POLICY "kss_results_update" ON public.kss_results
  FOR UPDATE TO authenticated
  USING (evaluator_id = auth.uid());
