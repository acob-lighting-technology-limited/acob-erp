-- Milestone 2: scoped admin model (domain-limited admin access).
-- NULL admin_domains means global admin access for backward compatibility.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS admin_domains text[] DEFAULT NULL;

COMMENT ON COLUMN public.profiles.admin_domains IS
'Optional scoped admin domains. NULL means global admin access.';

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
    'employees',
    'communications'
  ]::text[]
);
