-- Persist the caller's IP address and user agent on audit_logs.
--
-- audit_logs.ip_address and audit_logs.user_agent have existed since the
-- original schema but were never written to: every one of the 15k+ rows has
-- them NULL. The application already ships both values inside p_metadata
-- (see buildAuditRpcParams), so this lifts them into the dedicated columns
-- rather than leaving them buried in JSON.
--
-- The signature is intentionally UNCHANGED so this is a true CREATE OR REPLACE:
-- no DROP, no lost grants, and public.assign_asset (the one in-database caller)
-- keeps working untouched.

CREATE OR REPLACE FUNCTION public.log_audit(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_user_id uuid DEFAULT NULL::uuid,
  p_old_values jsonb DEFAULT NULL::jsonb,
  p_new_values jsonb DEFAULT NULL::jsonb,
  p_metadata jsonb DEFAULT NULL::jsonb,
  p_site_id text DEFAULT NULL::text,
  p_department text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_audit_id uuid;
  v_actor_id uuid;
  v_changed_fields text[];
  v_user_agent text;
  v_ip_text text;
  v_ip_address inet;
BEGIN
  -- Never allow authenticated clients to impersonate another actor.
  -- When auth context is absent (service/background contexts), fallback to p_user_id.
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    v_actor_id := p_user_id;
  END IF;

  IF p_new_values IS NOT NULL THEN
    SELECT array_agg(key) INTO v_changed_fields
    FROM jsonb_object_keys(p_new_values) AS key;
  END IF;

  v_user_agent := left(nullif(p_metadata->>'user_agent', ''), 512);
  v_ip_text := nullif(p_metadata->>'ip_address', '');

  -- A malformed forwarded-for header must never fail the audit write.
  BEGIN
    v_ip_address := v_ip_text::inet;
  EXCEPTION
    WHEN others THEN
      v_ip_address := NULL;
  END;

  INSERT INTO public.audit_logs (
    user_id,
    action,
    operation,
    entity_type,
    table_name,
    entity_id,
    record_id,
    old_values,
    new_values,
    changed_fields,
    department,
    metadata,
    site_id,
    status,
    ip_address,
    user_agent
  ) VALUES (
    v_actor_id,
    p_action,
    p_action,
    p_entity_type,
    p_entity_type,
    p_entity_id,
    p_entity_id,
    p_old_values,
    p_new_values,
    v_changed_fields,
    p_department,
    COALESCE(p_metadata, '{}'::jsonb),
    p_site_id,
    'success',
    v_ip_address,
    v_user_agent
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$function$;
