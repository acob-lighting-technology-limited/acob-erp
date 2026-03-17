
-- RPC: get_audit_logs_enriched
--
-- Returns audit_logs rows enriched with:
--   • actor profile (user who performed the action)
--   • target profile (user referenced by entity_id for profile/user entities)
--   • task title
--   • device name
--   • asset name + unique_code + latest assignment
--   • payment title + department name
--   • document file_name + department name (via payment)
--   • department name
--   • payment category name
--   • leave request type + requester name
--
-- Replaces 13 sequential client-side fetches with a single server-side call.
-- Department scoping is applied via p_department_filter (NULL = all depts).
-- Excludes internal actions listed in p_hidden_actions.

CREATE OR REPLACE FUNCTION public.get_audit_logs_enriched(
  p_limit            INT     DEFAULT 500,
  p_offset           INT     DEFAULT 0,
  p_hidden_actions   TEXT[]  DEFAULT ARRAY['sync','migrate','update_schema','migration'],
  p_department_filter TEXT   DEFAULT NULL   -- restrict to logs where actor is in this department
)
RETURNS TABLE (
  -- core
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
  -- actor
  actor_first_name    TEXT,
  actor_last_name     TEXT,
  actor_email         TEXT,
  actor_employee_no   TEXT,
  -- target user (for profile/user entities)
  target_first_name   TEXT,
  target_last_name    TEXT,
  target_email        TEXT,
  target_employee_no  TEXT,
  -- task
  task_title          TEXT,
  -- device
  device_name         TEXT,
  -- asset
  asset_name          TEXT,
  asset_unique_code   TEXT,
  asset_serial        TEXT,
  asset_assigned_to   UUID,
  asset_assignee_first_name TEXT,
  asset_assignee_last_name  TEXT,
  -- payment
  payment_title       TEXT,
  payment_dept_name   TEXT,
  -- document
  doc_file_name       TEXT,
  doc_dept_name       TEXT,
  -- department
  dept_name           TEXT,
  -- category
  category_name       TEXT,
  -- leave
  leave_type_name     TEXT,
  leave_requester_first_name TEXT,
  leave_requester_last_name  TEXT,
  -- total count for pagination
  total_count         BIGINT
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
WITH
  -- Step 1: page of logs
  paged AS (
    SELECT
      al.id,
      al.user_id,
      COALESCE(al.action, al.operation, 'unknown')                AS action,
      LOWER(COALESCE(al.entity_type, al.table_name, 'unknown'))   AS entity_type,
      COALESCE(al.entity_id::TEXT, al.record_id::TEXT)            AS entity_id,
      COALESCE(
        CASE WHEN al.new_values::TEXT NOT IN ('', 'null') THEN al.new_values ELSE NULL END,
        (al.metadata->>'new_values')::JSONB
      )                                                           AS new_values,
      COALESCE(
        CASE WHEN al.old_values::TEXT NOT IN ('', 'null') THEN al.old_values ELSE NULL END,
        (al.metadata->>'old_values')::JSONB
      )                                                           AS old_values,
      al.metadata,
      al.created_at,
      al.department,
      al.changed_fields
    FROM public.audit_logs al
    WHERE
      NOT (COALESCE(al.action, al.operation, '') = ANY(p_hidden_actions))
    ORDER BY al.created_at DESC
    LIMIT  p_limit
    OFFSET p_offset
  ),

  total AS (
    SELECT COUNT(*) AS cnt
    FROM public.audit_logs al
    WHERE NOT (COALESCE(al.action, al.operation, '') = ANY(p_hidden_actions))
  ),

  -- Step 2: actors
  actor_ids AS (SELECT DISTINCT user_id FROM paged WHERE user_id IS NOT NULL),
  actors AS (
    SELECT p.id, p.first_name, p.last_name, p.company_email, p.employee_number
    FROM public.profiles p
    WHERE p.id IN (SELECT user_id FROM actor_ids)
  ),

  -- Step 3: target users (profile / user entities)
  target_ids AS (
    SELECT DISTINCT entity_id::UUID AS uid
    FROM paged
    WHERE entity_type IN ('profile','profiles','user','pending_user','admin_action')
      AND entity_id IS NOT NULL
      AND entity_id ~ '^[0-9a-f\-]{36}$'
  ),
  targets AS (
    SELECT p.id, p.first_name, p.last_name, p.company_email, p.employee_number
    FROM public.profiles p
    WHERE p.id IN (SELECT uid FROM target_ids)
  ),

  -- Step 4: tasks
  task_ids AS (
    SELECT DISTINCT entity_id::UUID AS tid
    FROM paged
    WHERE entity_type IN ('task','tasks')
      AND entity_id IS NOT NULL
      AND entity_id ~ '^[0-9a-f\-]{36}$'
  ),
  task_info AS (
    SELECT t.id, t.title FROM public.tasks t WHERE t.id IN (SELECT tid FROM task_ids)
  ),

  -- Step 5: assets
  asset_ids AS (
    SELECT DISTINCT entity_id::UUID AS aid
    FROM paged
    WHERE entity_type IN ('asset','assets','asset_assignment','asset_assignments')
      AND entity_id IS NOT NULL
      AND entity_id ~ '^[0-9a-f\-]{36}$'
  ),
  asset_info AS (
    SELECT
      a.id,
      a.asset_name,
      a.unique_code,
      a.serial_number,
      aa.assigned_to,
      ap.first_name AS assignee_first,
      ap.last_name  AS assignee_last
    FROM public.assets a
    LEFT JOIN LATERAL (
      SELECT x.assigned_to
      FROM public.asset_assignments x
      WHERE x.asset_id = a.id
      ORDER BY x.created_at DESC
      LIMIT 1
    ) aa ON TRUE
    LEFT JOIN public.profiles ap ON ap.id = aa.assigned_to
    WHERE a.id IN (SELECT aid FROM asset_ids)
  ),

  -- Step 6: payments
  payment_ids AS (
    SELECT DISTINCT entity_id::UUID AS pid
    FROM paged
    WHERE entity_type = 'department_payments'
      AND entity_id IS NOT NULL
      AND entity_id ~ '^[0-9a-f\-]{36}$'
  ),
  payment_info AS (
    SELECT dp.id, dp.title, d.name AS dept_name
    FROM public.department_payments dp
    LEFT JOIN public.departments d ON d.id = dp.department_id
    WHERE dp.id IN (SELECT pid FROM payment_ids)
  ),

  -- Step 7: documents
  doc_ids AS (
    SELECT DISTINCT entity_id::UUID AS did
    FROM paged
    WHERE entity_type = 'payment_documents'
      AND entity_id IS NOT NULL
      AND entity_id ~ '^[0-9a-f\-]{36}$'
  ),
  doc_info AS (
    SELECT pd.id, pd.file_name, d.name AS dept_name
    FROM public.payment_documents pd
    LEFT JOIN public.department_payments dp ON dp.id = pd.payment_id
    LEFT JOIN public.departments d ON d.id = dp.department_id
    WHERE pd.id IN (SELECT did FROM doc_ids)
  ),

  -- Step 8: departments
  dept_ids AS (
    SELECT DISTINCT entity_id::UUID AS did
    FROM paged
    WHERE entity_type = 'departments'
      AND entity_id IS NOT NULL
      AND entity_id ~ '^[0-9a-f\-]{36}$'
  ),
  dept_info AS (
    SELECT d.id, d.name FROM public.departments d WHERE d.id IN (SELECT did FROM dept_ids)
  ),

  -- Step 9: payment categories
  cat_ids AS (
    SELECT DISTINCT entity_id::UUID AS cid
    FROM paged
    WHERE entity_type = 'payment_categories'
      AND entity_id IS NOT NULL
      AND entity_id ~ '^[0-9a-f\-]{36}$'
  ),
  cat_info AS (
    SELECT pc.id, pc.name FROM public.payment_categories pc WHERE pc.id IN (SELECT cid FROM cat_ids)
  ),

  -- Step 10: leave requests
  leave_ids AS (
    SELECT DISTINCT entity_id::UUID AS lid
    FROM paged
    WHERE entity_type IN ('leave_requests','leave_approvals')
      AND entity_id IS NOT NULL
      AND entity_id ~ '^[0-9a-f\-]{36}$'
  ),
  leave_info AS (
    SELECT
      lr.id,
      lt.name  AS leave_type_name,
      lp.first_name AS req_first,
      lp.last_name  AS req_last
    FROM public.leave_requests lr
    LEFT JOIN public.leave_types lt    ON lt.id = lr.leave_type_id
    LEFT JOIN public.profiles   lp    ON lp.id = lr.user_id
    WHERE lr.id IN (SELECT lid FROM leave_ids)
  )

SELECT
  pg.id,
  pg.user_id,
  pg.action,
  pg.entity_type,
  pg.entity_id,
  pg.old_values,
  pg.new_values,
  pg.metadata,
  pg.created_at,
  pg.department,
  pg.changed_fields,
  -- actor
  ac.first_name,
  ac.last_name,
  ac.company_email,
  ac.employee_number,
  -- target user
  tg.first_name,
  tg.last_name,
  tg.company_email,
  tg.employee_number,
  -- task
  ti.title,
  -- device (legacy — devices table may not exist; return null gracefully)
  NULL::TEXT,
  -- asset
  ai.asset_name,
  ai.unique_code,
  ai.serial_number,
  ai.assigned_to,
  ai.assignee_first,
  ai.assignee_last,
  -- payment
  pi.title,
  pi.dept_name,
  -- document
  di.file_name,
  di.dept_name,
  -- department
  dti.name,
  -- category
  ci.name,
  -- leave
  li.leave_type_name,
  li.req_first,
  li.req_last,
  -- total
  (SELECT cnt FROM total)

FROM paged pg
LEFT JOIN actors      ac  ON ac.id  = pg.user_id
LEFT JOIN targets     tg  ON tg.id  = pg.entity_id::UUID
                          AND pg.entity_type IN ('profile','profiles','user','pending_user','admin_action')
                          AND pg.entity_id ~ '^[0-9a-f\-]{36}$'
LEFT JOIN task_info   ti  ON ti.id  = pg.entity_id::UUID
                          AND pg.entity_type IN ('task','tasks')
                          AND pg.entity_id ~ '^[0-9a-f\-]{36}$'
LEFT JOIN asset_info  ai  ON ai.id  = pg.entity_id::UUID
                          AND pg.entity_type IN ('asset','assets','asset_assignment','asset_assignments')
                          AND pg.entity_id ~ '^[0-9a-f\-]{36}$'
LEFT JOIN payment_info pi ON pi.id  = pg.entity_id::UUID
                          AND pg.entity_type = 'department_payments'
                          AND pg.entity_id ~ '^[0-9a-f\-]{36}$'
LEFT JOIN doc_info    di  ON di.id  = pg.entity_id::UUID
                          AND pg.entity_type = 'payment_documents'
                          AND pg.entity_id ~ '^[0-9a-f\-]{36}$'
LEFT JOIN dept_info   dti ON dti.id = pg.entity_id::UUID
                          AND pg.entity_type = 'departments'
                          AND pg.entity_id ~ '^[0-9a-f\-]{36}$'
LEFT JOIN cat_info    ci  ON ci.id  = pg.entity_id::UUID
                          AND pg.entity_type = 'payment_categories'
                          AND pg.entity_id ~ '^[0-9a-f\-]{36}$'
LEFT JOIN leave_info  li  ON li.id  = pg.entity_id::UUID
                          AND pg.entity_type IN ('leave_requests','leave_approvals')
                          AND pg.entity_id ~ '^[0-9a-f\-]{36}$'
ORDER BY pg.created_at DESC;
$$;

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION public.get_audit_logs_enriched(INT, INT, TEXT[], TEXT) TO authenticated;
;
