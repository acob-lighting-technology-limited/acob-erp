-- Edit access on the HR and IT admin routes.
--
-- Until now an admin_routes grant was all-or-nothing: anyone who could open a
-- page could change everything on it, and most admin APIs only checked the admin
-- role. HR and IT now separate VIEW from EDIT.
--
--   VIEW  = the route key is in profiles.admin_routes (unchanged). Developers and
--           super admins view every route.
--   EDIT  = (a) the person leads the route's owning department(s)
--               HR -> Admin and HR + Corporate Services, IT -> IT and Communications
--               (derived from profiles.lead_departments, never hardcoded), or
--           (b) a row below: an explicit grant from a developer / super admin, or a
--               delegation from someone who already holds edit (valid_until required).
--
-- Developers and super admins get NO automatic edit on these routes.
--
-- Grant rows are written only by server routes (service role). A person may read
-- their own rows (the scope resolver reads them with the user's client); admin-like
-- roles may read all rows for Settings > Access.
--
-- Also adds it.main (the IT console: onboarding, mailboxes, Starlink, mail settings)
-- to the admin_routes allowlist, and gives it to every admin who could already reach
-- one of those pages (settings.main, accounts.main for Starlink, or a security
-- route), so nobody loses VIEW on the day this ships. EDIT is not seeded: owners get
-- it from their lead role, everyone else needs a grant or delegation.

-- 1. admin_routes allowlist gains it.main -------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_profiles_admin_routes_allowed;

ALTER TABLE public.profiles
  ADD CONSTRAINT check_profiles_admin_routes_allowed
  CHECK (
    admin_routes IS NULL
    OR admin_routes <@ ARRAY[
      'hr.main','hr.leave','hr.attendance','hr.pms','hr.fleet','hr.resources','hr.pms.cbt.manage',
      'jobdescriptions.main','accounts.main','finance.main','purchasing.main','payroll.main',
      'assets.main','assets.issues','inventory.main',
      'reports.weekly','reports.other','scorecard.main',
      'portfolios.main','projects.main',
      'tasks.main',
      'communications.main','communications.broadcast','communications.meetings',
      'correspondence.main','documentation.main','events.main','feedback.main',
      'helpdesk.main','notifications.main','tools.main',
      'settings.main','auditlogs.main',
      'security.networkActivity','security.bypassOverride',
      'it.main'
    ]::text[]
  );

-- 2. keep VIEW of the IT pages for admins who could already reach them -------------
UPDATE public.profiles
SET admin_routes = array_append(admin_routes, 'it.main')
WHERE role = 'admin'
  AND admin_routes IS NOT NULL
  AND NOT ('it.main' = ANY (admin_routes))
  AND (
    'settings.main' = ANY (admin_routes)
    OR 'accounts.main' = ANY (admin_routes)
    OR 'security.networkActivity' = ANY (admin_routes)
    OR 'security.bypassOverride' = ANY (admin_routes)
  );

-- 3. edit grants and delegations ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_edit_grants (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  route_key      text NOT NULL,
  -- NULL = granted by a developer / super admin. Set = delegated by this person,
  -- who must hold edit on the route when the delegation is made.
  delegated_from uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  granted_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  valid_until    timestamptz,
  revoked_at     timestamptz,
  revoked_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_edit_grants_route_key_check CHECK (route_key IN (
    'hr.main','hr.fleet','hr.leave','hr.attendance','hr.pms','hr.pms.cbt.manage','jobdescriptions.main',
    'it.main','security.networkActivity','security.bypassOverride'
  )),
  -- Nobody grants or delegates to themselves.
  CONSTRAINT admin_edit_grants_not_self CHECK (granted_by IS NULL OR granted_by <> user_id),
  CONSTRAINT admin_edit_grants_not_self_delegation CHECK (delegated_from IS NULL OR delegated_from <> user_id),
  -- A delegation always ends.
  CONSTRAINT admin_edit_grants_delegation_ends CHECK (delegated_from IS NULL OR valid_until IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_admin_edit_grants_user_active
  ON public.admin_edit_grants (user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_edit_grants_delegated_from
  ON public.admin_edit_grants (delegated_from)
  WHERE delegated_from IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_edit_grants_granted_by
  ON public.admin_edit_grants (granted_by)
  WHERE granted_by IS NOT NULL;

ALTER TABLE public.admin_edit_grants ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_edit_grants FROM anon, authenticated;
GRANT SELECT ON TABLE public.admin_edit_grants TO authenticated;
GRANT ALL ON TABLE public.admin_edit_grants TO service_role;

DROP POLICY IF EXISTS admin_edit_grants_read ON public.admin_edit_grants;
CREATE POLICY admin_edit_grants_read ON public.admin_edit_grants
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin_like());
