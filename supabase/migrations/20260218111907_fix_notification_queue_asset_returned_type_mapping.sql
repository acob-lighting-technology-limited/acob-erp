CREATE OR REPLACE FUNCTION public.process_notification_queue()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r RECORD;
  v_notification_id UUID;
  v_service_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0cWVncXhlcWtlb2d3cnZsemxqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY0MjQ1NywiZXhwIjoyMDc3MjE4NDU3fQ.uUEg9q9jT9IsERFmmhmYMxdIr_xgakdf52EmMEZbf50';
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
    -- FIX: asset_returned is a valid type in the notifications table, use it directly
    v_safe_type := CASE 
      WHEN r.type = 'asset_assignment' THEN 'asset_assigned'
      WHEN r.type = 'asset_transfer_incoming' THEN 'asset_transfer_incoming'
      WHEN r.type = 'asset_returned' THEN 'asset_returned'   -- ✅ FIXED: was 'system_alert'
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
$$;;
