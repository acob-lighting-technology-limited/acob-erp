-- 1. Upgrade the asset assignment notification trigger to handle UPDATES
CREATE OR REPLACE FUNCTION public.handle_new_asset_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_fingerprint text;
    v_asset_data jsonb;
    v_assigner_name text;
    v_should_notify boolean := false;
BEGIN
    -- Only trigger if it's a new record OR if the recipient changed on an active assignment
    IF TG_OP = 'INSERT' THEN
        v_should_notify := true;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Notify if assigned_to changed and is not null
        IF (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to AND NEW.assigned_to IS NOT NULL) OR
           (OLD.department IS DISTINCT FROM NEW.department AND NEW.department IS NOT NULL) OR
           (OLD.office_location IS DISTINCT FROM NEW.office_location AND NEW.office_location IS NOT NULL) THEN
            v_should_notify := true;
        END IF;
        
        -- Also notify if a previously non-current assignment is made current
        IF OLD.is_current = false AND NEW.is_current = true THEN
            v_should_notify := true;
        END IF;
    END IF;

    IF NOT v_should_notify THEN
        RETURN NEW;
    END IF;

    v_fingerprint := 'assignment_' || NEW.id || '_' || COALESCE(NEW.assigned_to::text, NEW.department, NEW.office_location);

    -- Get Asset Details
    SELECT jsonb_build_object(
        'unique_code', unique_code, 
        'asset_type', asset_type, 
        'asset_model', asset_model, 
        'serial_number', serial_number
    ) INTO v_asset_data
    FROM public.assets WHERE id = NEW.asset_id;

    -- Get Assigner Name
    SELECT full_name INTO v_assigner_name FROM public.profiles WHERE id = NEW.assigned_by;

    -- Determine recipient and notification details
    IF NEW.assigned_to IS NOT NULL THEN
        -- INDIVIDUAL
        IF TG_OP = 'INSERT' AND NEW.assigned_from IS NOT NULL THEN
            -- INCOMING TRANSFER (Reassignment)
            INSERT INTO public.notification_queue (user_id, type, title, message, fingerprint, data, process_after)
            VALUES (
                NEW.assigned_to,
                'asset_transfer_incoming',
                'Asset Transfer Received',
                'You have received asset ' || (v_asset_data->>'unique_code') || ' via transfer.',
                v_fingerprint,
                v_asset_data || jsonb_build_object(
                    'assigned_by', COALESCE(v_assigner_name, 'System'),
                    'assigned_date', NEW.assigned_at
                ),
                now()
            );
        ELSE
            -- REGULAR ASSIGNMENT
            INSERT INTO public.notification_queue (user_id, type, title, message, fingerprint, data, process_after)
            VALUES (
                NEW.assigned_to,
                'asset_assignment',
                'Asset Officially Assigned',
                'You have been assigned asset ' || (v_asset_data->>'unique_code') || '.',
                v_fingerprint,
                v_asset_data || jsonb_build_object(
                    'assigned_by', COALESCE(v_assigner_name, 'System'),
                    'assigned_date', NEW.assigned_at
                ),
                now()
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

-- 2. Update the trigger to fire on UPDATE as well
DROP TRIGGER IF EXISTS on_asset_assignment_created ON asset_assignments;
CREATE TRIGGER on_asset_assignment_created
  AFTER INSERT OR UPDATE ON asset_assignments
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_asset_assignment();
;
