-- Who owns each guarded /admin area. The owner decides who may change things there: they give the
-- Edit (override) access and lend delegations. Until now ownership was worked out from who leads a
-- department, which meant whoever could name a lead could name an owner. This table makes it explicit,
-- edited only from the developer area.
CREATE TABLE IF NOT EXISTS public.edit_area_owners (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area       text NOT NULL,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT edit_area_owners_area_check CHECK (area IN ('hr', 'it', 'corporate_services', 'md_desk')),
  CONSTRAINT edit_area_owners_unique UNIQUE (area, user_id)
);

CREATE INDEX IF NOT EXISTS idx_edit_area_owners_user ON public.edit_area_owners (user_id);

ALTER TABLE public.edit_area_owners ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.edit_area_owners FROM anon, authenticated;
GRANT SELECT ON TABLE public.edit_area_owners TO authenticated;
GRANT ALL ON TABLE public.edit_area_owners TO service_role;

DROP POLICY IF EXISTS edit_area_owners_read ON public.edit_area_owners;
CREATE POLICY edit_area_owners_read ON public.edit_area_owners
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_admin_like());

-- Start from today's leads so nobody loses access: Admin and HR leads own HR (Corporate Services no
-- longer does), IT and Communications leads own IT, Corporate Services leads own Corporate Services.
INSERT INTO public.edit_area_owners (area, user_id)
SELECT 'hr', p.id FROM public.profiles p
WHERE p.is_department_lead AND p.employment_status <> 'exited' AND 'Admin and HR' = ANY (p.lead_departments)
ON CONFLICT (area, user_id) DO NOTHING;

INSERT INTO public.edit_area_owners (area, user_id)
SELECT 'it', p.id FROM public.profiles p
WHERE p.is_department_lead AND p.employment_status <> 'exited' AND 'IT and Communications' = ANY (p.lead_departments)
ON CONFLICT (area, user_id) DO NOTHING;

INSERT INTO public.edit_area_owners (area, user_id)
SELECT 'corporate_services', p.id FROM public.profiles p
WHERE p.is_department_lead AND p.employment_status <> 'exited' AND 'Corporate Services' = ANY (p.lead_departments)
ON CONFLICT (area, user_id) DO NOTHING;

-- Corporate Services becomes a guarded area, so edit grants may name it.
ALTER TABLE public.admin_edit_grants DROP CONSTRAINT IF EXISTS admin_edit_grants_route_key_check;
ALTER TABLE public.admin_edit_grants
  ADD CONSTRAINT admin_edit_grants_route_key_check CHECK (route_key IN (
    'hr.main','hr.employees','hr.departments','hr.lunch','hr.offices',
    'hr.fleet','hr.leave','hr.attendance','hr.pms','hr.pms.cbt.manage','jobdescriptions.main',
    'it.main','security.networkActivity','security.bypassOverride',
    'scorecard.main'
  ));
