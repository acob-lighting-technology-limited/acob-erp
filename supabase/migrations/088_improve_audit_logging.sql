-- Migration: 088_improve_audit_logging.sql
-- Purpose: Enhance audit logging with better data capture and change tracking
-- Created: 2026-02-05

-- ============================================================================
-- STEP 1: Add missing columns to audit_logs table for better data capture
-- ============================================================================

-- Add action column (human-readable action name)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action TEXT;

-- Add entity_type column (normalized table/entity name)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type TEXT;

-- Add entity_id column (the ID of the affected record)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id TEXT;

-- Add old_values column (previous state of changed fields only)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_values JSONB;

-- Add new_values column (new state of changed fields only)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_values JSONB;

-- Add department column (for quick filtering by department)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS department TEXT;

-- Add changed_fields column (array of field names that were modified)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS changed_fields TEXT[];

-- Add ip_address column (for security auditing)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address INET;

-- Add user_agent column (for security auditing)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- ============================================================================
-- STEP 2: Create indexes for common query patterns
-- ============================================================================

-- Index for querying by action type
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Index for querying by entity_type
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);

-- Index for querying by department
CREATE INDEX IF NOT EXISTS idx_audit_logs_department ON audit_logs(department);

-- Index for querying by user_id
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);

-- Index for querying by created_at (for time-based filtering)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Composite index for common dashboard queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_dashboard 
ON audit_logs(created_at DESC, entity_type, action);

-- ============================================================================
-- STEP 3: Create improved audit_log_changes function
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_log_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        
        -- Compute only the changed fields (exclude updated_at as it always changes)
        FOR v_key IN SELECT jsonb_object_keys(v_new_data)
        LOOP
            v_old_val := v_old_data -> v_key;
            v_new_val := v_new_data -> v_key;
            
            -- Skip timestamp fields that auto-update
            IF v_key IN ('updated_at', 'created_at') THEN
                CONTINUE;
            END IF;
            
            -- Check if value changed (handle nulls properly)
            IF (v_old_val IS DISTINCT FROM v_new_val) THEN
                v_changed_data := v_changed_data || jsonb_build_object(v_key, v_new_val);
                v_old_changed := v_old_changed || jsonb_build_object(v_key, v_old_val);
                v_changed_fields := array_append(v_changed_fields, v_key);
            END IF;
        END LOOP;
        
        -- If nothing meaningful changed, don't log
        IF array_length(v_changed_fields, 1) IS NULL THEN
            IF (TG_OP = 'DELETE') THEN
                RETURN OLD;
            ELSE
                RETURN NEW;
            END IF;
        END IF;
        
        v_old_data := v_old_changed;
        v_new_data := v_changed_data;
        
    ELSIF (TG_OP = 'DELETE') THEN
        v_action := 'delete';
        v_old_data := to_jsonb(OLD);
        v_entity_id := OLD.id::TEXT;
        v_changed_data := v_old_data;
        
        -- Extract all keys as changed fields for DELETE
        SELECT array_agg(key) INTO v_changed_fields
        FROM jsonb_object_keys(v_old_data) AS key;
    END IF;

    -- Determine entity type (use table name)
    v_entity_type := TG_TABLE_NAME;
    
    -- Extract department from the record if the column exists
    -- First check if the table has a department column to avoid runtime errors
    PERFORM 1 FROM information_schema.columns 
    WHERE table_schema = TG_TABLE_SCHEMA 
    AND table_name = TG_TABLE_NAME 
    AND column_name = 'department';
    
    IF FOUND THEN
        IF (TG_OP = 'DELETE') THEN
            v_department := v_old_data ->> 'department';
        ELSE
            v_department := v_new_data ->> 'department';
        END IF;
    END IF;
    
    -- For certain tables, extract department from related fields
    IF v_department IS NULL THEN
        CASE TG_TABLE_NAME
            WHEN 'department_payments' THEN
                IF (TG_OP = 'DELETE') THEN
                    SELECT name INTO v_department FROM departments WHERE id = OLD.department_id;
                ELSE
                    SELECT name INTO v_department FROM departments WHERE id = NEW.department_id;
                END IF;
            WHEN 'payment_documents' THEN
                IF (TG_OP = 'DELETE') THEN
                    SELECT d.name INTO v_department 
                    FROM department_payments dp 
                    JOIN departments d ON d.id = dp.department_id 
                    WHERE dp.id = OLD.payment_id;
                ELSE
                    SELECT d.name INTO v_department 
                    FROM department_payments dp 
                    JOIN departments d ON d.id = dp.department_id 
                    WHERE dp.id = NEW.payment_id;
                END IF;
            WHEN 'leave_requests' THEN
                IF (TG_OP = 'DELETE') THEN
                    SELECT department INTO v_department FROM profiles WHERE id = OLD.employee_id;
                ELSE
                    SELECT department INTO v_department FROM profiles WHERE id = NEW.employee_id;
                END IF;
            WHEN 'attendance_records' THEN
                IF (TG_OP = 'DELETE') THEN
                    SELECT department INTO v_department FROM profiles WHERE id = OLD.employee_id;
                ELSE
                    SELECT department INTO v_department FROM profiles WHERE id = NEW.employee_id;
                END IF;
            WHEN 'performance_reviews' THEN
                IF (TG_OP = 'DELETE') THEN
                    SELECT department INTO v_department FROM profiles WHERE id = OLD.employee_id;
                ELSE
                    SELECT department INTO v_department FROM profiles WHERE id = NEW.employee_id;
                END IF;
            ELSE
                -- Leave as NULL if not found
                NULL;
        END CASE;
    END IF;

    -- Insert into audit_logs with enriched data
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
        -- Log the error but don't block the operation
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
$$;

