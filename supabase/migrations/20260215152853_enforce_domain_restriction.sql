-- Function to check email domain
CREATE OR REPLACE FUNCTION public.check_email_domain()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email NOT LIKE '%@acoblighting.com' AND NEW.email NOT LIKE '%@org.acoblighting.com' THEN
    RAISE EXCEPTION 'Registration and login are restricted to official ACOB domains (@acoblighting.com and @org.acoblighting.com).';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on auth.users (requires superuser/bypassrls usually, but let's try via public function)
-- Note: If we can't trigger on auth.users directly, we can trigger on public.profiles
-- but auth.users is the root of truth.
DROP TRIGGER IF EXISTS enforce_email_domain_restriction ON auth.users;
CREATE TRIGGER enforce_email_domain_restriction
BEFORE INSERT OR UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.check_email_domain();
;
