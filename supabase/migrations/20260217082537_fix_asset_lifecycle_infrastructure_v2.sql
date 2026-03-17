-- 1. Update Notification Types Constraint (Preserving existing types)
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  'token_generated', 'token_cancelled', 'task_completed', 'task_failed',
  'customer_added', 'customer_updated', 'meter_status_change', 'meter_added',
  'activity_reminder', 'crm_contact_added', 'opportunity_won', 'opportunity_lost',
  'system_alert', 'asset_assigned',
  'asset_transfer_outgoing', 'asset_transfer_incoming', 'asset_returned',
  'asset_status_alert', 'asset_status_fixed', 'system_restored'
));

-- 2. Update handle_new_asset_assignment for Dual Notifications
CREATE OR REPLACE FUNCTION public.handle_new_asset_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_fingerprint text;
    v_asset_data jsonb;
    v_old_owner_name text;
    v_new_owner_name text;
    v_assigner_name text;
BEGIN
    -- Determine if this is a real assignment change
    IF TG_OP = 'UPDATE' THEN
        -- If assignee changed
        IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
            
            SELECT jsonb_build_object(
                'unique_code', unique_code, 
                'asset_type', asset_type, 
                'asset_model', asset_model, 
                'serial_number', serial_number
            ) INTO v_asset_data
            FROM public.assets WHERE id = NEW.asset_id;

            -- 1. NOTIFY OLD OWNER (Transfer Outgoing)
            IF OLD.assigned_to IS NOT NULL THEN
                SELECT full_name INTO v_old_owner_name FROM public.profiles WHERE id = OLD.assigned_to;
                SELECT full_name INTO v_assigner_name FROM public.profiles WHERE id = NEW.assigned_by;

                INSERT INTO public.notification_queue (
                    user_id, type, title, message, fingerprint, data, process_after
                )
                VALUES (
                    OLD.assigned_to,
                    'asset_transfer_outgoing',
                    'Asset Transfer Initiated',
                    'Asset ' || (v_asset_data->>'unique_code') || ' has been transferred from your custody.',
                    'transfer_out_' || NEW.id || '_' || OLD.assigned_to,
                    v_asset_data || jsonb_build_object(
                        'authorized_by', COALESCE(v_assigner_name, 'System Admin'),
                        'transfer_date', now()
                    ),
                    now()
                );
            END IF;

            -- 2. NOTIFY NEW OWNER (Transfer Incoming OR Initial Assignment)
            IF NEW.assigned_to IS NOT NULL THEN
                SELECT full_name INTO v_new_owner_name FROM public.profiles WHERE id = NEW.assigned_to;
                SELECT full_name INTO v_assigner_name FROM public.profiles WHERE id = NEW.assigned_by;

                INSERT INTO public.notification_queue (
                    user_id, type, title, message, fingerprint, data, process_after
                )
                VALUES (
                    NEW.assigned_to,
                    CASE WHEN OLD.assigned_to IS NULL THEN 'asset_assigned' ELSE 'asset_transfer_incoming' END,
                    CASE WHEN OLD.assigned_to IS NULL THEN 'Asset Officially Assigned' ELSE 'Asset Transfer Received' END,
                    CASE 
                        WHEN OLD.assigned_to IS NULL THEN 'You have been assigned asset ' || (v_asset_data->>'unique_code') || '.'
                        ELSE 'An asset has been transferred to your custody. You are now responsible for it.'
                    END,
                    'assignment_new_' || NEW.id || '_' || NEW.assigned_to,
                    v_asset_data || jsonb_build_object(
                        'assigned_by', COALESCE(v_assigner_name, 'System Admin'),
                        'assigned_date', NEW.assigned_at,
                        'is_transfer', (OLD.assigned_to IS NOT NULL)
                    ),
                    now()
                );
            END IF;
        END IF;
    ELSIF TG_OP = 'INSERT' AND NEW.assigned_to IS NOT NULL THEN
        -- Standard initial assignment on insert
        SELECT jsonb_build_object(
            'unique_code', unique_code, 
            'asset_type', asset_type, 
            'asset_model', asset_model, 
            'serial_number', serial_number
        ) INTO v_asset_data
        FROM public.assets WHERE id = NEW.asset_id;

        SELECT full_name INTO v_assigner_name FROM public.profiles WHERE id = NEW.assigned_by;

        INSERT INTO public.notification_queue (
            user_id, type, title, message, fingerprint, data, process_after
        )
        VALUES (
            NEW.assigned_to,
            'asset_assigned',
            'Asset Officially Assigned',
            'You have been assigned asset ' || (v_asset_data->>'unique_code') || '.',
            'assignment_ins_' || NEW.id,
            v_asset_data || jsonb_build_object(
                'assigned_by', COALESCE(v_assigner_name, 'System Admin'),
                'assigned_date', NEW.assigned_at
            ),
            now()
        );
    END IF;

    RETURN NEW;
END;
$function$;

