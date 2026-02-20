CREATE OR REPLACE FUNCTION public.handle_new_asset_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_asset_data jsonb;
  v_assigner_name text;
  v_prev_owner_id uuid;
  v_target_user_id uuid;
  v_notification_type text;
  v_notification_title text;
  v_notification_message text;
  v_notification_id uuid;
  v_unique_code text;
  v_fingerprint text;
  v_send_after timestamptz := now() + interval '5 minutes';
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT
      jsonb_build_object(
        'unique_code', unique_code,
        'asset_type', asset_type,
        'asset_model', asset_model,
        'serial_number', serial_number,
        'department', department
      ),
      unique_code
    INTO v_asset_data, v_unique_code
    FROM public.assets
    WHERE id = NEW.asset_id;

    SELECT full_name INTO v_assigner_name
    FROM public.profiles
    WHERE id = NEW.assigned_by;

    v_target_user_id := NEW.assigned_to;

    IF v_target_user_id IS NULL AND NEW.department IS NOT NULL THEN
      SELECT department_head_id
      INTO v_target_user_id
      FROM public.departments
      WHERE name = NEW.department;
    END IF;

    IF v_target_user_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT assigned_to
    INTO v_prev_owner_id
    FROM public.asset_assignments
    WHERE asset_id = NEW.asset_id
      AND id != NEW.id
      AND (
        is_current = true
        OR (is_current = false AND handed_over_at >= (now() - interval '10 seconds'))
      )
    ORDER BY handed_over_at DESC NULLS FIRST
    LIMIT 1;

    v_notification_type := CASE WHEN v_prev_owner_id IS NOT NULL THEN 'asset_transfer_incoming' ELSE 'asset_assigned' END;
    v_notification_title := CASE WHEN v_prev_owner_id IS NOT NULL THEN 'Asset Transfer Received' ELSE 'Asset Officially Assigned' END;
    v_notification_message := CASE
      WHEN v_prev_owner_id IS NOT NULL THEN 'An asset has been transferred to your custody/unit.'
      ELSE 'An asset (' || coalesce(v_unique_code, NEW.asset_id::text) || ') has been assigned to you/your unit.'
    END;

    v_asset_data := coalesce(v_asset_data, '{}'::jsonb) || jsonb_build_object(
      'assigned_by', coalesce(v_assigner_name, 'System Admin'),
      'assigned_date', NEW.assigned_at,
      'assignment_type', NEW.assignment_type
    );

    -- Strong dedupe key: same user + same asset + same event type.
    v_fingerprint := v_notification_type || '_' || v_target_user_id::text || '_' || coalesce(v_unique_code, NEW.asset_id::text);

    -- Prevent re-sending to same recipient for same asset/event if already queued/sent.
    IF EXISTS (
      SELECT 1
      FROM public.notification_queue nq
      WHERE nq.user_id = v_target_user_id
        AND nq.fingerprint = v_fingerprint
        AND nq.status IN ('pending', 'processing', 'sent')
    ) THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, message, category, data)
    VALUES (
      v_target_user_id,
      v_notification_type,
      v_notification_title,
      v_notification_message,
      'assets',
      v_asset_data
    )
    RETURNING id INTO v_notification_id;

    -- Queue email with 5-minute grace period (so mistakes can be corrected/cancelled).
    INSERT INTO public.notification_queue (
      user_id,
      type,
      title,
      message,
      data,
      status,
      fingerprint,
      scheduled_for,
      process_after
    ) VALUES (
      v_target_user_id,
      v_notification_type,
      v_notification_title,
      v_notification_message,
      v_asset_data,
      'pending',
      v_fingerprint,
      v_send_after,
      v_send_after
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_pending_asset_notifications()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF (NEW.assigned_to IS DISTINCT FROM OLD.assigned_to OR NEW.is_current != OLD.is_current) THEN
    UPDATE public.notification_queue
    SET status = 'cancelled'
    WHERE status = 'pending'
      AND data->>'unique_code' = (SELECT unique_code FROM public.assets WHERE id = NEW.asset_id)
      AND (
        (process_after IS NOT NULL AND process_after > now())
        OR (scheduled_for IS NOT NULL AND scheduled_for > now())
      );
  END IF;
  RETURN NEW;
END;
$function$;
