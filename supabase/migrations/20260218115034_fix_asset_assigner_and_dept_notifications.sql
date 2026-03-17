-- ============================================================
-- 1. Update handle_new_asset_assignment to:
--    a) Fix the "System Admin" name (using assigned_by instead of auth.uid)
--    b) Notify Dept Heads for Office/Dept assignments
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_asset_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_asset_data jsonb;
    v_assigner_name text;
    v_prev_owner_id uuid;
    v_target_user_id uuid;
    v_notification_type text;
    v_notification_title text;
    v_notification_message text;
    v_notification_id uuid;
    v_service_key TEXT := current_setting('app.service_role_key', true);
    v_webhook_secret TEXT := 'acob_notification_trigger_secret_2026';
BEGIN
    IF TG_OP = 'INSERT' THEN
        
        -- Get Asset Data
        SELECT jsonb_build_object(
            'unique_code', unique_code, 
            'asset_type', asset_type, 
            'asset_model', asset_model, 
            'serial_number', serial_number,
            'department', department
        ) INTO v_asset_data
        FROM public.assets WHERE id = NEW.asset_id;

        -- Get Assigner Name (Rafiat or whoever is in assigned_by)
        SELECT full_name INTO v_assigner_name FROM public.profiles WHERE id = NEW.assigned_by;

        -- DETERMINE TARGET USER (Who receives the mail?)
        v_target_user_id := NEW.assigned_to;

        -- If assigned to a Department/Office, find the Dept Head
        IF v_target_user_id IS NULL AND NEW.department IS NOT NULL THEN
            SELECT department_head_id INTO v_target_user_id 
            FROM public.departments 
            WHERE name = NEW.department;
        END IF;

        -- If still NULL (no head assigned or not a dept assignment), skip notification
        IF v_target_user_id IS NULL THEN
            RETURN NEW;
        END IF;

        -- DETECT TRANSFER
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

        v_notification_type    := CASE WHEN v_prev_owner_id IS NOT NULL THEN 'asset_transfer_incoming' ELSE 'asset_assigned' END;
        v_notification_title   := CASE WHEN v_prev_owner_id IS NOT NULL THEN 'Asset Transfer Received' ELSE 'Asset Officially Assigned' END;
        v_notification_message := CASE 
            WHEN v_prev_owner_id IS NOT NULL THEN 'An asset has been transferred to your custody/unit.'
            ELSE 'An asset (' || (v_asset_data->>'unique_code') || ') has been assigned to you/your unit.'
        END;

        -- 1. Insert UI notification
        INSERT INTO public.notifications (user_id, type, title, message, category, data)
        VALUES (
            v_target_user_id,
            v_notification_type,
            v_notification_title,
            v_notification_message,
            'assets',
            v_asset_data || jsonb_build_object(
                'assigned_by', COALESCE(v_assigner_name, 'System Admin'),
                'assigned_date', NEW.assigned_at,
                'assignment_type', NEW.assignment_type
            )
        ) RETURNING id INTO v_notification_id;

        -- 2. Call the Edge Function
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
                    'id',      v_notification_id,
                    'user_id', v_target_user_id,
                    'type',    v_notification_type,
                    'title',   v_notification_title,
                    'message', v_notification_message,
                    'data',    NEW.data -- Original data for template
                )
            )
        );
    END IF;

    RETURN NEW;
END;
$$;


-- ============================================================
-- 2. Update handle_asset_return to fix "System Admin"
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_asset_return()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_asset_data jsonb;
    v_returner_name text;
    v_authorizer_name text;
    v_is_transfer boolean;
    v_notification_id uuid;
    v_service_key TEXT := current_setting('app.service_role_key', true);
    v_webhook_secret TEXT := 'acob_notification_trigger_secret_2026';
BEGIN
    IF OLD.is_current = true AND NEW.is_current = false THEN
        
        SELECT jsonb_build_object(
            'unique_code', unique_code, 
            'asset_type', asset_type, 
            'asset_model', asset_model, 
            'serial_number', serial_number
        ) INTO v_asset_data
        FROM public.assets WHERE id = NEW.asset_id;

        -- Get names properly
        SELECT full_name INTO v_returner_name FROM public.profiles WHERE id = NEW.assigned_to;
        
        -- FIX: Use NEW.assigned_by if available, otherwise fallback to auth_uid or system
        SELECT full_name INTO v_authorizer_name FROM public.profiles WHERE id = COALESCE(NEW.assigned_by, auth.uid());

        v_is_transfer := (NEW.handover_notes LIKE '%Reassigned%');

        INSERT INTO public.notifications (user_id, type, title, message, category, data)
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
                'return_date', COALESCE(NEW.handed_over_at, now())
            )
        ) RETURNING id INTO v_notification_id;

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
                    'id',      v_notification_id,
                    'user_id', NEW.assigned_to,
                    'type',    CASE WHEN v_is_transfer THEN 'asset_transfer_outgoing' ELSE 'asset_returned' END,
                    'title',   CASE WHEN v_is_transfer THEN 'Asset Transfer Initiated' ELSE 'Asset Officially Returned' END,
                    'message', 'Asset update',
                    'data',    v_asset_data || jsonb_build_object('authorized_by', COALESCE(v_authorizer_name, 'System Admin'))
                )
            )
        );
    END IF;

    RETURN NEW;
END;
$$;;
