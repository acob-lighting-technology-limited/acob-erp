-- Saving the Error Monitor token always failed with "permission denied for
-- table secrets". 20261006100000 locked the row with SELECT ... FOR UPDATE,
-- which needs UPDATE on vault.secrets; the function owner (postgres) only holds
-- SELECT there, because Vault is meant to be changed through vault.create_secret
-- and vault.update_secret, which it can execute. An advisory lock keeps two
-- simultaneous saves from racing to create the secret, without the row lock.

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

  PERFORM pg_advisory_xact_lock(hashtext('error_monitor_management_token'));

  SELECT id INTO v_secret_id
  FROM vault.secrets
  WHERE name = 'error_monitor_management_token';

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
