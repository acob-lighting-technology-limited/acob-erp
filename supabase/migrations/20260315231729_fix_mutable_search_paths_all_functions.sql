
-- Fix mutable search_path on all public functions.
-- A missing search_path allows malicious schemas to shadow public functions.
-- Adding SET search_path = public, pg_temp locks each function to the correct schema.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.help_desk_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN new.updated_at = now(); RETURN new; END; $$;

CREATE OR REPLACE FUNCTION public.correspondence_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN new.updated_at = now(); RETURN new; END; $$;

CREATE OR REPLACE FUNCTION public.assign_work_item_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.work_item_number IS NULL THEN
    NEW.work_item_number := 'TSK-' || LPAD(nextval('public.work_item_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.generate_help_desk_ticket_number()
RETURNS text LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE next_number bigint;
BEGIN
  next_number := nextval('public.help_desk_ticket_number_seq');
  RETURN 'HD-' || lpad(next_number::text, 6, '0');
END; $$;

CREATE OR REPLACE FUNCTION public.help_desk_before_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF new.ticket_number IS NULL OR btrim(new.ticket_number) = '' THEN
    new.ticket_number := public.generate_help_desk_ticket_number();
  END IF;
  IF new.submitted_at IS NULL THEN new.submitted_at := now(); END IF;
  RETURN new;
END; $$;

CREATE OR REPLACE FUNCTION public.check_email_domain()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.email NOT LIKE '%@acoblighting.com' AND NEW.email NOT LIKE '%@org.acoblighting.com' THEN
    RAISE EXCEPTION 'Registration and login are restricted to official ACOB domains (@acoblighting.com and @org.acoblighting.com).';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.office_week_year_start(p_year integer)
RETURNS date LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  SELECT make_date(p_year, 1, 12);
$$;

CREATE OR REPLACE FUNCTION public.office_weeks_in_year(p_year integer)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  SELECT ceil(
    extract(epoch FROM (
      public.office_week_year_start(p_year + 1)::timestamp
      - public.office_week_year_start(p_year)::timestamp
    )) / 604800.0
  )::integer;
$$;

CREATE OR REPLACE FUNCTION public.lead_department_name(p profiles)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  SELECT p.lead_departments[1];
$$;

CREATE OR REPLACE FUNCTION public.get_current_iso_week()
RETURNS TABLE(week integer, year integer) LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
DECLARE
  now_date date := CURRENT_DATE;
  jan4 date; dow int; w1_monday date; diff int;
BEGIN
  jan4 := make_date(EXTRACT(YEAR FROM now_date)::int, 1, 4);
  dow := EXTRACT(ISODOW FROM jan4)::int;
  w1_monday := jan4 - (dow - 1);
  diff := now_date - w1_monday;
  week := (diff / 7) + 1;
  year := EXTRACT(YEAR FROM now_date)::int;
  RETURN NEXT;
END; $$;

CREATE OR REPLACE FUNCTION public.fn_calculate_next_week(w integer, y integer)
RETURNS TABLE(next_w integer, next_y integer) LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
BEGIN
  RETURN QUERY SELECT w, y;
END; $$;

CREATE OR REPLACE FUNCTION public.fn_sync_action_items_on_week_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE target_w int; target_y int;
BEGIN
  IF (old.week_number IS DISTINCT FROM new.week_number OR old.year IS DISTINCT FROM new.year OR old.department IS DISTINCT FROM new.department) THEN
    SELECT next_w, next_y INTO target_w, target_y FROM public.fn_calculate_next_week(new.week_number, new.year);
    UPDATE public.action_items SET week_number = target_w, year = target_y, department = new.department WHERE report_id = new.id;
    IF NOT EXISTS (SELECT 1 FROM public.action_items WHERE report_id = new.id) THEN
      DECLARE old_target_w int; old_target_y int;
      BEGIN
        SELECT next_w, next_y INTO old_target_w, old_target_y FROM public.fn_calculate_next_week(old.week_number, old.year);
        UPDATE public.action_items SET week_number = target_w, year = target_y, department = new.department
        WHERE department = old.department AND week_number = old_target_w AND year = old_target_y AND status = 'pending';
      END;
    END IF;
  END IF;
  RETURN new;
END; $$;

CREATE OR REPLACE FUNCTION public.prevent_department_hard_delete_or_invalid_soft_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE assigned_count integer;
BEGIN
  IF tg_op = 'DELETE' THEN RAISE EXCEPTION 'Hard delete is disabled for departments. Use is_active=false instead.'; END IF;
  IF tg_op = 'UPDATE' AND coalesce(old.is_active, true) = true AND coalesce(new.is_active, true) = false THEN
    SELECT count(*) INTO assigned_count FROM public.profiles p WHERE p.department = old.name;
    IF assigned_count > 0 THEN
      RAISE EXCEPTION 'Cannot deactivate department "%" while % profile(s) are assigned.', old.name, assigned_count;
    END IF;
  END IF;
  RETURN new;
END; $$;

CREATE OR REPLACE FUNCTION public.prevent_office_location_hard_delete_or_invalid_soft_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE assigned_count integer;
BEGIN
  IF tg_op = 'DELETE' THEN RAISE EXCEPTION 'Hard delete is disabled for office locations. Use is_active=false instead.'; END IF;
  IF tg_op = 'UPDATE' AND coalesce(old.is_active, true) = true AND coalesce(new.is_active, true) = false THEN
    SELECT count(*) INTO assigned_count FROM public.profiles p WHERE p.office_location = old.name;
    IF assigned_count > 0 THEN
      RAISE EXCEPTION 'Cannot deactivate office location "%" while % profile(s) are assigned.', old.name, assigned_count;
    END IF;
  END IF;
  RETURN new;
END; $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND (is_admin = true OR role IN ('admin', 'super_admin', 'developer')));
$$;

CREATE OR REPLACE FUNCTION public.correspondence_is_admin()
RETURNS boolean LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'super_admin', 'developer'));
$$;

