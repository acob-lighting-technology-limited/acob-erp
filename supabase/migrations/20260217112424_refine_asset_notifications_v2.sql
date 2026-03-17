-- 1. Refine handle_new_asset_assignment
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

        -- Check if this is a TRANSFER (Is there ANOTHER active owner right now?)
        SELECT assigned_to INTO v_prev_owner_id
        FROM public.asset_assignments 
        WHERE asset_id = NEW.asset_id 
          AND id != NEW.id 
          AND is_current = true
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

-- 2. Refine handle_asset_return
CREATE OR REPLACE FUNCTION public.handle_asset_return()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_asset_data jsonb;
    v_returner_name text;
    v_authorizer_name text;
    v_has_new_owner boolean;
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
        
        -- Get Authorizer Name (the person who updated the record)
        SELECT full_name INTO v_authorizer_name FROM public.profiles WHERE id = auth.uid();

        -- Check if this return is due to TRANSFER (Is there a different active assignment?)
        SELECT EXISTS(
            SELECT 1 FROM public.asset_assignments 
            WHERE asset_id = NEW.asset_id 
              AND is_current = true 
              AND id != NEW.id
        ) INTO v_has_new_owner;

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
            CASE WHEN v_has_new_owner THEN 'asset_transfer_outgoing' ELSE 'asset_returned' END,
            CASE WHEN v_has_new_owner THEN 'Asset Transfer Initiated' ELSE 'Asset Officially Returned' END,
            CASE 
                WHEN v_has_new_owner THEN 'Asset ' || (v_asset_data->>'unique_code') || ' has been transferred from your custody.'
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

-- 3. Refine handle_asset_status_change
CREATE OR REPLACE FUNCTION public.handle_asset_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_asset_data jsonb;
    v_assigned_to uuid;
BEGIN
    -- 1. Status Alert (Damage/Loss/Maintenance)
    IF NEW.status IN ('maintenance', 'retired') AND OLD.status != NEW.status THEN
        -- Get current owner if exists
        SELECT assigned_to INTO v_assigned_to
        FROM public.asset_assignments
        WHERE asset_id = NEW.id AND is_current = true
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
                'asset_status_alert',
                'Asset Status Alert',
                'The status of asset ' || NEW.unique_code || ' has been updated to ' || NEW.status || '.',
                'assets',
                v_asset_data || jsonb_build_object(
                    'status_action', NEW.status,
                    'status_description', 'Updated via Admin Panel',
                    'date', now()
                )
            );
        END IF;

    -- 2. Status Fixed (Back to Operational)
    ELSIF OLD.status IN ('maintenance', 'retired') AND NEW.status IN ('available', 'assigned') THEN
        -- Get current owner if exists
        SELECT assigned_to INTO v_assigned_to
        FROM public.asset_assignments
        WHERE asset_id = NEW.id AND is_current = true
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
                'Asset ' || NEW.unique_code || ' is now fully operational.',
                'assets',
                v_asset_data || jsonb_build_object(
                    'resolution_note', 'Restored to ' || NEW.status,
                    'date', now()
                )
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

-- 4. Re-attach triggers to notifications table if necessary
-- Note: trigger_email_notification should already be on notifications table AFTER INSERT.
;
