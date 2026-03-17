-- The profiles table has FORCE ROW LEVEL SECURITY enabled, which means
-- even the table owner (postgres) must obey RLS policies.
-- This breaks SECURITY DEFINER functions like has_role(), is_admin(), is_admin_like(), etc.
-- because they run as postgres but auth.uid() returns NULL in that context,
-- so no profile row is found and they always return false.
--
-- Fix: Disable FORCE RLS so SECURITY DEFINER functions can read profiles.
-- Normal RLS still applies to all non-owner roles (authenticated, anon, etc.)

ALTER TABLE public.profiles NO FORCE ROW LEVEL SECURITY;;