CREATE OR REPLACE FUNCTION public.help_desk_is_admin()
RETURNS boolean LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin', 'super_admin', 'developer'));
$$;

CREATE OR REPLACE FUNCTION public.correspondence_is_lead_for_department(p_department text)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND coalesce(p.is_department_lead, false) = true
      AND (p_department = ANY(coalesce(p.lead_departments, '{}'::text[])) OR coalesce(p.department, '') = p_department)
  );
$$;

CREATE OR REPLACE FUNCTION public.help_desk_is_lead_for_department(p_department text)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND (p.role IN ('admin', 'super_admin', 'developer')
        OR (coalesce(p.is_department_lead, false) = true
          AND (p_department = ANY(coalesce(p.lead_departments, '{}'::text[])) OR coalesce(p.department, '') = p_department)))
  );
$$;

CREATE OR REPLACE FUNCTION public.extract_serial_number(asset_code text)
RETURNS text LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_serial text;
BEGIN
  v_serial := split_part(asset_code, '/', 5);
  IF v_serial = '' THEN v_serial := split_part(asset_code, '-', 3); END IF;
  IF v_serial ~ '^[0-9]+$' THEN RETURN v_serial; ELSE RETURN NULL; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.check_asset_deletion_allowed()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE current_serial INTEGER; asset_type_val TEXT; higher_serial_exists BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    current_serial := public.extract_serial_number(OLD.unique_code)::INTEGER;
    IF current_serial IS NULL THEN RETURN OLD; END IF;
    asset_type_val := OLD.asset_type;
    SELECT EXISTS(
      SELECT 1 FROM public.assets
      WHERE asset_type = asset_type_val AND id != OLD.id
        AND (public.extract_serial_number(unique_code))::INTEGER > current_serial
        AND public.extract_serial_number(unique_code) IS NOT NULL
    ) INTO higher_serial_exists;
    IF higher_serial_exists THEN
      RAISE EXCEPTION 'Cannot delete asset %. Higher-numbered assets exist for asset type %. Delete assets in reverse order (highest number first) to maintain sequential numbering.', OLD.unique_code, asset_type_val USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN OLD;
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_pending_asset_notifications()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF (NEW.assigned_to IS DISTINCT FROM OLD.assigned_to OR NEW.is_current != OLD.is_current) THEN
    UPDATE public.notification_queue SET status = 'cancelled'
    WHERE status = 'pending'
      AND data->>'unique_code' = (SELECT unique_code FROM public.assets WHERE id = NEW.asset_id)
      AND ((process_after IS NOT NULL AND process_after > now()) OR (scheduled_for IS NOT NULL AND scheduled_for > now()));
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.create_asset_notification(p_user_id uuid, p_type text, p_title text, p_message text, p_data jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_fingerprint TEXT; v_notif_id UUID;
BEGIN
  v_fingerprint := p_type || '_' || COALESCE(p_data->>'unique_code', 'general');
  IF EXISTS (SELECT 1 FROM public.notification_queue WHERE user_id = p_user_id AND fingerprint = v_fingerprint AND status = 'sent' AND sent_at > (NOW() - INTERVAL '1 hour')) THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.notification_queue (user_id, type, title, message, data, fingerprint, scheduled_for)
  VALUES (p_user_id, p_type, p_title, p_message, p_data, v_fingerprint, NOW()) RETURNING id INTO v_notif_id;
  RETURN v_notif_id;
END; $$;

CREATE OR REPLACE FUNCTION public.reassign_asset(p_asset_id uuid, p_new_assignment_type text, p_assigned_to uuid, p_department text, p_office_location text, p_assigned_by uuid, p_assigned_at timestamp with time zone, p_assignment_notes text, p_handover_notes text, p_new_status text DEFAULT 'assigned'::text)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE asset_assignments SET is_current = false, handed_over_at = NOW(), handover_notes = p_handover_notes WHERE asset_id = p_asset_id AND is_current = true;
  INSERT INTO asset_assignments (asset_id, assignment_type, assigned_to, department, office_location, assigned_by, assigned_at, assignment_notes, is_current)
  VALUES (p_asset_id, p_new_assignment_type, p_assigned_to, p_department, p_office_location, p_assigned_by, p_assigned_at, p_assignment_notes, true);
  UPDATE assets SET status = p_new_status, assignment_type = p_new_assignment_type, department = p_department, office_location = p_office_location WHERE id = p_asset_id;
END; $$;

CREATE OR REPLACE FUNCTION public.process_notification_queue()
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  r RECORD; v_notification_id UUID;
  v_service_key TEXT := current_setting('app.service_role_key', true);
  v_webhook_secret TEXT := current_setting('app.webhook_secret', true);
  v_safe_type TEXT;
BEGIN
  FOR r IN
    SELECT * FROM public.notification_queue
    WHERE status != 'sent' AND status != 'cancelled'
      AND (process_after IS NULL OR process_after <= now())
    LIMIT 20
  LOOP
    v_safe_type := CASE
      WHEN r.type = 'asset_assignment' THEN 'asset_assigned'
      WHEN r.type = 'asset_transfer_incoming' THEN 'asset_transfer_incoming'
      WHEN r.type = 'asset_returned' THEN 'asset_returned'
      ELSE r.type
    END;
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, message, data, priority, created_at)
      VALUES (r.user_id, v_safe_type, r.title, r.message, r.data, 'normal', NOW()) RETURNING id INTO v_notification_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to insert UI notification: %', SQLERRM;
    END;
    PERFORM net.http_post(
      url := 'https://itqegqxeqkeogwrvlzlj.supabase.co/functions/v1/send-email-notification',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_key, 'apikey', v_service_key, 'x-webhook-secret', v_webhook_secret),
      body := jsonb_build_object('record', jsonb_build_object('id', r.id, 'user_id', r.user_id, 'type', r.type, 'title', r.title, 'message', r.message, 'data', r.data))
    );
    UPDATE public.notification_queue SET status = 'sent', sent_at = NOW() WHERE id = r.id;
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.process_notification_batch()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r RECORD; v_webhook_secret text := current_setting('app.webhook_secret', true);
BEGIN
  FOR r IN
    SELECT * FROM public.notification_queue WHERE status = 'pending' AND (process_after IS NULL OR process_after <= now()) FOR UPDATE SKIP LOCKED LIMIT 10
  LOOP
    UPDATE public.notification_queue SET status = 'processing' WHERE id = r.id;
    PERFORM net.http_post(
      url := 'https://itqegqxeqkeogwrvlzlj.supabase.co/functions/v1/send-email-notification',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_webhook_secret),
      body := jsonb_build_object('record', row_to_json(r))
    );
    UPDATE public.notification_queue SET status = 'sent', processed_at = now() WHERE id = r.id;
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_outgoing_transfer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_fingerprint text; v_asset_data jsonb;
BEGIN
  IF OLD.is_current IS TRUE AND NEW.is_current IS FALSE AND NEW.handed_over_at IS NULL THEN
    v_fingerprint := 'transfer_out_' || OLD.id;
    SELECT jsonb_build_object('unique_code', unique_code, 'asset_type', asset_type, 'asset_model', asset_model, 'serial_number', serial_number) INTO v_asset_data FROM public.assets WHERE id = NEW.asset_id;
    INSERT INTO public.notification_queue (user_id, type, title, message, fingerprint, data, process_after)
    VALUES (OLD.assigned_to, 'asset_transfer_outgoing', 'Asset Transfer Initiated', 'Asset ' || (v_asset_data->>'unique_code') || ' has been transferred from your custody.', v_fingerprint, v_asset_data || jsonb_build_object('authorized_by', 'IT Department', 'transfer_date', now()), now());
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_asset_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_asset_data jsonb; v_assigned_to uuid;
BEGIN
  IF NEW.status IN ('maintenance', 'retired') AND OLD.status != NEW.status THEN
    SELECT assigned_to INTO v_assigned_to FROM public.asset_assignments WHERE asset_id = NEW.id AND is_current = true LIMIT 1;
    IF v_assigned_to IS NOT NULL THEN
      SELECT jsonb_build_object('unique_code', unique_code, 'asset_type', asset_type, 'asset_model', asset_model, 'serial_number', serial_number, 'department', department) INTO v_asset_data FROM public.assets WHERE id = NEW.id;
      INSERT INTO public.notifications (user_id, type, title, message, category, data) VALUES (v_assigned_to, 'asset_status_alert', 'Asset Status Alert', 'The status of asset ' || NEW.unique_code || ' has been updated to ' || NEW.status || '.', 'assets', v_asset_data || jsonb_build_object('status_action', NEW.status, 'status_description', 'Updated via Admin Panel', 'date', now()));
    END IF;
  ELSIF OLD.status IN ('maintenance', 'retired') AND NEW.status IN ('available', 'assigned') THEN
    SELECT assigned_to INTO v_assigned_to FROM public.asset_assignments WHERE asset_id = NEW.id AND is_current = true LIMIT 1;
    IF v_assigned_to IS NOT NULL THEN
      SELECT jsonb_build_object('unique_code', unique_code, 'asset_type', asset_type, 'asset_model', asset_model, 'serial_number', serial_number, 'department', department) INTO v_asset_data FROM public.assets WHERE id = NEW.id;
      INSERT INTO public.notifications (user_id, type, title, message, category, data) VALUES (v_assigned_to, 'asset_status_fixed', 'Asset Status Restored', 'Asset ' || NEW.unique_code || ' is now fully operational.', 'assets', v_asset_data || jsonb_build_object('resolution_note', 'Restored to ' || NEW.status, 'date', now()));
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_asset_return()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_asset_data jsonb; v_returner_name text; v_authorizer_name text;
  v_is_transfer boolean; v_notification_id uuid;
  v_service_key TEXT := current_setting('app.service_role_key', true);
  v_webhook_secret TEXT := current_setting('app.webhook_secret', true);
