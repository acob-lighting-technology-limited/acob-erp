-- Consolidate admin domain model:
-- "employees" domain is merged into "hr".

-- Rewrite existing profile domain arrays.
UPDATE public.profiles
SET admin_domains = CASE
  WHEN admin_domains IS NULL THEN NULL
  ELSE ARRAY(
    SELECT DISTINCT CASE
      WHEN domain = 'employees' THEN 'hr'
      ELSE domain
    END
    FROM unnest(admin_domains) AS domain
  )
END,
updated_at = now()
WHERE admin_domains IS NOT NULL;

-- Refresh allowed-domain constraint without "employees".
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS check_profiles_admin_domains_allowed;

ALTER TABLE public.profiles
ADD CONSTRAINT check_profiles_admin_domains_allowed
CHECK (
  admin_domains IS NULL
  OR admin_domains <@ ARRAY[
    'hr',
    'finance',
    'assets',
    'reports',
    'tasks',
    'projects',
    'communications'
  ]::text[]
);
