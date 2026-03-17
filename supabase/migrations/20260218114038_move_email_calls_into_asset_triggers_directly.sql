-- ============================================================
-- ROOT CAUSE FIX:
-- Both handle_new_asset_assignment and handle_asset_return fire
-- in the same transaction during a transfer. Both insert into
-- notifications, which triggers send_email_on_notification_insert
-- twice in the same txn. pg_net only reliably dispatches one
-- net.http_post per transaction when called from a nested trigger.
--
-- SOLUTION: Remove the notifications-table trigger and instead
-- call net.http_post DIRECTLY inside each asset trigger function,
-- so each HTTP call is made from its own trigger context.
-- ============================================================

-- STEP 1: Drop the notifications INSERT trigger (no longer needed)
DROP TRIGGER IF EXISTS send_email_on_notification_insert ON public.notifications;

-- STEP 2: Rewrite handle_new_asset_assignment to call email directly
CREATE OR REPLACE FUNCTION public.handle_new_asset_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_asset_data jsonb;
    v_assigner_name text;
    v_prev_owner_id uuid;
    v_notification_type text;
    v_notification_title text;
    v_notification_message text;
    v_notification_id uuid;
    v_service_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0cWVncXhlcWtlb2d3cnZsemxqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY0MjQ1NywiZXhwIjoyMDc3MjE4NDU3fQ.uUEg9q9jT9IsERFmmhmYMxdIr_xgakdf52EmMEZbf50';
    v_webhook_secret TEXT := 'acob_notification_trigger_secret_2026';
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

        -- DETECT TRANSFER: Look for a recently closed assignment (within 10 seconds)
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

        -- Determine notification type
        v_notification_type    := CASE WHEN v_prev_owner_id IS NOT NULL THEN 'asset_transfer_incoming' ELSE 'asset_assigned' END;
        v_notification_title   := CASE WHEN v_prev_owner_id IS NOT NULL THEN 'Asset Transfer Received' ELSE 'Asset Officially Assigned' END;
        v_notification_message := CASE
            WHEN v_prev_owner_id IS NOT NULL THEN 'An asset has been transferred to your custody. You are now responsible for it.'
            ELSE 'You have been assigned asset ' || (v_asset_data->>'unique_code') || '.'
        END;

        -- 1. Insert UI notification
        INSERT INTO public.notifications (user_id, type, title, message, category, data)
        VALUES (
            NEW.assigned_to,
            v_notification_type,
            v_notification_title,
            v_notification_message,
            'assets',
            v_asset_data || jsonb_build_object(
                'assigned_by', COALESCE(v_assigner_name, 'System Admin'),
                'assigned_date', NEW.assigned_at,
                'is_transfer', (v_prev_owner_id IS NOT NULL)
            )
        ) RETURNING id INTO v_notification_id;

        -- 2. Fire email directly from this trigger (not via notifications trigger)
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
                    'type',    v_notification_type,
                    'title',   v_notification_title,
                    'message', v_notification_message,
                    'data',    v_asset_data || jsonb_build_object(
                        'assigned_by', COALESCE(v_assigner_name, 'System Admin'),
                        'assigned_date', NEW.assigned_at,
                        'is_transfer', (v_prev_owner_id IS NOT NULL)
                    )
                )
            )
        );

    END IF;

    RETURN NEW;
END;
$$;

-- STEP 3: Rewrite handle_asset_return to call email directly
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
    v_notification_type text;
    v_notification_title text;
    v_notification_message text;
    v_notification_id uuid;
    v_service_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0cWVncXhlcWtlb2d3cnZsemxqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY0MjQ1NywiZXhwIjoyMDc3MjE4NDU3fQ.uUEg9q9jT9IsERFmmhmYMxdIr_xgakdf52EmMEZbf50';
    v_webhook_secret TEXT := 'acob_notification_trigger_secret_2026';
BEGIN
    -- Only fire when is_current changes from TRUE to FALSE (closing an assignment)
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

        -- Detect if this is a transfer (reassignment) or a plain return
        v_is_transfer := (NEW.handover_notes LIKE '%Reassigned%');

        v_notification_type    := CASE WHEN v_is_transfer THEN 'asset_transfer_outgoing' ELSE 'asset_returned' END;
        v_notification_title   := CASE WHEN v_is_transfer THEN 'Asset Transfer Initiated' ELSE 'Asset Officially Returned' END;
        v_notification_message := CASE
            WHEN v_is_transfer THEN 'Asset ' || (v_asset_data->>'unique_code') || ' has been transferred from your custody.'
            ELSE 'You have successfully returned asset ' || (v_asset_data->>'unique_code') || '.'
        END;

        -- 1. Insert UI notification
        INSERT INTO public.notifications (user_id, type, title, message, category, data)
        VALUES (
            NEW.assigned_to,
            v_notification_type,
            v_notification_title,
            v_notification_message,
            'assets',
            v_asset_data || jsonb_build_object(
                'returned_by',   COALESCE(v_returner_name, 'User'),
                'authorized_by', COALESCE(v_authorizer_name, 'System Admin'),
                'return_date',   COALESCE(NEW.handed_over_at, now()),
                'transfer_date', COALESCE(NEW.handed_over_at, now())
            )
        ) RETURNING id INTO v_notification_id;

        -- 2. Fire email directly from this trigger
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
                    'type',    v_notification_type,
                    'title',   v_notification_title,
                    'message', v_notification_message,
                    'data',    v_asset_data || jsonb_build_object(
                        'returned_by',   COALESCE(v_returner_name, 'User'),
                        'authorized_by', COALESCE(v_authorizer_name, 'System Admin'),
                        'return_date',   COALESCE(NEW.handed_over_at, now()),
                        'transfer_date', COALESCE(NEW.handed_over_at, now())
                    )
                )
            )
        );

    END IF;

    RETURN NEW;
END;
$$;;