BEGIN
  IF OLD.is_current = true AND NEW.is_current = false THEN
    SELECT jsonb_build_object('unique_code', unique_code, 'asset_type', asset_type, 'asset_model', asset_model, 'serial_number', serial_number) INTO v_asset_data FROM public.assets WHERE id = NEW.asset_id;
    SELECT full_name INTO v_returner_name FROM public.profiles WHERE id = NEW.assigned_to;
    SELECT full_name INTO v_authorizer_name FROM public.profiles WHERE id = COALESCE(NEW.assigned_by, (SELECT auth.uid()));
    v_is_transfer := (NEW.handover_notes LIKE '%Reassigned%');
    INSERT INTO public.notifications (user_id, type, title, message, category, data)
    VALUES (NEW.assigned_to, CASE WHEN v_is_transfer THEN 'asset_transfer_outgoing' ELSE 'asset_returned' END, CASE WHEN v_is_transfer THEN 'Asset Transfer Initiated' ELSE 'Asset Officially Returned' END, CASE WHEN v_is_transfer THEN 'Asset ' || (v_asset_data->>'unique_code') || ' has been transferred from your custody.' ELSE 'You have successfully returned asset ' || (v_asset_data->>'unique_code') || '.' END, 'assets', v_asset_data || jsonb_build_object('returned_by', COALESCE(v_returner_name, 'User'), 'authorized_by', COALESCE(v_authorizer_name, 'System Admin'), 'return_date', COALESCE(NEW.handed_over_at, now()))) RETURNING id INTO v_notification_id;
    PERFORM net.http_post(url := 'https://itqegqxeqkeogwrvlzlj.supabase.co/functions/v1/send-email-notification', headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_key, 'apikey', v_service_key, 'x-webhook-secret', v_webhook_secret), body := jsonb_build_object('record', jsonb_build_object('id', v_notification_id, 'user_id', NEW.assigned_to, 'type', CASE WHEN v_is_transfer THEN 'asset_transfer_outgoing' ELSE 'asset_returned' END, 'title', CASE WHEN v_is_transfer THEN 'Asset Transfer Initiated' ELSE 'Asset Officially Returned' END, 'message', 'Asset update', 'data', v_asset_data || jsonb_build_object('authorized_by', COALESCE(v_authorizer_name, 'System Admin')))));
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_email_on_notification_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_service_key TEXT := current_setting('app.service_role_key', true);
  v_webhook_secret TEXT := current_setting('app.webhook_secret', true);
