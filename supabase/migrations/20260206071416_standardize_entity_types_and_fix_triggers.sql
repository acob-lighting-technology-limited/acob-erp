-- Step 1: Standardize entity types to plural table names
UPDATE audit_logs SET entity_type = 'profiles' WHERE entity_type = 'profile';
UPDATE audit_logs SET entity_type = 'tasks' WHERE entity_type = 'task';

-- Step 2: Update the main audit_log_changes trigger to handle all operations correctly
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
    -- Set entity type to table name (always plural)
    v_entity_type := TG_TABLE_NAME;

    -- Determine the action and data
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
        v_new_data := v_old_data;  -- For delete, store the deleted data in new_values too
        v_entity_id := OLD.id::TEXT;
        
        SELECT array_agg(key) INTO v_changed_fields
        FROM jsonb_object_keys(v_old_data) AS key;
    END IF;

    -- Extract department based on table type
    IF TG_TABLE_NAME = 'assets' THEN
        v_department := COALESCE(NEW.department, NEW.office_location, OLD.department, OLD.office_location);
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
    ELSIF TG_TABLE_NAME = 'leave_requests' THEN
        -- Lookup department from profile
        SELECT department INTO v_department FROM profiles WHERE id = COALESCE(NEW.user_id, OLD.user_id);
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

-- Step 3: Add triggers to important tables that don't have them
-- Projects table
DROP TRIGGER IF EXISTS audit_projects_changes ON projects;
CREATE TRIGGER audit_projects_changes
    AFTER INSERT OR UPDATE OR DELETE ON projects
    FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

-- Feedback table
DROP TRIGGER IF EXISTS audit_feedback_changes ON feedback;
CREATE TRIGGER audit_feedback_changes
    AFTER INSERT OR UPDATE OR DELETE ON feedback
    FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

-- Job postings table
DROP TRIGGER IF EXISTS audit_job_postings_changes ON job_postings;
CREATE TRIGGER audit_job_postings_changes
    AFTER INSERT OR UPDATE OR DELETE ON job_postings
    FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

-- User documentation table
DROP TRIGGER IF EXISTS audit_user_documentation_changes ON user_documentation;
CREATE TRIGGER audit_user_documentation_changes
    AFTER INSERT OR UPDATE OR DELETE ON user_documentation
    FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

-- Employee salaries table
DROP TRIGGER IF EXISTS audit_employee_salaries_changes ON employee_salaries;
CREATE TRIGGER audit_employee_salaries_changes
    AFTER INSERT OR UPDATE OR DELETE ON employee_salaries
    FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

-- Employee suspensions table
DROP TRIGGER IF EXISTS audit_employee_suspensions_changes ON employee_suspensions;
CREATE TRIGGER audit_employee_suspensions_changes
    AFTER INSERT OR UPDATE OR DELETE ON employee_suspensions
    FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

-- Roles table
DROP TRIGGER IF EXISTS audit_roles_changes ON roles;
CREATE TRIGGER audit_roles_changes
    AFTER INSERT OR UPDATE OR DELETE ON roles
    FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

-- Pending users table (invitations)
DROP TRIGGER IF EXISTS audit_pending_users_changes ON pending_users;
CREATE TRIGGER audit_pending_users_changes
    AFTER INSERT OR UPDATE OR DELETE ON pending_users
    FOR EACH ROW EXECUTE FUNCTION audit_log_changes();;
