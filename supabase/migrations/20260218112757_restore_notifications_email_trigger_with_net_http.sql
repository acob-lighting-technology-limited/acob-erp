-- ============================================================
-- STEP 1: Create the function that fires the email edge function
-- directly via net.http_post (no Supabase Dashboard webhook needed)
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_email_on_notification_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_service_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0cWVncXhlcWtlb2d3cnZsemxqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY0MjQ1NywiZXhwIjoyMDc3MjE4NDU3fQ.uUEg9q9jT9IsERFmmhmYMxdIr_xgakdf52EmMEZbf50';
  v_webhook_secret TEXT := 'acob_notification_trigger_secret_2026';
BEGIN
  -- Only fire for asset-related notification types that have email templates
  IF NEW.type IN (
    'asset_assigned',
    'asset_transfer_outgoing',
    'asset_transfer_incoming',
    'asset_returned',
    'asset_status_alert',
    'asset_status_fixed',
    'system_restored'
  ) THEN
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
          'id',      NEW.id,
          'user_id', NEW.user_id,
          'type',    NEW.type,
          'title',   NEW.title,
          'message', NEW.message,
          'data',    NEW.data
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- STEP 2: Drop old trigger if it somehow still exists, then recreate
-- ============================================================
DROP TRIGGER IF EXISTS send_email_on_notification_insert ON public.notifications;

CREATE TRIGGER send_email_on_notification_insert
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_email_on_notification_insert();;