BEGIN
  IF NEW.type IN ('asset_assigned','asset_transfer_outgoing','asset_transfer_incoming','asset_returned','asset_status_alert','asset_status_fixed','system_restored') THEN
    PERFORM net.http_post(url := 'https://itqegqxeqkeogwrvlzlj.supabase.co/functions/v1/send-email-notification', headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_key, 'apikey', v_service_key, 'x-webhook-secret', v_webhook_secret), body := jsonb_build_object('record', jsonb_build_object('id', NEW.id, 'user_id', NEW.user_id, 'type', NEW.type, 'title', NEW.title, 'message', NEW.message, 'data', NEW.data)));
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_type text, p_category text DEFAULT NULL::text, p_title text DEFAULT NULL::text, p_message text DEFAULT NULL::text, p_priority text DEFAULT 'normal'::text, p_link_url text DEFAULT NULL::text, p_actor_id uuid DEFAULT NULL::uuid, p_entity_type text DEFAULT NULL::text, p_entity_id text DEFAULT NULL::text, p_rich_content jsonb DEFAULT NULL::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_notification_id UUID; v_data JSONB;
BEGIN
  v_data := jsonb_build_object('category', p_category, 'actor_id', p_actor_id, 'entity_type', p_entity_type, 'entity_id', p_entity_id, 'rich_content', p_rich_content, 'link_url', p_link_url);
  INSERT INTO notifications (user_id, type, title, message, priority, action_url, data)
  VALUES (p_user_id, p_type, p_title, p_message, p_priority, p_link_url, v_data) RETURNING id INTO v_notification_id;
  RETURN v_notification_id;
