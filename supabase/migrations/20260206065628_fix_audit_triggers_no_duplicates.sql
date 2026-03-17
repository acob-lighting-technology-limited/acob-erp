-- Step 1: Clean up orphaned entries with entity_type='asset' (singular)
DELETE FROM audit_logs WHERE entity_type = 'asset';

-- Step 2: Modify assets trigger to NOT log assignment-related updates
-- (status changes to 'assigned' will be handled by the assignment trigger)
CREATE OR REPLACE FUNCTION audit_log_changes()
RETURNS TRIGGER AS $$
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
BEGIN
    -- Determine the action
    IF (TG_OP = 'INSERT') THEN
        v_action := 'create';
        v_new_data := to_jsonb(NEW);
        v_entity_id := NEW.id::TEXT;
        
        SELECT array_agg(key) INTO v_changed_fields
        FROM jsonb_object_keys(v_new_data) AS key;
        
    ELSIF (TG_OP = 'UPDATE') THEN
        v_action := 'update';
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_entity_id := NEW.id::TEXT;
        
        -- SKIP assignment-related updates for assets (let assignment trigger handle)
        IF TG_TABLE_NAME = 'assets' THEN
            -- Skip if status changed to 'assigned' (assignment trigger will log)
            IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'assigned' THEN
                RETURN NEW;
            END IF;
        END IF;
        
        -- Compute changed fields
        FOR v_key IN SELECT jsonb_object_keys(v_new_data)
        LOOP
            v_old_val := v_old_data -> v_key;
            v_new_val := v_new_data -> v_key;
            
            IF v_key IN ('updated_at', 'created_at') THEN
                CONTINUE;
            END IF;
            
            IF (v_old_val IS DISTINCT FROM v_new_val) THEN
                v_changed_fields := array_append(v_changed_fields, v_key);
            END IF;
        END LOOP;
        
        -- Skip if no meaningful changes
        IF array_length(v_changed_fields, 1) IS NULL OR array_length(v_changed_fields, 1) = 0 THEN
            RETURN NEW;
        END IF;
        
    ELSIF (TG_OP = 'DELETE') THEN
        v_action := 'delete';
        v_old_data := to_jsonb(OLD);
        v_entity_id := OLD.id::TEXT;
    END IF;

    v_entity_type := TG_TABLE_NAME;

    -- Extract department
    IF TG_TABLE_NAME = 'assets' THEN
        v_department := COALESCE(NEW.department, NEW.office_location, OLD.department, OLD.office_location);
    ELSIF TG_TABLE_NAME IN ('department_payments', 'payment_documents', 'profiles', 'tasks', 'performance_reviews', 'attendance_records') THEN
        v_department := COALESCE(NEW.department, OLD.department);
    END IF;

    -- Insert audit log
    INSERT INTO audit_logs (
        user_id, operation, action, table_name, entity_type,
        record_id, entity_id, old_values, new_values,
        changed_fields, department, metadata, status
    )
    VALUES (
        auth.uid(), TG_OP, v_action, TG_TABLE_NAME, v_entity_type,
        v_entity_id, v_entity_id, v_old_data, v_new_data,
        v_changed_fields, v_department,
        jsonb_build_object('trigger', TG_NAME, 'schema', TG_TABLE_SCHEMA),
        'success'
    );

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Audit log error: %', SQLERRM;
        IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Enhance assignment trigger to include employee_number
CREATE OR REPLACE FUNCTION audit_asset_assignment_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_action TEXT;
    v_asset_data RECORD;
    v_assigned_user RECORD;
    v_from_user RECORD;
    v_new_values JSONB;
    v_old_values JSONB;
BEGIN
    -- Get asset info
    SELECT id, unique_code, asset_name, asset_type, serial_number, department, office_location
    INTO v_asset_data
    FROM assets WHERE id = NEW.asset_id;

    -- Get assigned-to user info (including employee_number)
    SELECT id, first_name, last_name, department, employee_number
    INTO v_assigned_user
    FROM profiles WHERE id = NEW.assigned_to;

    -- Determine action
    IF TG_OP = 'INSERT' THEN
        IF NEW.assigned_from IS NOT NULL THEN
            v_action := 'reassign';
            SELECT id, first_name, last_name, department, employee_number
            INTO v_from_user
            FROM profiles WHERE id = NEW.assigned_from;
        ELSE
            v_action := 'assign';
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'update';
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'unassign';
    END IF;

    -- Build comprehensive new_values with ALL relevant data
    v_new_values := jsonb_build_object(
        -- Assignment info
        'id', NEW.id,
        'asset_id', NEW.asset_id,
        'assignment_type', NEW.assignment_type,
        'office_location', NEW.office_location,
        'is_current', NEW.is_current,
        'assigned_at', NEW.assigned_at,
        
        -- Asset info
        'unique_code', v_asset_data.unique_code,
        'asset_name', v_asset_data.asset_name,
        'asset_type', v_asset_data.asset_type,
        'serial_number', v_asset_data.serial_number,
        
        -- Assigned-to user info
        'assigned_to', NEW.assigned_to,
        'assigned_to_name', CONCAT(v_assigned_user.first_name, ' ', v_assigned_user.last_name),
        'assigned_to_employee_number', v_assigned_user.employee_number,
        'department', COALESCE(v_assigned_user.department, v_asset_data.department, v_asset_data.office_location),
        
        -- Assigned-from user info (for reassignments)
        'assigned_from', NEW.assigned_from,
        'assigned_from_name', CASE WHEN v_from_user.id IS NOT NULL 
            THEN CONCAT(v_from_user.first_name, ' ', v_from_user.last_name) ELSE NULL END,
        'assigned_from_employee_number', v_from_user.employee_number
    );

    -- Build old_values if update/delete
    IF TG_OP != 'INSERT' THEN
        v_old_values := to_jsonb(OLD);
    END IF;

    -- Insert ONE comprehensive audit log entry
    INSERT INTO audit_logs (
        user_id, operation, action, table_name, entity_type,
        record_id, entity_id, old_values, new_values,
        department, metadata, status
    )
    VALUES (
        auth.uid(), TG_OP, v_action, 'asset_assignments', 'assets',
        NEW.id::TEXT, NEW.asset_id::TEXT, v_old_values, v_new_values,
        COALESCE(v_assigned_user.department, v_asset_data.department, v_asset_data.office_location),
        jsonb_build_object('trigger', TG_NAME, 'assignment_id', NEW.id),
        'success'
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Assignment audit error: %', SQLERRM;
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;;
