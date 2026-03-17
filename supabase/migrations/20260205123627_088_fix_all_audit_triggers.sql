-- Fix the log_audit_changes function to use correct column names
CREATE OR REPLACE FUNCTION public.log_audit_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_metadata JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_metadata := jsonb_build_object('new_values', row_to_json(NEW));
    INSERT INTO audit_logs (user_id, operation, table_name, record_id, metadata, status)
    VALUES (
      auth.uid(),
      'INSERT',
      TG_TABLE_NAME,
      NEW.id::text,
      v_metadata,
      'success'
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_metadata := jsonb_build_object('old_values', row_to_json(OLD), 'new_values', row_to_json(NEW));
    INSERT INTO audit_logs (user_id, operation, table_name, record_id, metadata, status)
    VALUES (
      auth.uid(),
      'UPDATE',
      TG_TABLE_NAME,
      NEW.id::text,
      v_metadata,
      'success'
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_metadata := jsonb_build_object('old_values', row_to_json(OLD));
    INSERT INTO audit_logs (user_id, operation, table_name, record_id, metadata, status)
    VALUES (
      auth.uid(),
      'DELETE',
      TG_TABLE_NAME,
      OLD.id::text,
      v_metadata,
      'success'
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;;