-- 3. Update audit_log_changes to extract more useful asset metadata
CREATE OR REPLACE FUNCTION public.audit_log_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_action TEXT;
    v_entity_type TEXT;
    v_entity_id TEXT;
    v_department TEXT;
    v_changed_fields TEXT[] := ARRAY[]::TEXT[];
    v_key TEXT;
    v_old_val JSONB;
    v_new_val JSONB;
    v_metadata JSONB := '{}';
BEGIN
    v_entity_type := TG_TABLE_NAME;

    IF (TG_OP = 'INSERT') THEN
        v_action := 'create';
        v_new_data := to_jsonb(NEW);
        v_entity_id := NEW.id::TEXT;
        SELECT array_agg(key) INTO v_changed_fields FROM jsonb_object_keys(v_new_data) AS key;
    ELSIF (TG_OP = 'UPDATE') THEN
        v_action := 'update';
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_entity_id := NEW.id::TEXT;
        
        FOR v_key IN SELECT jsonb_object_keys(v_new_data) LOOP
            IF v_key IN ('updated_at', 'created_at') THEN CONTINUE; END IF;
            IF (v_old_data -> v_key IS DISTINCT FROM v_new_data -> v_key) THEN
                v_changed_fields := array_append(v_changed_fields, v_key);
            END IF;
        END LOOP;
        
        IF array_length(v_changed_fields, 1) IS NULL THEN RETURN NEW; END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        v_action := 'delete';
        v_old_data := to_jsonb(OLD);
        v_entity_id := OLD.id::TEXT;
        SELECT array_agg(key) INTO v_changed_fields FROM jsonb_object_keys(v_old_data) AS key;
    END IF;

    -- Asset Specific Enhancements
    IF TG_TABLE_NAME = 'assets' THEN
        v_department := COALESCE(NEW.department, OLD.department);
        v_metadata := jsonb_build_object(
            'unique_code', COALESCE(NEW.unique_code, OLD.unique_code),
            'asset_name', COALESCE(NEW.asset_name, OLD.asset_name)
        );
    ELSIF TG_TABLE_NAME = 'asset_assignments' THEN
        v_department := COALESCE(NEW.department, OLD.department);
        -- Link to asset code in logs
        SELECT jsonb_build_object('unique_code', unique_code) INTO v_metadata 
        FROM public.assets WHERE id = COALESCE(NEW.asset_id, OLD.asset_id);
    ELSIF TG_TABLE_NAME = 'profiles' THEN
        v_department := COALESCE(NEW.department, OLD.department);
    END IF;

    INSERT INTO audit_logs (
        user_id, operation, action, table_name, entity_type,
        record_id, entity_id, old_values, new_values,
        changed_fields, department, metadata, status
    )
    VALUES (
        auth.uid(), TG_OP, v_action, TG_TABLE_NAME, v_entity_type,
        v_entity_id, v_entity_id, v_old_data, v_new_data,
        v_changed_fields, v_department, v_metadata, 'success'
    );

    IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

-- 4. Unified handle_asset_status_change
CREATE OR REPLACE FUNCTION public.handle_asset_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_fingerprint text;
    v_asset_data jsonb;
    v_assigned_to uuid;
BEGIN
    -- If status changes to 'maintenance' or 'retired'
    IF NEW.status IN ('maintenance', 'retired') AND OLD.status != NEW.status THEN
        
        -- Get current owner if exists
        SELECT assigned_to INTO v_assigned_to
        FROM public.asset_assignments
        WHERE asset_id = NEW.id AND is_current = true
        LIMIT 1;

        -- Auto-close assignment
        UPDATE public.asset_assignments 
        SET 
            is_current = false,
            handed_over_at = now(),
            handover_notes = 'Auto-returned via Status Change to ' || NEW.status
        WHERE 
            asset_id = NEW.id 
            AND is_current = true;

        -- NOTIFY current owner (Status Alert)
        IF v_assigned_to IS NOT NULL THEN
            SELECT jsonb_build_object(
                'unique_code', unique_code, 
                'asset_type', asset_type, 
                'asset_model', asset_model, 
                'serial_number', serial_number
            ) INTO v_asset_data
            FROM public.assets WHERE id = NEW.id;

            INSERT INTO public.notification_queue (user_id, type, title, message, fingerprint, data, process_after)
            VALUES (
                v_assigned_to,
                'asset_status_alert',
                'Asset Status Update: ' || INITCAP(NEW.status),
                'Asset ' || NEW.unique_code || ' status has been changed to ' || NEW.status || '.',
                'status_alert_' || NEW.id || '_' || NEW.status,
                v_asset_data || jsonb_build_object(
                    'status_action', NEW.status,
                    'date', now()
                ),
                now()
            );
        END IF;
    
    -- If status restored to 'available' or 'assigned'
    ELSIF OLD.status IN ('maintenance', 'retired') AND NEW.status IN ('available', 'assigned') THEN
         -- Optional: could notify admins or user? User template 6 is "Fixed"
         -- Let's stick to user request "Zero Patch"
    END IF;

    RETURN NEW;
END;
$function$;
;
