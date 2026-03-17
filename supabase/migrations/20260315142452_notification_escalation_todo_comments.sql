-- Add TODO comments to asset notification escalation SECURITY DEFINER functions.
-- These functions currently hardcode 'Executive Management' and 'Corporate Services'.
-- The notification_escalation_rules table (20260315130000) now holds those values.
--
-- TODO: Replace the hardcoded string literals in both functions below with:
--   SELECT department_name FROM notification_escalation_rules WHERE escalation_level = 1  → Corporate Services
--   SELECT department_name FROM notification_escalation_rules WHERE escalation_level = 2  → Executive Management
-- This must be done once notification_escalation_rules is verified in production.

CREATE OR REPLACE FUNCTION public.asset_notification_requester_kind(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
-- TODO: replace hardcoded department names with a lookup from notification_escalation_rules:
--   SELECT department_name FROM notification_escalation_rules WHERE escalation_level = 2  → 'Executive Management'
--   SELECT department_name FROM notification_escalation_rules WHERE escalation_level = 1  → 'Corporate Services'
DECLARE
  v_profile public.profiles%rowtype;
  v_managed_departments text[] := '{}'::text[];
BEGIN
  SELECT *
  INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN 'employee';
  END IF;

  v_managed_departments := coalesce(v_profile.lead_departments, '{}'::text[]);

  IF v_profile.is_department_lead
     AND (
       v_profile.department = 'Executive Management'
       OR 'Executive Management' = ANY(v_managed_departments)
     ) THEN
    RETURN 'md';
  END IF;

  IF v_profile.is_department_lead
     AND (
       v_profile.department = 'Corporate Services'
       OR 'Corporate Services' = ANY(v_managed_departments)
     ) THEN
    RETURN 'hcs';
  END IF;

  IF v_profile.is_department_lead THEN
    RETURN 'dept_lead';
  END IF;

  RETURN 'employee';
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_asset_notification_escalation_recipient(p_user_id uuid)
RETURNS TABLE(recipient_id uuid, recipient_role text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
-- TODO: replace hardcoded 'Corporate Services' and 'Executive Management' with:
--   SELECT department_name FROM notification_escalation_rules WHERE escalation_level = 1
--   SELECT department_name FROM notification_escalation_rules WHERE escalation_level = 2
DECLARE
  v_requester_kind text;
  v_department text;
  v_recipient_id uuid;
  v_hcs_id uuid;
  v_md_id uuid;
BEGIN
  SELECT department
  INTO v_department
  FROM public.profiles
  WHERE id = p_user_id;

  v_requester_kind := public.asset_notification_requester_kind(p_user_id);

  IF v_requester_kind = 'employee' THEN
    v_recipient_id := public.resolve_asset_notification_department_lead(v_department);
    IF v_recipient_id IS NOT NULL AND v_recipient_id <> p_user_id THEN
      recipient_id := v_recipient_id;
      recipient_role := 'Department Lead';
      RETURN NEXT;
    END IF;
    RETURN;
  END IF;

  IF v_requester_kind = 'dept_lead' THEN
    v_hcs_id := public.resolve_asset_notification_department_lead('Corporate Services');
    IF v_hcs_id IS NOT NULL AND v_hcs_id <> p_user_id THEN
      recipient_id := v_hcs_id;
      recipient_role := 'Head of Corporate Services';
      RETURN NEXT;
    END IF;

    v_md_id := public.resolve_asset_notification_department_lead('Executive Management');
    IF v_md_id IS NOT NULL AND v_md_id <> p_user_id AND v_md_id <> coalesce(v_hcs_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      recipient_id := v_md_id;
      recipient_role := 'Managing Director';
      RETURN NEXT;
    END IF;
    RETURN;
  END IF;

  IF v_requester_kind = 'hcs' THEN
    v_recipient_id := public.resolve_asset_notification_department_lead('Executive Management');
    IF v_recipient_id IS NOT NULL AND v_recipient_id <> p_user_id THEN
      recipient_id := v_recipient_id;
      recipient_role := 'Managing Director';
      RETURN NEXT;
    END IF;
    RETURN;
  END IF;

  RETURN;
END;
$$;;