END; $$;

CREATE OR REPLACE FUNCTION public.audit_log_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_old_data JSONB; v_new_data JSONB; v_action TEXT; v_entity_type TEXT; v_entity_id TEXT;
  v_department TEXT; v_changed_fields TEXT[] := ARRAY[]::TEXT[]; v_key TEXT;
  v_metadata JSONB := '{}';
BEGIN
  v_entity_type := TG_TABLE_NAME;
  IF (TG_OP = 'INSERT') THEN
    v_action := 'create'; v_new_data := to_jsonb(NEW); v_entity_id := NEW.id::TEXT;
    SELECT array_agg(key) INTO v_changed_fields FROM jsonb_object_keys(v_new_data) AS key;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_action := 'update'; v_old_data := to_jsonb(OLD); v_new_data := to_jsonb(NEW); v_entity_id := NEW.id::TEXT;
    FOR v_key IN SELECT jsonb_object_keys(v_new_data) LOOP
      IF v_key IN ('updated_at', 'created_at') THEN CONTINUE; END IF;
      IF (v_old_data -> v_key IS DISTINCT FROM v_new_data -> v_key) THEN v_changed_fields := array_append(v_changed_fields, v_key); END IF;
    END LOOP;
    IF array_length(v_changed_fields, 1) IS NULL THEN RETURN NEW; END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    v_action := 'delete'; v_old_data := to_jsonb(OLD); v_entity_id := OLD.id::TEXT;
    SELECT array_agg(key) INTO v_changed_fields FROM jsonb_object_keys(v_old_data) AS key;
  END IF;
  IF TG_TABLE_NAME = 'assets' THEN
    v_department := COALESCE(NEW.department, OLD.department);
    v_metadata := jsonb_build_object('unique_code', COALESCE(NEW.unique_code, OLD.unique_code));
  ELSIF TG_TABLE_NAME = 'asset_assignments' THEN
    v_department := COALESCE(NEW.department, OLD.department);
    v_metadata := (SELECT jsonb_build_object('unique_code', unique_code, 'asset_model', asset_model) FROM public.assets WHERE id = COALESCE(NEW.asset_id, OLD.asset_id));
    IF v_metadata IS NULL THEN v_metadata := '{}'; END IF;
  ELSIF TG_TABLE_NAME = 'profiles' THEN
    v_department := COALESCE(NEW.department, OLD.department);
  END IF;
  INSERT INTO audit_logs (user_id, operation, action, table_name, entity_type, record_id, entity_id, old_values, new_values, changed_fields, department, metadata, status)
  VALUES ((SELECT auth.uid()), TG_OP, v_action, TG_TABLE_NAME, v_entity_type, v_entity_id, v_entity_id, v_old_data, v_new_data, v_changed_fields, v_department, v_metadata, 'success');
  IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.audit_asset_assignment_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_action TEXT; v_asset_data RECORD; v_assigned_user RECORD; v_from_user RECORD;
  v_new_values JSONB; v_old_values JSONB; v_user_id UUID;
