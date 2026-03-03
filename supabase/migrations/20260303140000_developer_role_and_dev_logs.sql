-- Add highest-privilege developer role and a dedicated developer login log surface.

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'developer';

CREATE OR REPLACE FUNCTION public.has_role(required_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_role text;
BEGIN
  SELECT role::text INTO current_role
  FROM public.profiles
  WHERE id = auth.uid();

  CASE required_role
    WHEN 'visitor' THEN
      RETURN current_role IN ('visitor', 'employee', 'lead', 'admin', 'super_admin', 'developer');
    WHEN 'employee' THEN
      RETURN current_role IN ('employee', 'lead', 'admin', 'super_admin', 'developer');
    WHEN 'lead' THEN
      RETURN current_role IN ('lead', 'admin', 'super_admin', 'developer');
    WHEN 'admin' THEN
      RETURN current_role IN ('admin', 'super_admin', 'developer');
    WHEN 'super_admin' THEN
      RETURN current_role IN ('super_admin', 'developer');
    WHEN 'developer' THEN
      RETURN current_role = 'developer';
    ELSE
      RETURN false;
  END CASE;
END;
$$;

CREATE TABLE IF NOT EXISTS public.dev_login_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role public.user_role NOT NULL,
  ip_address text,
  user_agent text,
  auth_method text,
  login_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT dev_login_logs_auth_method_chk CHECK (
    auth_method IS NULL OR auth_method IN ('password', 'otp')
  )
);

CREATE INDEX IF NOT EXISTS idx_dev_login_logs_login_at_desc
  ON public.dev_login_logs (login_at DESC);

CREATE INDEX IF NOT EXISTS idx_dev_login_logs_user_login_desc
  ON public.dev_login_logs (user_id, login_at DESC);

CREATE INDEX IF NOT EXISTS idx_dev_login_logs_email_login_desc
  ON public.dev_login_logs (email, login_at DESC);

CREATE INDEX IF NOT EXISTS idx_dev_login_logs_ip_login_desc
  ON public.dev_login_logs (ip_address, login_at DESC);

ALTER TABLE public.dev_login_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Developer can read dev login logs" ON public.dev_login_logs;
CREATE POLICY "Developer can read dev login logs"
ON public.dev_login_logs
FOR SELECT
TO authenticated
USING (public.has_role('developer'));

DROP POLICY IF EXISTS "Authenticated users can write own dev login logs" ON public.dev_login_logs;
CREATE POLICY "Authenticated users can write own dev login logs"
ON public.dev_login_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

REVOKE ALL ON TABLE public.dev_login_logs FROM anon;
REVOKE ALL ON TABLE public.dev_login_logs FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.dev_login_logs TO authenticated;
GRANT ALL ON TABLE public.dev_login_logs TO service_role;

CREATE OR REPLACE VIEW public.dev_login_logs_enriched
WITH (security_invoker = true) AS
SELECT
  dll.id,
  dll.user_id,
  dll.email,
  COALESCE(NULLIF(dll.full_name, ''), NULLIF(p.full_name, ''), concat_ws(' ', p.first_name, p.last_name), dll.email) AS full_name,
  dll.role,
  p.department,
  dll.ip_address,
  dll.user_agent,
  dll.auth_method,
  dll.login_at,
  dll.metadata
FROM public.dev_login_logs dll
LEFT JOIN public.profiles p ON p.id = dll.user_id;

GRANT SELECT ON public.dev_login_logs_enriched TO authenticated, service_role;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Super admins can update system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Super admins can delete system settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admins can manage system settings" ON public.system_settings;

DROP POLICY IF EXISTS "Authenticated users can read system settings" ON public.system_settings;
CREATE POLICY "Authenticated users can read system settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Developers can manage system settings" ON public.system_settings;
CREATE POLICY "Developers can manage system settings"
ON public.system_settings
FOR ALL
TO authenticated
USING (public.has_role('developer'))
WITH CHECK (public.has_role('developer'));
