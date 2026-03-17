-- 1. FIX: handle_new_asset_assignment
-- Now correctly identifies Transfer (Type 3) vs Assignment (Type 1)
-- and uses 'notifications' table to trigger immediate email via existing trigger
CREATE OR REPLACE FUNCTION public.handle_new_asset_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_asset_data jsonb;
    v_assigner_name text;
    v_prev_owner_id uuid;
BEGIN
    -- Only handle on INSERT (New Assignment record)
    -- UPDATEs are handled by handle_asset_return for closing out old ones
    IF TG_OP = 'INSERT' AND NEW.assigned_to IS NOT NULL THEN
        
        -- Get Asset Data
        SELECT jsonb_build_object(
            'unique_code', unique_code, 
            'asset_type', asset_type, 
            'asset_model', asset_model, 
            'serial_number', serial_number,
            'department', department
        ) INTO v_asset_data
        FROM public.assets WHERE id = NEW.asset_id;

        -- Get Assigner Name
        SELECT full_name INTO v_assigner_name FROM public.profiles WHERE id = NEW.assigned_by;

        -- Check if this is a TRANSFER (Was there a previous owner recently?)
        SELECT assigned_to INTO v_prev_owner_id
        FROM public.asset_assignments 
        WHERE asset_id = NEW.asset_id 
          AND id != NEW.id 
          AND handed_over_at IS NOT NULL
        ORDER BY handed_over_at DESC 
        LIMIT 1;

        -- Create notification record (This triggers the email edge function via on_notification_created trigger)
        INSERT INTO public.notifications (
            user_id, 
            type, 
            title, 
            message, 
            category,
            data
        )
        VALUES (
            NEW.assigned_to,
            CASE WHEN v_prev_owner_id IS NOT NULL THEN 'asset_transfer_incoming' ELSE 'asset_assigned' END,
            CASE WHEN v_prev_owner_id IS NOT NULL THEN 'Asset Transfer Received' ELSE 'Asset Officially Assigned' END,
            CASE 
                WHEN v_prev_owner_id IS NOT NULL THEN 'An asset has been transferred to your custody. You are now responsible for it.'
                ELSE 'You have been assigned asset ' || (v_asset_data->>'unique_code') || '.'
            END,
            'assets',
            v_asset_data || jsonb_build_object(
                'assigned_by', COALESCE(v_assigner_name, 'System Admin'),
                'assigned_date', NEW.assigned_at,
                'is_transfer', (v_prev_owner_id IS NOT NULL)
            )
        );
    END IF;

    RETURN NEW;
END;
$function$;

-- 2. FIX: handle_asset_return
-- Now correctly notifies for Outgoing Transfer (Type 2) or Return (Type 4)
CREATE OR REPLACE FUNCTION public.handle_asset_return()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_asset_data jsonb;
    v_returner_name text;
    v_authorizer_name text;
    v_is_reassignment boolean;
BEGIN
    -- Check if handed_over_at is set (Return/Close out)
    IF OLD.handed_over_at IS NULL AND NEW.handed_over_at IS NOT NULL THEN
        
        SELECT jsonb_build_object(
            'unique_code', unique_code, 
            'asset_type', asset_type, 
            'asset_model', asset_model, 
            'serial_number', serial_number,
            'department', department
        ) INTO v_asset_data
        FROM public.assets WHERE id = NEW.asset_id;

        -- Get Returner Name
        SELECT full_name INTO v_returner_name FROM public.profiles WHERE id = NEW.assigned_to;
        
        -- Get Authorizer Name (the person who updated the record)
        SELECT full_name INTO v_authorizer_name FROM public.profiles WHERE id = auth.uid();

        -- Check if this return is due to REASSIGNMENT (Is there a new current assignment?)
        SELECT EXISTS(
            SELECT 1 FROM public.asset_assignments 
            WHERE asset_id = NEW.asset_id 
              AND is_current = true 
              AND id != NEW.id
        ) INTO v_is_reassignment;

        INSERT INTO public.notifications (
            user_id, 
            type, 
            title, 
            message,
            category,
            data
        )
        VALUES (
            NEW.assigned_to,
            CASE WHEN v_is_reassignment THEN 'asset_transfer_outgoing' ELSE 'asset_returned' END,
            CASE WHEN v_is_reassignment THEN 'Asset Transfer Initiated' ELSE 'Asset Officially Returned' END,
            CASE 
                WHEN v_is_reassignment THEN 'Asset ' || (v_asset_data->>'unique_code') || ' has been transferred from your custody.'
                ELSE 'You have successfully returned asset ' || (v_asset_data->>'unique_code') || '.'
            END,
            'assets',
            v_asset_data || jsonb_build_object(
                'returned_by', COALESCE(v_returner_name, 'User'),
                'authorized_by', COALESCE(v_authorizer_name, 'System Admin'),
                'return_date', NEW.handed_over_at,
                'transfer_date', NEW.handed_over_at
            )
        );
    END IF;

    RETURN NEW;