BEGIN
  v_user_id := (SELECT auth.uid());
  SELECT id, unique_code, asset_name, asset_type, serial_number, department, office_location INTO v_asset_data FROM assets WHERE id = NEW.asset_id;
  IF NEW.assigned_to IS NOT NULL THEN SELECT id, first_name, last_name, department, employee_number INTO v_assigned_user FROM profiles WHERE id = NEW.assigned_to; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_from IS NOT NULL THEN v_action := 'reassign'; SELECT id, first_name, last_name, department, employee_number INTO v_from_user FROM profiles WHERE id = NEW.assigned_from; ELSE v_action := 'assign'; END IF;
  ELSIF TG_OP = 'UPDATE' THEN v_action := 'update';
  ELSIF TG_OP = 'DELETE' THEN v_action := 'unassign'; END IF;
  v_new_values := jsonb_build_object('id', NEW.id, 'asset_id', NEW.asset_id, 'assignment_type', NEW.assignment_type, 'is_current', NEW.is_current, 'assigned_to', NEW.assigned_to, 'assigned_to_name', CASE WHEN v_assigned_user.id IS NOT NULL THEN CONCAT(v_assigned_user.first_name, ' ', v_assigned_user.last_name) ELSE 'Unknown' END, 'unique_code', COALESCE(v_asset_data.unique_code, 'Unknown'), 'asset_type', v_asset_data.asset_type);
  INSERT INTO audit_logs (user_id, operation, action, table_name, entity_type, record_id, entity_id, old_values, new_values, department, status)
  VALUES (v_user_id, TG_OP, v_action, 'asset_assignments', 'assets', NEW.id::TEXT, NEW.asset_id::TEXT, to_jsonb(OLD), v_new_values, COALESCE(v_assigned_user.department, v_asset_data.department, v_asset_data.office_location), 'success');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Audit failure: %', SQLERRM; RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.process_digest_schedules()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  schedule RECORD; current_info RECORD; payload jsonb;
  day_num int; today_dow int; now_time time;
  base_url text := 'https://itqegqxeqkeogwrvlzlj.supabase.co';
  anon_key text := current_setting('app.anon_key', true);
