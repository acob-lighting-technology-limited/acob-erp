-- Add UUID-based lead department tracking alongside the existing TEXT[] column.
-- The TEXT[] column is kept for backward compatibility during migration.
-- New code should write to lead_department_ids; lead_departments remains as read cache.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lead_department_ids UUID[];

-- Backfill: resolve existing TEXT[] names to UUIDs where possible
UPDATE public.profiles p
SET lead_department_ids = (
  SELECT array_agg(d.id ORDER BY d.name)
  FROM public.departments d
  WHERE d.name = ANY(p.lead_departments)
    AND d.is_active = TRUE
)
WHERE lead_departments IS NOT NULL
  AND array_length(lead_departments, 1) > 0;

CREATE INDEX IF NOT EXISTS idx_profiles_lead_department_ids
  ON public.profiles USING GIN(lead_department_ids);

COMMENT ON COLUMN public.profiles.lead_department_ids IS
  'UUIDs of departments this user leads. Preferred over lead_departments (TEXT[]).
   lead_departments TEXT[] is kept for read compatibility and will be removed in a future migration.';
