-- ============================================================
-- FIX: Removed NEW.data which was causing the "no field data" error
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
    v_service_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0cWVncXhlcWtlb2d3cnZsemxqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY0MjQ1NywiZXhwIjoyMDc3MjE4NDU3fQ.uUEg9q9jT9IsERFmmhmYMxdIr_xgakdf52EmMEZbf50';
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

        -- Get Assigner Name
        SELECT full_name INTO v_assigner_name FROM public.profiles WHERE id = NEW.assigned_by;

        -- DETERMINE TARGET USER
        v_target_user_id := NEW.assigned_to;

        -- If assigned to a Department/Office, find the Dept Head
        IF v_target_user_id IS NULL AND NEW.department IS NOT NULL THEN
            SELECT department_head_id INTO v_target_user_id 
            FROM public.departments 
            WHERE name = NEW.department;
        END IF;

        -- Stop if no recipient found
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

        -- Construct the full data object
        v_asset_data := v_asset_data || jsonb_build_object(
            'assigned_by', COALESCE(v_assigner_name, 'System Admin'),
            'assigned_date', NEW.assigned_at,
            'assignment_type', NEW.assignment_type
        );

        -- 1. Insert UI notification
        INSERT INTO public.notifications (user_id, type, title, message, category, data)
        VALUES (
            v_target_user_id,
            v_notification_type,
            v_notification_title,
            v_notification_message,
            'assets',
            v_asset_data
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
                    'data',    v_asset_data
                )
            )
        );
    END IF;

    RETURN NEW;
END;
$$;;
