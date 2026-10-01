-- =====================================================
-- AUDIT LOG TRIGGERS FOR PAYMENTS
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Create a generic trigger function for audit logging if it doesn't ideally exist or needs improvement for generic JSONB handling
-- Note: Reusing the existing `audit_logs` table structure from 001_rbac_and_features.sql
-- We need a trigger function that automatically inserts into `audit_logs` on INSERT, UPDATE, DELETE

CREATE OR REPLACE FUNCTION audit_log_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_action TEXT;
    v_entity_type TEXT;
    v_entity_id UUID;
BEGIN
    -- Determine the action
    IF (TG_OP = 'INSERT') THEN
        v_action := 'create';
        v_new_data := to_jsonb(NEW);
        v_entity_id := NEW.id;
    ELSIF (TG_OP = 'UPDATE') THEN
        v_action := 'update';
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_entity_id := NEW.id;
    ELSIF (TG_OP = 'DELETE') THEN
        v_action := 'delete';
        v_old_data := to_jsonb(OLD);
        v_entity_id := OLD.id;
    END IF;

    -- Determine entity type based on table name
    v_entity_type := TG_TABLE_NAME;

    -- Insert into audit_logs
    -- Note: We use auth.uid() to get the current user ID. If invoked by system or standard API, this works.
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Apply Trigger to `department_payments`
DROP TRIGGER IF EXISTS audit_department_payments_changes ON department_payments;
CREATE TRIGGER audit_department_payments_changes
AFTER INSERT OR UPDATE OR DELETE ON department_payments
FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

-- 3. Apply Trigger to `payment_documents`
DROP TRIGGER IF EXISTS audit_payment_documents_changes ON payment_documents;
CREATE TRIGGER audit_payment_documents_changes
AFTER INSERT OR UPDATE OR DELETE ON payment_documents
FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

-- 4. Apply Trigger to `departments`
DROP TRIGGER IF EXISTS audit_departments_changes ON departments;
CREATE TRIGGER audit_departments_changes
AFTER INSERT OR UPDATE OR DELETE ON departments
FOR EACH ROW EXECUTE FUNCTION audit_log_changes();

-- 5. Apply Trigger to `payment_categories`
DROP TRIGGER IF EXISTS audit_payment_categories_changes ON payment_categories;
CREATE TRIGGER audit_payment_categories_changes
AFTER INSERT OR UPDATE OR DELETE ON payment_categories
FOR EACH ROW EXECUTE FUNCTION audit_log_changes();
