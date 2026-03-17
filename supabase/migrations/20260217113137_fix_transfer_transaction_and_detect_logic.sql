-- 1. Correct handle_new_asset_assignment to detect "Recently Closed" assignments as transfers
-- This avoids needing two 'is_current=true' records at once (which violates the unique index)
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

        -- DETECT TRANSFER: Look for an assignment that was closed VERY recently (within 10 seconds)
        -- OR one that is still current (though the index usually blocks this, it helps if the order is swapped)
        SELECT assigned_to INTO v_prev_owner_id
        FROM public.asset_assignments 
        WHERE asset_id = NEW.asset_id 
          AND id != NEW.id 
          AND (
            is_current = true 
            OR (is_current = false AND handed_over_at >= (now() - interval '10 seconds'))
          )
        ORDER BY handed_over_at DESC NULLS FIRST
        LIMIT 1;

        -- Create notification record
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

-- 2. Correct handle_asset_return to detect if it's a transfer based on notes or recent activity
CREATE OR REPLACE FUNCTION public.handle_asset_return()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_asset_data jsonb;
    v_returner_name text;
    v_authorizer_name text;
    v_is_transfer boolean;
BEGIN
    -- Check if is_current changed from TRUE to FALSE (Closing/Returning)
    IF OLD.is_current = true AND NEW.is_current = false THEN
        
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
        
        -- Get Authorizer Name
        SELECT full_name INTO v_authorizer_name FROM public.profiles WHERE id = auth.uid();

        -- DETECT IF REASSIGNMENT (Was it marked as Reassigned in notes?)
        v_is_transfer := (NEW.handover_notes LIKE '%Reassigned%');

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
            CASE WHEN v_is_transfer THEN 'asset_transfer_outgoing' ELSE 'asset_returned' END,
            CASE WHEN v_is_transfer THEN 'Asset Transfer Initiated' ELSE 'Asset Officially Returned' END,
            CASE 
                WHEN v_is_transfer THEN 'Asset ' || (v_asset_data->>'unique_code') || ' has been transferred from your custody.'
                ELSE 'You have successfully returned asset ' || (v_asset_data->>'unique_code') || '.'
            END,
            'assets',
            v_asset_data || jsonb_build_object(
                'returned_by', COALESCE(v_returner_name, 'User'),
                'authorized_by', COALESCE(v_authorizer_name, 'System Admin'),
                'return_date', COALESCE(NEW.handed_over_at, now()),
                'transfer_date', COALESCE(NEW.handed_over_at, now())
            )
        );
    END IF;

    RETURN NEW;
END;
$function$;
;
