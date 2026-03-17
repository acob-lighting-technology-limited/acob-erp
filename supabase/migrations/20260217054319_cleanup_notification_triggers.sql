-- 1. Drop existing triggers on notifications
DROP TRIGGER IF EXISTS on_new_notification ON notifications;
DROP TRIGGER IF EXISTS "send-email-on-notification" ON notifications;

-- 2. Drop the old function
DROP FUNCTION IF EXISTS handle_new_notification();

-- 3. Create a clean, authoritative trigger function for notifications
CREATE OR REPLACE FUNCTION public.trigger_email_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_webhook_secret TEXT := 'acob_notification_trigger_secret_2026';
BEGIN
  -- Use net.http_post to call the edge function
  -- We provide the secret in the header so the function can bypass standard auth
  PERFORM
    net.http_post(
      url := 'https://itqegqxeqkeogwrvlzlj.supabase.co/functions/v1/send-email-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', v_webhook_secret
      ),
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', TG_TABLE_NAME,
        'record', row_to_json(NEW)
      ),
      timeout_milliseconds := 5000
    );
  RETURN NEW;
END;
$function$;

-- 4. Create the trigger
CREATE TRIGGER on_notification_created
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION trigger_email_notification();;