-- ============================================================================
-- STEP 4: Update log_audit RPC function for frontend calls
-- ============================================================================

-- Drop ALL existing overloads of log_audit to avoid signature conflicts
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT p.oid, n.nspname as schema_name, p.proname
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'log_audit'
        AND n.nspname = 'public'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE',
            r.schema_name,
            r.proname,
            pg_get_function_identity_arguments(r.oid)
        );
    END LOOP;
END $$;

-- Create the improved log_audit function
CREATE OR REPLACE FUNCTION log_audit(
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id TEXT,
    p_user_id UUID DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_site_id TEXT DEFAULT NULL,
    p_department TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_audit_id UUID;
    v_user_id UUID;
    v_changed_fields TEXT[];
BEGIN
    -- Use provided user_id or get current auth user
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    -- Extract changed fields from new_values if provided
    IF p_new_values IS NOT NULL THEN
        SELECT array_agg(key) INTO v_changed_fields
        FROM jsonb_object_keys(p_new_values) AS key;
    END IF;
    
    INSERT INTO audit_logs (
        user_id,
        action,
        operation,
        entity_type,
        table_name,
        entity_id,
        record_id,
        old_values,
        new_values,
        changed_fields,
        department,
        metadata,
        site_id,
        status
    )
    VALUES (
        v_user_id,
        p_action,
        p_action,
        p_entity_type,
        p_entity_type,
        p_entity_id,
        p_entity_id,
        p_old_values,
        p_new_values,
        v_changed_fields,
        p_department,
        COALESCE(p_metadata, '{}'::JSONB),
        p_site_id,
        'success'
    )
    RETURNING id INTO v_audit_id;
    
    RETURN v_audit_id;
END;
$$;

-- ============================================================================
-- STEP 5: Backfill department data for existing audit logs where possible
-- ============================================================================

-- Update department from metadata for asset-related logs
UPDATE audit_logs
SET department = metadata->'new_values'->>'department'
WHERE department IS NULL
  AND entity_type = 'assets'
  AND metadata->'new_values'->>'department' IS NOT NULL;

-- Update department from metadata for asset_assignments
UPDATE audit_logs
SET department = metadata->'new_values'->>'department'
WHERE department IS NULL
  AND entity_type = 'asset_assignments'
  AND metadata->'new_values'->>'department' IS NOT NULL;

-- Update department from metadata for profiles
UPDATE audit_logs
SET department = metadata->'new_values'->>'department'
WHERE department IS NULL
  AND entity_type = 'profiles'
  AND metadata->'new_values'->>'department' IS NOT NULL;

-- Migrate old_values and new_values from metadata to dedicated columns for existing logs
UPDATE audit_logs
SET 
    old_values = metadata->'old_values',
    new_values = metadata->'new_values'
WHERE old_values IS NULL
  AND new_values IS NULL
  AND metadata->'old_values' IS NOT NULL;

-- Populate entity_type from table_name where missing
UPDATE audit_logs
SET entity_type = table_name
WHERE entity_type IS NULL AND table_name IS NOT NULL;

-- Populate entity_id from record_id where missing
UPDATE audit_logs
SET entity_id = record_id
WHERE entity_id IS NULL AND record_id IS NOT NULL;

-- Backfill action column from operation where missing
UPDATE audit_logs
SET action = CASE operation
    WHEN 'INSERT' THEN 'create'
    WHEN 'UPDATE' THEN 'update'
    WHEN 'DELETE' THEN 'delete'
    ELSE LOWER(operation)
END
WHERE action IS NULL AND operation IS NOT NULL;

-- ============================================================================
-- STEP 6: Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION log_audit TO authenticated;
GRANT EXECUTE ON FUNCTION audit_log_changes TO authenticated;

-- ============================================================================
-- STEP 7: Add comment for documentation
-- ============================================================================

COMMENT ON FUNCTION audit_log_changes IS 
'Trigger function for comprehensive audit logging. 
Captures only changed fields on UPDATE, includes department context, 
and handles errors gracefully without blocking operations.';

COMMENT ON FUNCTION log_audit IS 
'RPC function for frontend audit logging.
Use this to log actions from the application layer.
Accepts optional department parameter for financial and departmental context.';

-- Log this migration
INSERT INTO audit_logs (
    operation,
    action,
    table_name,
    entity_type,
    status,
    metadata
)
VALUES (
    'migration',
    'update_schema',
    'audit_logs',
    'audit_logs',
    'success',
    jsonb_build_object(
        'description', 'Improved audit logging with change tracking, department context, and selective field logging',
        'migration', '088_improve_audit_logging.sql'
    )
);
