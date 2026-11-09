-- MD's Desk follows the same pattern as the other guarded areas: its owner (the MD), people acting for
-- the owner (a delegation, with an end date) and overrides given by the owner (admin_edit_grants on
-- 'mddesk.main'). The separate md_desk_delegates list and its page are retired.
--
-- The database still decides who can read and write MD's Desk data, so the two helper functions the
-- row-level security policies call are redefined here. Their names and uses are unchanged.

-- 1. Edit grants may name MD's Desk.
ALTER TABLE public.admin_edit_grants DROP CONSTRAINT IF EXISTS admin_edit_grants_route_key_check;
ALTER TABLE public.admin_edit_grants
  ADD CONSTRAINT admin_edit_grants_route_key_check CHECK (route_key IN (
    'hr.main','hr.employees','hr.departments','hr.lunch','hr.offices',
    'hr.fleet','hr.leave','hr.attendance','hr.pms','hr.pms.cbt.manage','jobdescriptions.main',
    'it.main','security.networkActivity','security.bypassOverride',
    'scorecard.main','mddesk.main'
  ));

-- 2. The MD owns MD's Desk. Taken from the department head of the MD department, not typed in.
INSERT INTO public.edit_area_owners (area, user_id)
SELECT 'md_desk', d.department_head_id
FROM public.departments d
WHERE d.department_code = 'MD' AND d.department_head_id IS NOT NULL
ON CONFLICT (area, user_id) DO NOTHING;

-- 3. Carry the existing delegates over as delegations from the MD, valid for a year. Only delegates who
--    could edit are carried over; a delegation always ends, so it is renewed by the MD each year.
INSERT INTO public.admin_edit_grants (user_id, route_key, delegated_from, granted_by, valid_until)
SELECT dd.profile_id, 'mddesk.main', md.department_head_id, md.department_head_id, now() + interval '1 year'
FROM public.md_desk_delegates dd
CROSS JOIN LATERAL (
  SELECT d.department_head_id FROM public.departments d WHERE d.department_code = 'MD' LIMIT 1
) md
WHERE dd.can_edit
  AND md.department_head_id IS NOT NULL
  AND dd.profile_id <> md.department_head_id
  AND NOT EXISTS (
    SELECT 1 FROM public.admin_edit_grants g
    WHERE g.user_id = dd.profile_id AND g.route_key = 'mddesk.main' AND g.revoked_at IS NULL
  );

-- 4. Membership and edit follow the new model: the MD, an owner named for MD's Desk, or anyone holding a
--    live grant on it (a delegation from the MD, or an override). Every grant is an edit grant.
CREATE OR REPLACE FUNCTION public.is_md_desk_member()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.is_md()
      OR EXISTS (
        SELECT 1 FROM public.edit_area_owners o
        WHERE o.area = 'md_desk' AND o.user_id = (SELECT auth.uid())
      )
      OR EXISTS (
        SELECT 1 FROM public.admin_edit_grants g
        WHERE g.user_id = (SELECT auth.uid())
          AND g.route_key = 'mddesk.main'
          AND g.revoked_at IS NULL
          AND (g.valid_until IS NULL OR g.valid_until > now())
      )
$function$;

CREATE OR REPLACE FUNCTION public.can_edit_md_desk()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.is_md_desk_member()
$function$;
