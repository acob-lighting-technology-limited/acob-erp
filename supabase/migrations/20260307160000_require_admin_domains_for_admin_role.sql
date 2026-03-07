-- Enforce domain-scoped admin assignments going forward.
-- NOTE:
-- 1) Added as NOT VALID to avoid failing on historical admin rows with NULL admin_domains.
-- 2) New inserts/updates must satisfy the check.
-- 3) After backfilling legacy rows, run VALIDATE CONSTRAINT in a follow-up migration.

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS check_profiles_admin_requires_domains;

ALTER TABLE public.profiles
ADD CONSTRAINT check_profiles_admin_requires_domains
CHECK (
  role <> 'admin'
  OR COALESCE(array_length(admin_domains, 1), 0) > 0
) NOT VALID;
