-- Error Monitor configuration belongs in Supabase Vault alongside the existing
-- app_base_url and app_cron_secret scheduler secrets, never in hosting or CI env.

CREATE OR REPLACE FUNCTION public.set_error_monitor_management_token(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'vault', 'pg_temp'
AS $$
DECLARE
  v_secret_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('developer') THEN
    RAISE EXCEPTION 'Developer access required';
  END IF;

  IF length(trim(p_token)) < 20 OR length(trim(p_token)) > 500 THEN
    RAISE EXCEPTION 'Invalid management token';
  END IF;

  SELECT id INTO v_secret_id
  FROM vault.secrets
  WHERE name = 'error_monitor_management_token'
  FOR UPDATE;

  IF v_secret_id IS NULL THEN
    PERFORM vault.create_secret(
      trim(p_token),
      'error_monitor_management_token',
      'Scoped Supabase Management API token used only by Error Monitor'
    );
  ELSE
    PERFORM vault.update_secret(
      v_secret_id,
      trim(p_token),
      'error_monitor_management_token',
      'Scoped Supabase Management API token used only by Error Monitor'
    );
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.set_error_monitor_management_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_error_monitor_management_token(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_error_monitor_collector_status()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'vault', 'pg_temp'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('developer') THEN
    RAISE EXCEPTION 'Developer access required';
  END IF;

  RETURN EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'error_monitor_management_token');
END;
$$;

REVOKE ALL ON FUNCTION public.get_error_monitor_collector_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_error_monitor_collector_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_error_monitor_runtime_secrets()
RETURNS TABLE (management_token text, cron_secret text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'vault', 'pg_temp'
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'error_monitor_management_token'),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'app_cron_secret');
END;
$$;

REVOKE ALL ON FUNCTION public.get_error_monitor_runtime_secrets() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_error_monitor_runtime_secrets() TO service_role;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'collect-error-monitor';

SELECT cron.schedule(
  'collect-error-monitor',
  '*/15 * * * *',
  $job$SELECT public.call_app_endpoint('/api/cron/collect-errors', 'GET')$job$
);
