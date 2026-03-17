-- 1. Ensure Table Columns Exist
ALTER TABLE public.notification_queue 
ADD COLUMN IF NOT EXISTS process_after timestamptz DEFAULT (now() + interval '5 minutes');

ALTER TABLE public.notification_queue 
ADD COLUMN IF NOT EXISTS fingerprint text;

-- 2. Index for faster processing
CREATE INDEX IF NOT EXISTS idx_notification_queue_status_process_after ON public.notification_queue(status, process_after);

-- 3. Function to Process Queue (Updated)
CREATE OR REPLACE FUNCTION public.process_notification_batch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r RECORD;
    v_webhook_secret text := '4a8f9c2e-7d1b-4a5c-9e3d-8f2a1b6c5d9e';
BEGIN
    FOR r IN 
        SELECT * FROM public.notification_queue 
        WHERE status = 'pending' 
        AND (process_after IS NULL OR process_after <= now())
        FOR UPDATE SKIP LOCKED
        LIMIT 10
    LOOP
        UPDATE public.notification_queue SET status = 'processing' WHERE id = r.id;
        
        PERFORM net.http_post(
            url := 'https://itqegqxeqkeogwrvlzlj.supabase.co/functions/v1/send-email-notification',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'x-webhook-secret', v_webhook_secret
            ),
            body := jsonb_build_object('record', row_to_json(r))
        );

        UPDATE public.notification_queue 
        SET status = 'sent', processed_at = now() 
        WHERE id = r.id;
        
    END LOOP;
END;
$$;

-- 4. Triggers to Populate Queue

-- A. Asset Assignments (Insert = Assignment or Incoming Transfer)
CREATE OR REPLACE FUNCTION public.handle_new_asset_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_fingerprint text;
    v_asset_data jsonb;
    v_previous_assignment RECORD;
BEGIN
    v_fingerprint := 'assign_' || NEW.id;

    SELECT jsonb_build_object(
        'unique_code', unique_code, 
        'asset_type', asset_type, 
        'asset_model', asset_model, 
        'serial_number', serial_number
    ) INTO v_asset_data
    FROM public.assets WHERE id = NEW.asset_id;

    -- Check for previous assignment (Transfer Logic)
    SELECT * INTO v_previous_assignment 
    FROM public.asset_assignments 
    WHERE asset_id = NEW.asset_id 
    AND id != NEW.id 
    ORDER BY assigned_at DESC 
    LIMIT 1;

    IF v_previous_assignment.assigned_to IS NOT NULL AND v_previous_assignment.assigned_to != NEW.assigned_to THEN
       -- 1. Notify NEW Owner (Incoming)
       INSERT INTO public.notification_queue (user_id, type, title, fingerprint, data, process_after)
       VALUES (
           NEW.assigned_to,
           'asset_transfer_incoming',
           'Asset Transfer Received',
           v_fingerprint || '_in',
           v_asset_data || jsonb_build_object('assigned_by', NEW.assigned_by, 'condition', NEW.condition_on_assignment),
           now() + interval '5 minutes'
       );
       
       -- 2. Notify PREVIOUS Owner (Outgoing)
       INSERT INTO public.notification_queue (user_id, type, title, fingerprint, data, process_after)
       VALUES (
           v_previous_assignment.assigned_to,
           'asset_transfer_outgoing',
           'Asset Transfer Initiated',
           v_fingerprint || '_out',
           v_asset_data || jsonb_build_object('authorized_by', NEW.assigned_by),
           now() + interval '5 minutes'
       );
       
    ELSE
        -- Standard Allocation
        INSERT INTO public.notification_queue (user_id, type, title, fingerprint, data, process_after)
        VALUES (
            NEW.assigned_to,
            'asset_assignment',
            'Asset Officially Assigned',
            v_fingerprint,
            v_asset_data || jsonb_build_object('assigned_by', NEW.assigned_by),
            now() + interval '5 minutes'
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_asset_assignment_created ON public.asset_assignments;
CREATE TRIGGER on_asset_assignment_created
AFTER INSERT ON public.asset_assignments
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_asset_assignment();


-- B. Asset Returns (Update on Asset Assignment where returned_at is set)
CREATE OR REPLACE FUNCTION public.handle_asset_return()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_fingerprint text;
    v_asset_data jsonb;
BEGIN
    IF OLD.returned_at IS NULL AND NEW.returned_at IS NOT NULL THEN
        v_fingerprint := 'return_' || NEW.id;

        SELECT jsonb_build_object(
            'unique_code', unique_code, 
            'asset_type', asset_type, 
            'asset_model', asset_model, 
            'serial_number', serial_number
        ) INTO v_asset_data
        FROM public.assets WHERE id = NEW.asset_id;

        INSERT INTO public.notification_queue (user_id, type, title, fingerprint, data, process_after)
        VALUES (
            NEW.assigned_to,
            'asset_returned',
            'Asset Officially Returned',
            v_fingerprint,
            v_asset_data || jsonb_build_object('returned_by', 'User', 'authorized_by', 'Store/IT'),
            now() + interval '5 minutes'
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_asset_assignment_return ON public.asset_assignments;
CREATE TRIGGER on_asset_assignment_return
AFTER UPDATE ON public.asset_assignments
FOR EACH ROW
EXECUTE FUNCTION public.handle_asset_return();
;
