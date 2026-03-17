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
    v_asset_record RECORD;
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
        -- Link to asset code in logs (More robust lookup)
        SELECT unique_code, asset_model INTO v_asset_record 
        FROM public.assets 
        WHERE id = COALESCE(NEW.asset_id, OLD.asset_id);
        
        IF v_asset_record.unique_code IS NOT NULL THEN
            v_metadata := jsonb_build_object(
                'unique_code', v_asset_record.unique_code,
                'asset_model', v_asset_record.asset_model
            );
        END IF;
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
;
