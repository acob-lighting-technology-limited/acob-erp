-- 1. Standardize on 'asset_assigned' to satisfy database constraints
CREATE OR REPLACE FUNCTION public.handle_new_asset_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_fingerprint text;
    v_asset_data jsonb;
    v_should_notify boolean := false;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_should_notify := true;
    ELSIF TG_OP = 'UPDATE' THEN
        IF (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to AND NEW.assigned_to IS NOT NULL) THEN
            v_should_notify := true;
        END IF;
    END IF;

    IF NOT v_should_notify THEN
        RETURN NEW;
    END IF;

    v_fingerprint := 'assignment_' || NEW.id || '_' || COALESCE(NEW.assigned_to::text, 'no_user');

    SELECT jsonb_build_object(
        'unique_code', unique_code, 
        'asset_type', asset_type, 
        'asset_model', asset_model, 
        'serial_number', serial_number
    ) INTO v_asset_data
    FROM public.assets WHERE id = NEW.asset_id;

    IF NEW.assigned_to IS NOT NULL THEN
        INSERT INTO public.notification_queue (
            user_id, type, title, message, fingerprint, data, process_after
        )
        VALUES (
            NEW.assigned_to,
            'asset_assigned', -- EXACTLY match the notifications table constraint
            'Asset Officially Assigned',
            'You have been assigned asset ' || (v_asset_data->>'unique_code') || '.',
            v_fingerprint,
            v_asset_data || jsonb_build_object(
                'assigned_by', NEW.assigned_by,
                'assigned_date', NEW.assigned_at,
                'actor_id', NEW.assigned_by
            ),
            now()
        );
    END IF;

    RETURN NEW;
END;
$function$;

-- 2. Fix the processor to be resilient to type mismatches and actually send email
CREATE OR REPLACE FUNCTION public.process_notification_queue()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  r RECORD;
  v_notification_id UUID;
  v_service_key TEXT := current_setting('app.service_role_key', true);
  v_webhook_secret TEXT := 'acob_notification_trigger_secret_2026';
  v_safe_type TEXT;
BEGIN
  FOR r IN 
    SELECT * FROM public.notification_queue 
    WHERE status != 'sent' AND status != 'cancelled'
    AND (process_after IS NULL OR process_after <= now())
    LIMIT 20
  LOOP
    -- Map types to known allowed values in the notifications table
    v_safe_type := CASE 
      WHEN r.type = 'asset_assignment' THEN 'asset_assigned'
      WHEN r.type = 'asset_transfer_incoming' THEN 'asset_assigned'
      WHEN r.type = 'asset_returned' THEN 'system_alert'
      ELSE r.type
    END;

    -- 1. Try to create a record in UI notifications table (wrapped in exception for safety)
    BEGIN
      INSERT INTO public.notifications (
        user_id, type, title, message, data, priority, created_at
      ) VALUES (
        r.user_id, v_safe_type, r.title, r.message, r.data, 'normal', NOW()
      ) RETURNING id INTO v_notification_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to insert UI notification: %', SQLERRM;
    END;

    -- 2. Call the Edge Function to send EMAIL
    -- Note: We use the original r.type for the Edge Function so it can choose templates
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

    -- 3. Mark as sent
    UPDATE public.notification_queue SET status = 'sent', sent_at = NOW() WHERE id = r.id;
  END LOOP;
END;
$function$;

-- 3. Correct the types of existing pending items in the queue
UPDATE public.notification_queue 
SET type = 'asset_assigned' 
WHERE type IN ('asset_assignment', 'asset_transfer_incoming') AND status != 'sent';
;
