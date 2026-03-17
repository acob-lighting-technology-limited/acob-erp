-- Enhanced audit_log_changes function for complete asset logging
-- This version enriches asset logs with assigned user info and department

CREATE OR REPLACE FUNCTION audit_log_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_changed_data JSONB := '{}'::JSONB;
    v_old_changed JSONB := '{}'::JSONB;
    v_action TEXT;
    v_entity_type TEXT;
    v_entity_id TEXT;
    v_department TEXT;
    v_changed_fields TEXT[] := ARRAY[]::TEXT[];
    v_key TEXT;
    v_old_val JSONB;
    v_new_val JSONB;
    v_assigned_user_name TEXT;
    v_assigned_user_dept TEXT;
BEGIN
    -- Determine the action
    IF (TG_OP = 'INSERT') THEN
        v_action := 'create';
        v_new_data := to_jsonb(NEW);
        v_entity_id := NEW.id::TEXT;
        v_changed_data := v_new_data;
        
        -- Extract all keys as changed fields for INSERT
        SELECT array_agg(key) INTO v_changed_fields
        FROM jsonb_object_keys(v_new_data) AS key;
        
    ELSIF (TG_OP = 'UPDATE') THEN
        v_action := 'update';
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_entity_id := NEW.id::TEXT;
        
        -- Compute only the changed fields
        FOR v_key IN SELECT jsonb_object_keys(v_new_data)
        LOOP
            v_old_val := v_old_data -> v_key;
            v_new_val := v_new_data -> v_key;
            
            -- Skip timestamp fields
            IF v_key IN ('updated_at', 'created_at') THEN
                CONTINUE;
            END IF;
            
            IF (v_old_val IS DISTINCT FROM v_new_val) THEN
                v_changed_data := v_changed_data || jsonb_build_object(v_key, v_new_val);
                v_old_changed := v_old_changed || jsonb_build_object(v_key, v_old_val);
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

    -- Set entity type
    v_entity_type := TG_TABLE_NAME;

    -- Extract department based on table type
    IF TG_TABLE_NAME = 'assets' THEN
        v_department := COALESCE(
            NEW.department,
            NEW.office_location,
            OLD.department,
            OLD.office_location
        );
        
        -- For assets, try to get assigned user info if status is 'assigned'
        IF NEW.status = 'assigned' THEN
            SELECT 
                CONCAT(p.first_name, ' ', p.last_name),
                p.department
            INTO v_assigned_user_name, v_assigned_user_dept
            FROM asset_assignments aa
            JOIN profiles p ON aa.assigned_to = p.id
            WHERE aa.asset_id = NEW.id AND aa.is_current = true
            LIMIT 1;
            
            -- Add assigned user to new_values
            IF v_assigned_user_name IS NOT NULL THEN
                v_new_data := v_new_data || jsonb_build_object(
                    'assigned_to_name', v_assigned_user_name,
                    'assigned_user_dept', v_assigned_user_dept
                );
            END IF;
            
            -- Use assigned user's department if asset department is null
            IF v_department IS NULL THEN
                v_department := v_assigned_user_dept;
            END IF;
        END IF;
        
    ELSIF TG_TABLE_NAME IN ('department_payments', 'payment_documents') THEN
        v_department := COALESCE(NEW.department, OLD.department);
    ELSIF TG_TABLE_NAME = 'profiles' THEN
        v_department := COALESCE(NEW.department, OLD.department);
    ELSIF TG_TABLE_NAME = 'tasks' THEN
        v_department := COALESCE(NEW.department, OLD.department);
    ELSIF TG_TABLE_NAME = 'performance_reviews' THEN
        v_department := COALESCE(NEW.department, OLD.department);
    ELSIF TG_TABLE_NAME = 'attendance_records' THEN
        v_department := COALESCE(NEW.department, OLD.department);
    END IF;

    -- Insert audit log
    INSERT INTO audit_logs (
        user_id,
        operation,
        action,
        table_name,
        entity_type,
        record_id,
        entity_id,
        old_values,
        new_values,
        changed_fields,
        department,
        metadata,
        status
    )
    VALUES (
        auth.uid(),
        TG_OP,
        v_action,
        TG_TABLE_NAME,
        v_entity_type,
        v_entity_id,
        v_entity_id,
        v_old_data,
        v_new_data,
        v_changed_fields,
        v_department,
        jsonb_build_object(
            'trigger', TG_NAME,
            'schema', TG_TABLE_SCHEMA
        ),
        'success'
    );

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't block operation
        INSERT INTO audit_logs (
            operation,
            action,
            table_name,
            entity_type,
            record_id,
            entity_id,
            status,
            error_details
        )
        VALUES (
            TG_OP,
            CASE TG_OP 
                WHEN 'INSERT' THEN 'create' 
                WHEN 'UPDATE' THEN 'update' 
                WHEN 'DELETE' THEN 'delete' 
            END,
            TG_TABLE_NAME,
            TG_TABLE_NAME,
            COALESCE(v_entity_id, 'unknown'),
            COALESCE(v_entity_id, 'unknown'),
            'error',
            SQLERRM
        );
        
        IF (TG_OP = 'DELETE') THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;;
