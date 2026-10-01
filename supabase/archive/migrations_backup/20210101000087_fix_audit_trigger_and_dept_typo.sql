-- Fix the audit_log_changes trigger to use correct column names
CREATE OR REPLACE FUNCTION public.audit_log_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_action TEXT;
    v_entity_type TEXT;
    v_entity_id TEXT;
BEGIN
    -- Determine the action
    IF (TG_OP = 'INSERT') THEN
        v_action := 'create';
        v_new_data := to_jsonb(NEW);
        v_entity_id := NEW.id::TEXT;
    ELSIF (TG_OP = 'UPDATE') THEN
        v_action := 'update';
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_entity_id := NEW.id::TEXT;
    ELSIF (TG_OP = 'DELETE') THEN
        v_action := 'delete';
        v_old_data := to_jsonb(OLD);
        v_entity_id := OLD.id::TEXT;
    END IF;

    -- Determine entity type based on table name
    v_entity_type := TG_TABLE_NAME;

    -- Insert into audit_logs using correct column names
    INSERT INTO audit_logs (
        user_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values
    )
    VALUES (
        auth.uid(),
        v_action,
        v_entity_type,
        v_entity_id,
        v_old_data,
        v_new_data
    );

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$function$;

-- Fix department name typo
UPDATE departments SET name = 'Business, Growth and Innovation' WHERE name = 'Business Growth and Innovation';
UPDATE profiles SET department = 'Business, Growth and Innovation' WHERE department = 'Business Growth and Innovation';
