-- Creates an enriched audit logs RPC that replaces the multi-query waterfall
-- in the admin audit logs page. All join data is returned as JSONB columns
-- so the caller does not need to issue separate queries.

CREATE OR REPLACE FUNCTION public.get_audit_logs_enriched(
  p_limit         INT     DEFAULT 500,
  p_offset        INT     DEFAULT 0,
  p_hidden_actions TEXT[]  DEFAULT ARRAY['sync','migrate','update_schema','migration'],
  p_department_filter TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  -- Standard audit_logs columns
  id              UUID,
  user_id         UUID,
  action          TEXT,
  entity_type     TEXT,
  entity_id       TEXT,
  old_values      JSONB,
  new_values      JSONB,
  metadata        JSONB,
  created_at      TIMESTAMPTZ,
  department      TEXT,
  changed_fields  TEXT[],
  -- Enriched join data
  user_data            JSONB,
  target_user_data     JSONB,
  task_info            JSONB,
  asset_info           JSONB,
  payment_info         JSONB,
  document_info        JSONB,
  department_info      JSONB,
  category_info        JSONB,
  leave_request_info   JSONB,
  device_info          JSONB,
  -- Pagination
  total_count     BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total BIGINT;
BEGIN
  -- Count matching rows first
  SELECT COUNT(*)
    INTO v_total
    FROM audit_logs al
   WHERE (p_hidden_actions IS NULL OR al.action NOT IN (SELECT unnest(p_hidden_actions)))
     AND (
           p_department_filter IS NULL
           OR (array_length(p_department_filter, 1) > 0 AND al.department = ANY(p_department_filter))
           OR (array_length(p_department_filter, 1) IS NULL)
         );

  RETURN QUERY
  SELECT
    al.id,
    al.user_id,
    al.action,
    LOWER(COALESCE(al.entity_type, 'unknown'))          AS entity_type,
    al.entity_id,
    COALESCE(al.old_values, '{}'::JSONB)                AS old_values,
    COALESCE(al.new_values, '{}'::JSONB)                AS new_values,
    COALESCE(al.metadata,   '{}'::JSONB)                AS metadata,
    al.created_at,
    al.department,
    COALESCE(al.changed_fields, ARRAY[]::TEXT[])        AS changed_fields,

    -- Actor profile
    (
      SELECT jsonb_build_object(
        'first_name',       p.first_name,
        'last_name',        p.last_name,
        'company_email',    p.company_email,
        'employee_number',  p.employee_number,
        'department',       p.department
      )
      FROM profiles p
      WHERE p.id = al.user_id
      LIMIT 1
    )                                                   AS user_data,

    -- Target user: explicit target_user_id > assigned_to > entity if profile
    (
      SELECT jsonb_build_object(
        'first_name',       p.first_name,
        'last_name',        p.last_name,
        'company_email',    p.company_email,
        'employee_number',  p.employee_number,
        'department',       p.department
      )
      FROM profiles p
      WHERE p.id = (
        CASE
          WHEN (al.new_values ->> 'target_user_id') IS NOT NULL
               AND (al.new_values ->> 'target_user_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN (al.new_values ->> 'target_user_id')::UUID
          WHEN (al.new_values ->> 'assigned_to') IS NOT NULL
               AND (al.new_values ->> 'assigned_to') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN (al.new_values ->> 'assigned_to')::UUID
          WHEN LOWER(COALESCE(al.entity_type, '')) IN ('profile', 'profiles', 'user')
               AND al.entity_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN al.entity_id::UUID
          ELSE NULL
        END
      )
      LIMIT 1
    )                                                   AS target_user_data,

    -- Task info
    (
      SELECT jsonb_build_object('title', t.title)
      FROM tasks t
      WHERE t.id::TEXT = al.entity_id
        AND LOWER(COALESCE(al.entity_type, '')) IN ('task', 'tasks')
      LIMIT 1
    )                                                   AS task_info,

    -- Asset info (joins assets + current assignment)
    (
      SELECT jsonb_build_object(
        'asset_name',       a.asset_name,
        'unique_code',      a.unique_code,
        'serial_number',    a.serial_number,
        'assignment_type',  aa.assignment_type,
        'assigned_to',      aa.assigned_to::TEXT,
        'assigned_to_user', CASE
          WHEN aa.assigned_to IS NOT NULL THEN (
            SELECT jsonb_build_object('first_name', p2.first_name, 'last_name', p2.last_name)
            FROM profiles p2 WHERE p2.id = aa.assigned_to LIMIT 1
          )
          ELSE NULL
        END
      )
      FROM assets a
      LEFT JOIN asset_assignments aa ON aa.asset_id = a.id AND aa.is_current = TRUE
      WHERE a.id::TEXT = CASE
        WHEN LOWER(COALESCE(al.entity_type, '')) LIKE '%asset_assign%'
        THEN COALESCE(al.new_values ->> 'asset_id', al.old_values ->> 'asset_id', al.entity_id)
        ELSE al.entity_id
      END
        AND LOWER(COALESCE(al.entity_type, '')) LIKE '%asset%'
      LIMIT 1
    )                                                   AS asset_info,

    -- Payment info (department_payments)
    (
      SELECT jsonb_build_object(
        'title',           dp.title,
        'amount',          dp.amount,
        'currency',        dp.currency,
        'department_name', d2.name
      )
      FROM department_payments dp
      LEFT JOIN departments d2 ON d2.id = dp.department_id
      WHERE dp.id::TEXT = al.entity_id
        AND LOWER(COALESCE(al.entity_type, '')) IN ('department_payment', 'department_payments', 'payment')
      LIMIT 1
    )                                                   AS payment_info,

    -- Document info (payment_documents)
    (
      SELECT jsonb_build_object(
        'file_name',       pd.file_name,
        'document_type',   pd.document_type,
        'department_name', d3.name
      )
      FROM payment_documents pd
      LEFT JOIN department_payments dp2 ON dp2.id = pd.payment_id
      LEFT JOIN departments d3 ON d3.id = dp2.department_id
      WHERE pd.id::TEXT = al.entity_id
        AND LOWER(COALESCE(al.entity_type, '')) IN ('payment_document', 'payment_documents', 'document')
      LIMIT 1
    )                                                   AS document_info,

    -- Department info
    (
      SELECT jsonb_build_object('name', d4.name)
      FROM departments d4
      WHERE d4.id::TEXT = al.entity_id
        AND LOWER(COALESCE(al.entity_type, '')) IN ('department', 'departments')
      LIMIT 1
    )                                                   AS department_info,

    -- Payment category info
    (
      SELECT jsonb_build_object('name', pc.name)
      FROM payment_categories pc
      WHERE pc.id::TEXT = al.entity_id
        AND LOWER(COALESCE(al.entity_type, '')) IN ('payment_category', 'payment_categories', 'category')
      LIMIT 1
    )                                                   AS category_info,

    -- Leave request info
    (
      SELECT jsonb_build_object(
        'user_id',          lr.user_id::TEXT,
        'leave_type_name',  lt.name,
        'requester_user', (
          SELECT jsonb_build_object('first_name', p3.first_name, 'last_name', p3.last_name)
          FROM profiles p3 WHERE p3.id = lr.user_id LIMIT 1
        )
      )
      FROM leave_requests lr
      LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
      WHERE lr.id::TEXT = al.entity_id
        AND LOWER(COALESCE(al.entity_type, '')) IN ('leave_request', 'leave_requests')
      LIMIT 1
    )                                                   AS leave_request_info,

    -- Device info (assets where entity_type contains 'device')
    (
      SELECT jsonb_build_object(
        'device_name',      a2.asset_name,
        'assigned_to',      aa2.assigned_to::TEXT,
        'assigned_to_user', CASE
          WHEN aa2.assigned_to IS NOT NULL THEN (
            SELECT jsonb_build_object('first_name', p4.first_name, 'last_name', p4.last_name)
            FROM profiles p4 WHERE p4.id = aa2.assigned_to LIMIT 1
          )
          ELSE NULL
        END
      )
      FROM assets a2
      LEFT JOIN asset_assignments aa2 ON aa2.asset_id = a2.id AND aa2.is_current = TRUE
      WHERE a2.id::TEXT = al.entity_id
        AND LOWER(COALESCE(al.entity_type, '')) LIKE '%device%'
      LIMIT 1
    )                                                   AS device_info,

    v_total                                             AS total_count

  FROM audit_logs al
  WHERE (p_hidden_actions IS NULL OR al.action NOT IN (SELECT unnest(p_hidden_actions)))
    AND (
          p_department_filter IS NULL
          OR (array_length(p_department_filter, 1) > 0 AND al.department = ANY(p_department_filter))
          OR (array_length(p_department_filter, 1) IS NULL)
        )
  ORDER BY al.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Allow authenticated users (and service role) to call this function.
-- The function itself runs as SECURITY DEFINER so it bypasses RLS on the
-- underlying tables; callers must still be authenticated.
GRANT EXECUTE ON FUNCTION public.get_audit_logs_enriched(INT, INT, TEXT[], TEXT[])
  TO authenticated, service_role;
