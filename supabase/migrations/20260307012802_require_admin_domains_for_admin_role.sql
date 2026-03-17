ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS check_profiles_admin_requires_domains;

ALTER TABLE public.profiles
ADD CONSTRAINT check_profiles_admin_requires_domains
CHECK (
  role <> 'admin'
  OR COALESCE(array_length(admin_domains, 1), 0) > 0
) NOT VALID;;
