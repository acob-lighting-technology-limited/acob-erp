-- Department delegations: a department lead hands some pages of their department console to
-- someone else until a date. The delegate sees that department with only the ticked pages.
-- All writes go through the server (service role); a person can read the rows they are part of.
CREATE TABLE IF NOT EXISTS public.dept_delegations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  delegator_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delegate_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Page keys from lib/dept/delegated-pages.ts (for example 'hr.attendance', 'tasks').
  pages         text[] NOT NULL,
  valid_until   timestamptz NOT NULL,
  revoked_at    timestamptz,
  revoked_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dept_delegations_not_self CHECK (delegator_id <> delegate_id),
  CONSTRAINT dept_delegations_has_pages CHECK (cardinality(pages) > 0)
);

CREATE INDEX IF NOT EXISTS idx_dept_delegations_delegate_active
  ON public.dept_delegations (delegate_id, department_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dept_delegations_department
  ON public.dept_delegations (department_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dept_delegations_delegator
  ON public.dept_delegations (delegator_id);

ALTER TABLE public.dept_delegations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.dept_delegations FROM anon, authenticated;
GRANT SELECT ON TABLE public.dept_delegations TO authenticated;
GRANT ALL ON TABLE public.dept_delegations TO service_role;

DROP POLICY IF EXISTS dept_delegations_read ON public.dept_delegations;
CREATE POLICY dept_delegations_read ON public.dept_delegations
  FOR SELECT TO authenticated
  USING (
    delegate_id = (SELECT auth.uid())
    OR delegator_id = (SELECT auth.uid())
    OR public.is_admin_like()
  );

-- A delegation from the department page can also hand over /admin edit access (Lunch Register,
-- Attendance edit and so on). Those grants point back at the delegation so that withdrawing it,
-- or its end date, takes both away together.
ALTER TABLE public.admin_edit_grants
  ADD COLUMN IF NOT EXISTS dept_delegation_id uuid REFERENCES public.dept_delegations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_admin_edit_grants_dept_delegation
  ON public.admin_edit_grants (dept_delegation_id)
  WHERE dept_delegation_id IS NOT NULL;