END;
$function$;

-- 3. FIX: handle_asset_status_change
-- Implements Asset Status Restored (Type 6)
CREATE OR REPLACE FUNCTION public.handle_asset_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_asset_data jsonb;
    v_assigned_to uuid;
    v_reporter_name text;
BEGIN
    SELECT full_name INTO v_reporter_name FROM public.profiles WHERE id = auth.uid();
    
    -- If status changes to 'maintenance' or 'retired' (Type 5: Status Alert)
    IF NEW.status IN ('maintenance', 'retired') AND OLD.status != NEW.status THEN
        
        -- Get current owner
        SELECT assigned_to INTO v_assigned_to
        FROM public.asset_assignments
        WHERE asset_id = NEW.id AND is_current = true
        LIMIT 1;

        -- Auto-close assignment if retired/maintenance
        UPDATE public.asset_assignments 
        SET 
            is_current = false,
            handed_over_at = now(),
            handover_notes = 'Auto-returned via Status Change to ' || NEW.status
        WHERE 
            asset_id = NEW.id 
            AND is_current = true;

        IF v_assigned_to IS NOT NULL THEN
            SELECT jsonb_build_object(
                'unique_code', unique_code, 
                'asset_type', asset_type, 
                'asset_model', asset_model, 
                'serial_number', serial_number,
                'department', department
            ) INTO v_asset_data
            FROM public.assets WHERE id = NEW.id;

            INSERT INTO public.notifications (user_id, type, title, message, category, data)
            VALUES (
                v_assigned_to,
                'asset_status_alert',
                'Asset Status Alert',
                'Asset ' || NEW.unique_code || ' status has been changed to ' || NEW.status || '.',
                'assets',
                v_asset_data || jsonb_build_object(
                    'status_action', NEW.status,
                    'status_description', 'Changed to ' || NEW.status,
                    'reported_by', COALESCE(v_reporter_name, 'ICT Department'),
                    'date', now()
                )
            );
        END IF;
    
    -- If status restored to 'available' or 'assigned' (Type 6: Status Restored)
    ELSIF OLD.status IN ('maintenance', 'retired') AND NEW.status IN ('available', 'assigned') THEN
        
        -- Get the person it was last assigned to (if it was auto-closed)
        SELECT assigned_to INTO v_assigned_to
        FROM public.asset_assignments
        WHERE asset_id = NEW.id 
        ORDER BY handed_over_at DESC NULLS LAST
        LIMIT 1;

        IF v_assigned_to IS NOT NULL THEN
            SELECT jsonb_build_object(
                'unique_code', unique_code, 
                'asset_type', asset_type, 
                'asset_model', asset_model, 
                'serial_number', serial_number,
                'department', department
            ) INTO v_asset_data
            FROM public.assets WHERE id = NEW.id;

            INSERT INTO public.notifications (user_id, type, title, message, category, data)
            VALUES (
                v_assigned_to,
                'asset_status_fixed',
                'Asset Status Restored',
                'Asset ' || NEW.unique_code || ' has been restored to ' || NEW.status || ' status.',
                'assets',
                v_asset_data || jsonb_build_object(
                    'resolution_note', 'The asset is now ' || NEW.status || ' and ready for use.',
                    'date', now()
                )
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;
;
