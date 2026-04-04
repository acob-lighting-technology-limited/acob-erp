ALTER TABLE public.performance_reviews
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
