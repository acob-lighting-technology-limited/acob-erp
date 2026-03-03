-- Harden audit log writes and reads:
-- 1) Prevent client-side actor spoofing in log_audit()
-- 2) Remove anon access to audit_logs/log_audit
-- 3) Restrict direct inserts to self-authored rows
-- 4) Align SELECT policy with app behavior (admin full, lead department-scoped)

CREATE OR REPLACE FUNCTION public.log_audit(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_user_id uuid DEFAULT NULL,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL,
  p_site_id text DEFAULT NULL,
  p_department text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_audit_id uuid;
  v_actor_id uuid;
  v_changed_fields text[];
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
    status
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
    'success'
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;

-- Lock down function execution to authenticated users and service role only.
REVOKE ALL ON FUNCTION public.log_audit(text, text, text, uuid, jsonb, jsonb, jsonb, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.log_audit(text, text, text, uuid, jsonb, jsonb, jsonb, text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.log_audit(text, text, text, uuid, jsonb, jsonb, jsonb, text, text) FROM service_role;
GRANT EXECUTE ON FUNCTION public.log_audit(text, text, text, uuid, jsonb, jsonb, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit(text, text, text, uuid, jsonb, jsonb, jsonb, text, text) TO service_role;

-- Least-privilege table grants.
REVOKE ALL ON TABLE public.audit_logs FROM anon;
REVOKE ALL ON TABLE public.audit_logs FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;

DROP POLICY IF EXISTS "Audit logs insert policy" ON public.audit_logs;
CREATE POLICY "Audit logs insert policy"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (user_id IS NULL OR user_id = auth.uid())
);

DROP POLICY IF EXISTS "Audit logs select policy" ON public.audit_logs;
CREATE POLICY "Audit logs select policy"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  public.has_role('admin')
  OR (
    public.has_role('lead')
    AND EXISTS (
      SELECT 1
      FROM public.profiles me
      WHERE me.id = auth.uid()
      AND (
        (
          audit_logs.department IS NOT NULL
          AND audit_logs.department = ANY(
            CASE
              WHEN COALESCE(array_length(me.lead_departments, 1), 0) > 0 THEN me.lead_departments
              WHEN me.department IS NOT NULL THEN ARRAY[me.department]::text[]
              ELSE ARRAY[]::text[]
            END
          )
        )
        OR EXISTS (
          SELECT 1
          FROM public.profiles actor
          WHERE actor.id = audit_logs.user_id
          AND actor.department = ANY(
            CASE
              WHEN COALESCE(array_length(me.lead_departments, 1), 0) > 0 THEN me.lead_departments
              WHEN me.department IS NOT NULL THEN ARRAY[me.department]::text[]
              ELSE ARRAY[]::text[]
            END
          )
        )
      )
    )
  )
);
