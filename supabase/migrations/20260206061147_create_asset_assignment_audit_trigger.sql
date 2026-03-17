-- Create a specialized audit trigger for asset assignments
-- This logs ASSIGN/REASSIGN actions with complete info (unique_code, user name, department)

CREATE OR REPLACE FUNCTION audit_asset_assignment_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_action TEXT;
    v_asset_unique_code TEXT;
    v_assigned_to_name TEXT;
    v_assigned_from_name TEXT;
    v_department TEXT;
    v_new_values JSONB;
    v_old_values JSONB;
BEGIN
    -- Get asset unique_code
    SELECT unique_code INTO v_asset_unique_code
    FROM assets WHERE id = NEW.asset_id;

    -- Get assigned to user name and department
    SELECT 
        CONCAT(first_name, ' ', last_name),
        department
    INTO v_assigned_to_name, v_department
    FROM profiles WHERE id = NEW.assigned_to;

    -- Determine action
    IF TG_OP = 'INSERT' THEN
        -- Check if this is a reassignment (previous assignment exists)
        IF NEW.assigned_from IS NOT NULL THEN
            v_action := 'reassign';
            -- Get assigned from user name
            SELECT CONCAT(first_name, ' ', last_name) INTO v_assigned_from_name
            FROM profiles WHERE id = NEW.assigned_from;
        ELSE
            v_action := 'assign';
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'update';
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'unassign';
    END IF;

    -- Build new_values with enriched data
    v_new_values := jsonb_build_object(
        'id', NEW.id,
        'asset_id', NEW.asset_id,
        'unique_code', v_asset_unique_code,
        'assigned_to', NEW.assigned_to,
        'assigned_to_name', v_assigned_to_name,
        'assigned_from', NEW.assigned_from,
        'assigned_from_name', v_assigned_from_name,
        'department', v_department,
        'assignment_type', NEW.assignment_type,
        'office_location', NEW.office_location,
        'is_current', NEW.is_current,
        'assigned_at', NEW.assigned_at
    );

    -- Build old_values if update/delete
    IF TG_OP != 'INSERT' THEN
        v_old_values := to_jsonb(OLD);
    END IF;

    -- Insert audit log entry categorized under 'assets' entity type
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
        department,
        metadata,
        status
    )
    VALUES (
        auth.uid(),
        TG_OP,
        v_action,
        'asset_assignments',
        'assets',  -- Log under assets entity type for unified display
        NEW.id::TEXT,
        NEW.asset_id::TEXT,  -- Use asset_id so it groups with asset logs
        v_old_values,
        v_new_values,
        v_department,
        jsonb_build_object(
            'trigger', TG_NAME,
            'schema', TG_TABLE_SCHEMA,
            'assignment_id', NEW.id
        ),
        'success'
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't block operation
        RAISE NOTICE 'Audit log error: %', SQLERRM;
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for asset assignments
CREATE TRIGGER audit_asset_assignment_changes
    AFTER INSERT OR UPDATE OR DELETE ON asset_assignments
    FOR EACH ROW
    EXECUTE FUNCTION audit_asset_assignment_changes();;
