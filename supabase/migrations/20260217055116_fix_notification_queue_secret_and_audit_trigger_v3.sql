-- 1. Fix the notification queue processing function
CREATE OR REPLACE FUNCTION public.process_notification_queue()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  r RECORD;
  -- Definitive keys/secrets
  v_service_key TEXT := current_setting('app.service_role_key', true);
  v_webhook_secret TEXT := 'acob_notification_trigger_secret_2026';
BEGIN
  FOR r IN 
    SELECT * FROM public.notification_queue 
    WHERE status != 'sent' AND status != 'cancelled'
    LIMIT 20
  LOOP
    -- Mark as processing
    UPDATE public.notification_queue SET status = 'processing' WHERE id = r.id;

    -- Call the Edge Function
    PERFORM net.http_post(
      url := 'https://itqegqxeqkeogwrvlzlj.supabase.co/functions/v1/send-email-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key,
        'apikey', v_service_key,
        'x-webhook-secret', v_webhook_secret
      ),
      body := jsonb_build_object(
        'record', jsonb_build_object(
          'id', r.id,
          'user_id', r.user_id,
          'type', r.type,
          'title', r.title,
          'message', r.message,
          'data', r.data
        )
      )
    );

    -- Mark as sent
    UPDATE public.notification_queue 
    SET status = 'sent', 
        sent_at = NOW() 
    WHERE id = r.id;
  END LOOP;
END;
$function$;

-- 2. Audit trigger fix v3 (more robust against nulls and auth/session issues)
CREATE OR REPLACE FUNCTION public.audit_asset_assignment_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_action TEXT;
    v_asset_data RECORD;
    v_assigned_user RECORD;
    v_from_user RECORD;
    v_new_values JSONB;
    v_old_values JSONB;
    v_user_id UUID;
BEGIN
    -- Try to catch the user ID reliably
    v_user_id := auth.uid();
    
    -- Get asset info
    SELECT id, unique_code, asset_name, asset_type, serial_number, department, office_location
    INTO v_asset_data
    FROM assets WHERE id = NEW.asset_id;

    -- Get assigned-to user info
    IF NEW.assigned_to IS NOT NULL THEN
        SELECT id, first_name, last_name, department, employee_number
        INTO v_assigned_user
        FROM profiles WHERE id = NEW.assigned_to;
    END IF;

    -- Determine action
    IF TG_OP = 'INSERT' THEN
        IF NEW.assigned_from IS NOT NULL THEN
            v_action := 'reassign';
            SELECT id, first_name, last_name, department, employee_number
            INTO v_from_user
            FROM profiles WHERE id = NEW.assigned_from;
        ELSE
            v_action := 'assign';
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'update';
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'unassign';
    END IF;

    -- Build new_values
    v_new_values := jsonb_build_object(
        'id', NEW.id,
        'asset_id', NEW.asset_id,
        'assignment_type', NEW.assignment_type,
        'is_current', NEW.is_current,
        'assigned_to', NEW.assigned_to,
        'assigned_to_name', CASE WHEN v_assigned_user.id IS NOT NULL 
            THEN CONCAT(v_assigned_user.first_name, ' ', v_assigned_user.last_name) ELSE 'Unknown' END,
        'unique_code', COALESCE(v_asset_data.unique_code, 'Unknown'),
        'asset_type', v_asset_data.asset_type
    );

    -- Insert audit log
    INSERT INTO audit_logs (
        user_id, operation, action, table_name, entity_type,
        record_id, entity_id, old_values, new_values,
        department, status
    )
    VALUES (
        v_user_id, TG_OP, v_action, 'asset_assignments', 'assets',
        NEW.id::TEXT, NEW.asset_id::TEXT, to_jsonb(OLD), v_new_values,
        COALESCE(v_assigned_user.department, v_asset_data.department, v_asset_data.office_location),
        'success'
    );

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Silent failure to not block the main transaction
        RAISE NOTICE 'Audit failure: %', SQLERRM;
        RETURN NEW;
END;
$function$;
;
