-- ---------------------------------------------------------------------------
-- Close the SECURITY DEFINER functions that PostgREST exposes to callers who
-- have no business calling them.
--
-- A SECURITY DEFINER function runs as its owner, so it ignores RLS. Every
-- function in public is reachable at /rest/v1/rpc/<name> by whichever role
-- holds EXECUTE. Six of these were executable by `anon` — no sign-in at all.
--
-- Each grant below was checked against actual callers before being revoked;
-- the ones the application really uses keep exactly the role they need.
-- ---------------------------------------------------------------------------

-- purge_network_activity_logs: deletes rows from network_activity_logs and has
-- no authorization check of its own. Anyone on the internet could call it with
-- p_retain_days => 0 and erase the network activity trail. It is a cron
-- function; nothing in the application calls it.
REVOKE EXECUTE ON FUNCTION public.purge_network_activity_logs(integer, integer) FROM anon, authenticated;

-- call_app_endpoint: issues an HTTP request to the app carrying the cron
-- bearer token from Vault. It currently returns early because the Vault
-- secrets are unset, which is the only reason this is not already being
-- abused — restoring those secrets without this revoke would hand anonymous
-- callers the ability to invoke app endpoints as the cron job.
REVOKE EXECUTE ON FUNCTION public.call_app_endpoint(text, text) FROM anon, authenticated;

-- claim_notifications_for_push: claims queued notifications, exposing their
-- contents and marking them consumed. Called only by app/api/cron/push, which
-- uses the service-role key, so neither API role needs it.
REVOKE EXECUTE ON FUNCTION public.claim_notifications_for_push(integer) FROM anon, authenticated;

-- enqueue_asset_notification: writes a notification to an arbitrary user id
-- with arbitrary title and body — a clean phishing primitive, since in-app
-- notifications read as trusted. Called only by the four asset trigger
-- functions (handle_new_asset_assignment, handle_asset_issue_resolution,
-- handle_asset_status_notifications, handle_new_asset_issue), which execute as
-- the table owner rather than through an API role.
REVOKE EXECUTE ON FUNCTION public.enqueue_asset_notification(uuid, uuid, text, text, text, text, timestamptz, text, jsonb)
  FROM anon, authenticated;

-- These two are RLS policy helpers. Policies are evaluated as the querying
-- role, so `authenticated` must keep EXECUTE or the policies that call them
-- start failing. Only `anon` is revoked.
REVOKE EXECUTE ON FUNCTION public.has_assigned_task_in_project(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_project_manager_of(uuid, uuid) FROM anon;

-- ---------------------------------------------------------------------------
-- assign_department_lead: reassigns who leads a department, which decides who
-- gets that department's console and data scope. It validated the department
-- and the incoming lead, but never checked the CALLER — so any signed-in
-- employee could make themselves a department lead by calling the RPC
-- directly, regardless of the admin-only page it is meant to be used from.
--
-- It is called from the browser by components/admin/department-leads-manager,
-- so `authenticated` has to keep EXECUTE; the check belongs inside instead.
--
-- The body below is the deployed function verbatim, with only the caller check
-- added at the top. In particular it still leaves departments.department_head_id
-- to trg_enforce_single_department_lead, and still fills the incoming lead's
-- home department only when they do not already have one.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_department_lead(p_department_id uuid, p_new_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_dept_name   text;
  v_old_lead_id uuid;
BEGIN
  -- Changing department leadership is an administrative act. Without this the
  -- SECURITY DEFINER context made the RPC a self-service privilege escalation.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (select auth.uid())
      AND lower(trim(role::text)) IN ('developer', 'super_admin', 'admin')
  ) THEN
    RAISE EXCEPTION 'not authorized to assign department leads';
  END IF;

  SELECT name, department_head_id
    INTO v_dept_name, v_old_lead_id
  FROM public.departments
  WHERE id = p_department_id;

  IF v_dept_name IS NULL THEN
    RAISE EXCEPTION 'Department not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_new_lead_id AND employment_status = 'active'
  ) THEN
    RAISE EXCEPTION 'New lead profile not found or inactive';
  END IF;

  -- Release the outgoing lead from this department only.
  IF v_old_lead_id IS NOT NULL AND v_old_lead_id <> p_new_lead_id THEN
    UPDATE public.profiles
    SET lead_departments   = array_remove(lead_departments, v_dept_name),
        is_department_lead = COALESCE(
                               array_length(array_remove(lead_departments, v_dept_name), 1), 0
                             ) > 0,
        updated_at         = NOW()
    WHERE id = v_old_lead_id;
  END IF;

  -- Add the department to the incoming lead's set. Their home department is
  -- only filled in when they do not already have one -- leading a second
  -- department must not relocate the employee.
  UPDATE public.profiles
  SET department         = COALESCE(NULLIF(trim(COALESCE(department, '')), ''), v_dept_name),
      department_id      = COALESCE(department_id, p_department_id),
      is_department_lead = true,
      lead_departments   = (
        SELECT array_agg(DISTINCT d ORDER BY d)
        FROM unnest(array_append(COALESCE(profiles.lead_departments, ARRAY[]::text[]), v_dept_name)) AS d
      ),
      updated_at         = NOW()
  WHERE id = p_new_lead_id;

  -- trg_enforce_single_department_lead syncs departments.department_head_id.
END;
$function$;
