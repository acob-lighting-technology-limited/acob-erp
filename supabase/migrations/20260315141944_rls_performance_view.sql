-- Materialized lookup table for department lead relationships.
-- Refreshed by trigger on profiles UPDATE to keep it current.
-- Allows RLS policies to do a simple indexed JOIN instead of an array subquery.
--
-- Current RLS policies on audit_logs and help_desk_tickets use EXISTS subqueries
-- with array lookups into lead_departments — evaluated on every row, O(n) per access.
--
-- This table caches the lead_departments array as individual rows, enabling
-- a simple indexed lookup instead.
--
-- Next step (separate migration): rewrite audit_logs "Audit logs select policy"
-- and any other lead_departments array policies to JOIN user_lead_departments
-- instead of using: p.lead_departments @> ARRAY[value] or value = ANY(p.lead_departments)

CREATE TABLE IF NOT EXISTS public.user_lead_departments (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_name TEXT NOT NULL,
  PRIMARY KEY (user_id, department_name)
);

CREATE INDEX IF NOT EXISTS idx_user_lead_departments_user
  ON public.user_lead_departments(user_id);

-- Populate from current profiles data
INSERT INTO public.user_lead_departments (user_id, department_name)
SELECT
  id AS user_id,
  unnest(lead_departments) AS department_name
FROM public.profiles
WHERE lead_departments IS NOT NULL AND array_length(lead_departments, 1) > 0
ON CONFLICT DO NOTHING;

-- Trigger function: keep user_lead_departments in sync when profiles.lead_departments changes
CREATE OR REPLACE FUNCTION public.sync_user_lead_departments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_lead_departments WHERE user_id = NEW.id;
  IF NEW.lead_departments IS NOT NULL AND array_length(NEW.lead_departments, 1) > 0 THEN
    INSERT INTO public.user_lead_departments (user_id, department_name)
    SELECT NEW.id, unnest(NEW.lead_departments)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lead_departments ON public.profiles;
CREATE TRIGGER trg_sync_lead_departments
  AFTER INSERT OR UPDATE OF lead_departments ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_lead_departments();

ALTER TABLE public.user_lead_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uld_select" ON public.user_lead_departments
  FOR SELECT TO authenticated USING (true);;
