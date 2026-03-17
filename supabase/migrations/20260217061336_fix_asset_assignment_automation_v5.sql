-- 1. Fix the trigger to pass ID instead of name, and use correct types
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
    -- Only trigger if it's a new record OR if the recipient changed
    IF TG_OP = 'INSERT' THEN
        v_should_notify := true;
    ELSIF TG_OP = 'UPDATE' THEN
        IF (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to AND NEW.assigned_to IS NOT NULL) OR
           (OLD.department IS DISTINCT FROM NEW.department AND NEW.department IS NOT NULL) OR
           (OLD.office_location IS DISTINCT FROM NEW.office_location AND NEW.office_location IS NOT NULL) THEN
            v_should_notify := true;
        END IF;
    END IF;

    IF NOT v_should_notify THEN
        RETURN NEW;
    END IF;

    -- Create a unique fingerprint to avoid double-processing
    v_fingerprint := 'assignment_' || NEW.id || '_' || COALESCE(NEW.assigned_to::text, 'no_user');

    -- Get Asset Details
    SELECT jsonb_build_object(
        'unique_code', unique_code, 
        'asset_type', asset_type, 
        'asset_model', asset_model, 
        'serial_number', serial_number
    ) INTO v_asset_data
    FROM public.assets WHERE id = NEW.asset_id;

    -- Always notify the target user if they are individual
    IF NEW.assigned_to IS NOT NULL THEN
        INSERT INTO public.notification_queue (
            user_id, 
            type, 
            title, 
            message, 
            fingerprint, 
            data, 
            process_after
        )
        VALUES (
            NEW.assigned_to,
            'asset_assignment', -- Use standardized type for all assignments/reassignments
            'Asset Officially Assigned',
            'You have been assigned asset ' || (v_asset_data->>'unique_code') || '.',
            v_fingerprint,
            v_asset_data || jsonb_build_object(
                'assigned_by', NEW.assigned_by, -- Pass the UUID so Edge Function can fetch the latest profile
                'assigned_date', NEW.assigned_at,
                'actor_id', NEW.assigned_by -- Compatibility for different systems
            ),
            now()
        );
    END IF;

    RETURN NEW;
END;
$function$;

-- 2. Restore and FIX the processor to actually send emails
CREATE OR REPLACE FUNCTION public.process_notification_queue()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  r RECORD;
  v_notification_id UUID;
  v_service_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0cWVncXhlcWtlb2d3cnZsemxqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY0MjQ1NywiZXhwIjoyMDc3MjE4NDU3fQ.uUEg9q9jT9IsERFmmhmYMxdIr_xgakdf52EmMEZbf50';
  v_webhook_secret TEXT := 'acob_notification_trigger_secret_2026';
BEGIN
  FOR r IN 
    SELECT * FROM public.notification_queue 
    WHERE status != 'sent' AND status != 'cancelled'
    AND (process_after IS NULL OR process_after <= now())
    LIMIT 20
  LOOP
    -- 1. Create a record in the UI notifications table
    INSERT INTO public.notifications (
      user_id, type, title, message, data, priority, created_at
    ) VALUES (
      r.user_id, r.type, r.title, r.message, r.data, 'normal', NOW()
    ) RETURNING id INTO v_notification_id;

    -- 2. Call the Edge Function to send EMAIL
    -- This is the part that was missing/commented
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
    UPDATE public.notification_queue 
    SET status = 'sent', sent_at = NOW() 
    WHERE id = r.id;
  END LOOP;
END;
$function$;
;