BEGIN
  SELECT * INTO current_info FROM public.get_current_iso_week();
  today_dow := EXTRACT(ISODOW FROM CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::int;
  now_time := (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::time;
  FOR schedule IN SELECT * FROM public.digest_schedules WHERE is_active = true LOOP
    IF schedule.schedule_type = 'one_time' THEN
      IF schedule.next_run_at IS NOT NULL AND schedule.next_run_at <= NOW() THEN
        payload := jsonb_build_object('meetingWeek', schedule.meeting_week, 'meetingYear', schedule.meeting_year, 'recipients', schedule.recipients, 'contentChoice', schedule.content_choice);
        PERFORM net.http_post(url := base_url || '/functions/v1/send-weekly-digest', headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || anon_key), body := payload);
        UPDATE public.digest_schedules SET is_active = false, last_sent_at = NOW() WHERE id = schedule.id;
      END IF;
    ELSIF schedule.schedule_type = 'recurring' THEN
      day_num := CASE schedule.send_day WHEN 'monday' THEN 1 WHEN 'tuesday' THEN 2 WHEN 'wednesday' THEN 3 WHEN 'thursday' THEN 4 WHEN 'friday' THEN 5 WHEN 'saturday' THEN 6 WHEN 'sunday' THEN 7 ELSE 1 END;
      IF today_dow = day_num AND now_time >= schedule.send_time AND (schedule.last_sent_at IS NULL OR schedule.last_sent_at < date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::timestamptz) THEN
        payload := jsonb_build_object('meetingWeek', current_info.week, 'meetingYear', current_info.year, 'recipients', schedule.recipients, 'contentChoice', schedule.content_choice);
        PERFORM net.http_post(url := base_url || '/functions/v1/send-weekly-digest', headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || anon_key), body := payload);
        UPDATE public.digest_schedules SET last_sent_at = NOW() WHERE id = schedule.id;
      END IF;
    END IF;
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.process_reminder_schedules()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  schedule record; payload jsonb;
  base_url text := 'https://itqegqxeqkeogwrvlzlj.supabase.co';
  anon_key text := current_setting('app.anon_key', true);
  lagos_now timestamp; lagos_today date; meeting_seed date;
  target_dow int; today_dow int; days_until int; target_date date; meeting_time_val time;
BEGIN
  FOR schedule IN SELECT * FROM public.reminder_schedules WHERE is_active = true AND next_run_at IS NOT NULL AND next_run_at <= now() LOOP
    payload := coalesce(schedule.meeting_config, '{}'::jsonb);
    payload := payload || jsonb_build_object('type', coalesce(payload->>'type', schedule.reminder_type), 'recipients', schedule.recipients);
    IF schedule.schedule_type = 'recurring' AND coalesce(payload->>'type', schedule.reminder_type) = 'meeting' THEN
      lagos_now := now() AT TIME ZONE 'Africa/Lagos'; lagos_today := lagos_now::date;
      BEGIN meeting_seed := nullif(payload->>'meetingDate', '')::date; EXCEPTION WHEN OTHERS THEN meeting_seed := null; END;
      IF meeting_seed IS NULL THEN target_dow := 1; ELSE target_dow := extract(dow FROM meeting_seed)::int; END IF;
      today_dow := extract(dow FROM lagos_today)::int;
      days_until := (target_dow - today_dow + 7) % 7;
      target_date := lagos_today + days_until;
      BEGIN meeting_time_val := coalesce(nullif(payload->>'meetingTime', '')::time, time '08:30'); EXCEPTION WHEN OTHERS THEN meeting_time_val := time '08:30'; END;
      IF days_until = 0 AND (lagos_now::time >= meeting_time_val) THEN target_date := target_date + interval '7 days'; END IF;
      payload := payload || jsonb_build_object('meetingDate', to_char(target_date, 'YYYY-MM-DD'));
    END IF;
    PERFORM net.http_post(url := base_url || '/functions/v1/send-meeting-reminder', headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || anon_key), body := payload);
    IF schedule.schedule_type = 'recurring' THEN
      UPDATE public.reminder_schedules SET next_run_at = greatest(next_run_at, now()) + interval '7 days', updated_at = now() WHERE id = schedule.id;
    ELSE
      UPDATE public.reminder_schedules SET is_active = false, updated_at = now() WHERE id = schedule.id;
    END IF;
  END LOOP;
END; $$;
;
