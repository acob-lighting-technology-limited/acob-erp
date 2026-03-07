-- Move away from department-lead global bypasses:
-- 1) Finance and Admin&HR department leads that need global route access are promoted to admin with explicit domains.
-- 2) Existing admins with NULL/empty admin_domains are backfilled to explicit full-domain access.

-- Promote finance leads to admin + finance domain.
UPDATE public.profiles
SET
  role = 'admin',
  is_admin = true,
  admin_domains = ARRAY(
    SELECT DISTINCT domain
    FROM unnest(COALESCE(admin_domains, ARRAY[]::text[]) || ARRAY['finance']) AS domain
  ),
  updated_at = now()
WHERE
  is_department_lead = true
  AND (
    COALESCE(department, '') IN ('Accounts', 'Finance')
    OR COALESCE(lead_departments, ARRAY[]::text[]) && ARRAY['Accounts', 'Finance']
  )
  AND role IN ('employee', 'admin');

-- Promote Admin & HR leads to admin + hr domain.
UPDATE public.profiles
SET
  role = 'admin',
  is_admin = true,
  admin_domains = ARRAY(
    SELECT DISTINCT domain
    FROM unnest(COALESCE(admin_domains, ARRAY[]::text[]) || ARRAY['hr']) AS domain
  ),
  updated_at = now()
WHERE
  is_department_lead = true
  AND (
    COALESCE(department, '') = 'Admin & HR'
    OR COALESCE(lead_departments, ARRAY[]::text[]) && ARRAY['Admin & HR']
  )
  AND role IN ('employee', 'admin');

-- Backfill existing admins that still rely on implicit/global NULL domains.
UPDATE public.profiles
SET
  admin_domains = ARRAY[
    'hr',
    'finance',
    'assets',
    'reports',
    'tasks',
    'projects',
    'employees',
    'communications'
  ]::text[],
  updated_at = now()
WHERE
  role = 'admin'
  AND COALESCE(array_length(admin_domains, 1), 0) = 0;
