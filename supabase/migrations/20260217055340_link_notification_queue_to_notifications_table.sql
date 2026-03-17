-- Update the process_notification_queue to ALSO insert into the notifications table
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
BEGIN
  FOR r IN 
    SELECT * FROM public.notification_queue 
    WHERE status != 'sent' AND status != 'cancelled'
    LIMIT 20
  LOOP
    -- 1. Create a record in the actual notifications table so it shows in UI
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      data,
      priority,
      created_at
    ) VALUES (
      r.user_id,
      r.type,
      r.title,
      r.message,
      r.data,
      'normal',
      NOW()
    ) RETURNING id INTO v_notification_id;

    -- 2. Mark as processing in queue
    UPDATE public.notification_queue SET status = 'processing' WHERE id = r.id;

    -- 3. Call the Edge Function
    -- Note: The Edge Function also has a trigger on the notifications table, 
    -- but process_notification_queue calls it directly. 
    -- To avoid double-emailing, we should rely on the notifications table trigger ONLY
    -- OR keep this direct call but make sure the notifications trigger doesn't double it.
    
    -- Actually, the best way is to let the notifications table trigger handle the email.
    -- So we DON'T need the net.http_post here anymore if the trigger is active.
    
    /* 
    PERFORM net.http_post( ... ); 
    */

    -- Mark as sent in queue
    UPDATE public.notification_queue 
    SET status = 'sent', 
        sent_at = NOW() 
    WHERE id = r.id;
  END LOOP;
END;
$function$;
;
