CREATE OR REPLACE FUNCTION public.process_notification_queue()
RETURNS void AS $$
DECLARE
  r RECORD;
  v_service_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0cWVncXhlcWtlb2d3cnZsemxqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY0MjQ1NywiZXhwIjoyMDc3MjE4NDU3fQ.uUEg9q9jT9IsERFmmhmYMxdIr_xgakdf52EmMEZbf50';
  v_webhook_secret TEXT := 'b6393118aded6b24ca849be194414535';
BEGIN
  FOR r IN 
    SELECT * FROM public.notification_queue 
    WHERE status != 'sent' AND status != 'cancelled'
    LIMIT 20
  LOOP
    -- Mark as processing
    UPDATE public.notification_queue SET status = 'processing' WHERE id = r.id;

    -- Call the Edge Function using pg_net with Service Role Key and Webhook Secret
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
$$ LANGUAGE plpgsql;;
